"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getSupabaseBrowserClient,
  isSupabaseConfigured,
} from "@/lib/supabase/browser";
import {
  getActionErrorMessage,
  getMessageAlertClass,
} from "@/lib/action-errors";

type Profile = {
  id: string;
  display_name: string;
  role_type: string;
  field: string | null;
};

type Skill = {
  id: string;
  profile_id: string;
  name: string;
  description: string | null;
  rating: number | null;
  is_published: boolean;
  created_at: string;
};

export function SkillsWorkflow() {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [rating, setRating] = useState("3");
  const [isPublished, setIsPublished] = useState(true);

  const [editingSkillId, setEditingSkillId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editRating, setEditRating] = useState("3");
  const [editPublished, setEditPublished] = useState(true);

  const [deleteConfirmSkillId, setDeleteConfirmSkillId] =
    useState<string | null>(null);

  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isWorking, setIsWorking] = useState(false);

  const profileById = useMemo(() => {
    return new Map(profiles.map((profile) => [profile.id, profile]));
  }, [profiles]);

  const ownSkills = skills.filter(
    (skill) => skill.profile_id === currentUserId
  );

  const publishedSkills = skills.filter(
    (skill) =>
      skill.profile_id !== currentUserId &&
      skill.is_published
  );

  async function loadData(options?: { background?: boolean }) {
    if (!options?.background) {
      setMessage(null);
    }

    if (!isSupabaseConfigured()) {
      setMessage(
        "Supabase is not configured yet. Skills will work once environment variables are set."
      );
      setIsLoading(false);
      return;
    }

    try {
      const supabase = getSupabaseBrowserClient();

      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();

      if (sessionError) throw sessionError;

      const userId = sessionData.session?.user.id;

      if (!userId) {
        setMessage("Please log in before managing skills.");
        setIsLoading(false);
        return;
      }

      setCurrentUserId(userId);

      const [
        { data: profileData, error: profileError },
        { data: skillData, error: skillError },
      ] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, display_name, role_type, field")
          .is("deleted_at", null),
        supabase
          .from("skills")
          .select(
            "id, profile_id, name, description, rating, is_published, created_at"
          )
          .is("deleted_at", null)
          .order("created_at", { ascending: false }),
      ]);

      if (profileError) throw profileError;
      if (skillError) throw skillError;

      setProfiles((profileData ?? []) as Profile[]);
      setSkills((skillData ?? []) as Skill[]);
    } catch (error) {
      if (!options?.background) {
        setMessage(
          error instanceof Error
            ? error.message
            : "Unable to load skills."
        );
      }
    } finally {
      if (!options?.background) {
        setIsLoading(false);
      }
    }
  }

  useEffect(() => {
    void loadData();

    if (!isSupabaseConfigured()) return;

    const supabase = getSupabaseBrowserClient();

    const channel = supabase
      .channel(`skills-workflow-${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "skills",
        },
        () => {
          void loadData({ background: true });
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  async function addSkill(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (
      !currentUserId ||
      !name.trim() ||
      !isSupabaseConfigured()
    ) {
      return;
    }

    setIsWorking(true);
    setMessage(null);

    try {
      const supabase = getSupabaseBrowserClient();

      const { error } = await supabase.rpc("create_skill", {
        skill_name: name.trim(),
        skill_description: description.trim() || null,
        skill_rating: Number(rating),
        publish_skill: isPublished,
      });

      if (error) throw error;

      setName("");
      setDescription("");
      setRating("3");
      setIsPublished(true);

      setMessage(
        isPublished
          ? "Skill added and published."
          : "Skill added."
      );

      await loadData({ background: true });
    } catch (error) {
      setMessage(getActionErrorMessage(error, "add skill"));
    } finally {
      setIsWorking(false);
    }
  }

  function beginEdit(skill: Skill) {
    setDeleteConfirmSkillId(null);
    setEditingSkillId(skill.id);
    setEditName(skill.name);
    setEditDescription(skill.description ?? "");
    setEditRating(String(skill.rating ?? 3));
    setEditPublished(skill.is_published);
    setMessage(null);
  }

  function cancelEdit() {
    setEditingSkillId(null);
    setEditName("");
    setEditDescription("");
    setEditRating("3");
    setEditPublished(true);
  }

  async function saveEdit(
    event: React.FormEvent<HTMLFormElement>,
    skill: Skill
  ) {
    event.preventDefault();

    if (
      !currentUserId ||
      !editName.trim() ||
      !isSupabaseConfigured()
    ) {
      return;
    }

    setIsWorking(true);
    setMessage(null);

    try {
      const supabase = getSupabaseBrowserClient();

      const { error } = await supabase.rpc("update_own_skill", {
        skill_id: skill.id,
        skill_name: editName.trim(),
        skill_description: editDescription.trim() || null,
        skill_rating: Number(editRating),
        publish_skill: editPublished,
      });

      if (error) throw error;

      const becamePublished =
        !skill.is_published && editPublished;

      const stayedPublished =
        skill.is_published && editPublished;

      setMessage(
        becamePublished
          ? "Skill updated and published."
          : stayedPublished
            ? "Published skill updated."
            : "Skill updated."
      );

      cancelEdit();
      await loadData({ background: true });
    } catch (error) {
      setMessage(getActionErrorMessage(error, "update skill"));
    } finally {
      setIsWorking(false);
    }
  }

  async function togglePublished(skill: Skill) {
    if (!isSupabaseConfigured()) return;

    setIsWorking(true);
    setMessage(null);
    setDeleteConfirmSkillId(null);

    try {
      const supabase = getSupabaseBrowserClient();

      const { error } = await supabase.rpc("update_own_skill", {
        skill_id: skill.id,
        skill_name: skill.name,
        skill_description: skill.description,
        skill_rating: skill.rating ?? 3,
        publish_skill: !skill.is_published,
      });

      if (error) throw error;

      setMessage(
        skill.is_published
          ? "Skill unpublished."
          : "Skill published."
      );

      await loadData({ background: true });
    } catch (error) {
      setMessage(getActionErrorMessage(error, "update skill"));
    } finally {
      setIsWorking(false);
    }
  }

  async function deleteSkill(skill: Skill) {
    if (!isSupabaseConfigured()) return;

    setIsWorking(true);
    setMessage(null);

    try {
      const supabase = getSupabaseBrowserClient();

      const { error } = await supabase.rpc(
        "soft_delete_own_skill",
        {
          skill_id: skill.id,
        }
      );

      if (error) throw error;

      if (editingSkillId === skill.id) {
        cancelEdit();
      }

      setDeleteConfirmSkillId(null);
      setMessage("Skill deleted.");

      await loadData({ background: true });
    } catch (error) {
      setMessage(getActionErrorMessage(error, "delete skill"));
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 py-6 sm:gap-8 sm:p-8">
      {message && (
        <p className={getMessageAlertClass(message)}>
          {message}
        </p>
      )}

      <form
        onSubmit={addSkill}
        className="flex flex-col gap-4 rounded-xl border p-4"
      >
        <h2 className="text-xl font-semibold">Add a skill</h2>

        <SkillFields
          name={name}
          description={description}
          rating={rating}
          isPublished={isPublished}
          onNameChange={setName}
          onDescriptionChange={setDescription}
          onRatingChange={setRating}
          onPublishedChange={setIsPublished}
        />

        <button
          className="w-full rounded-lg bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50 sm:w-fit"
          disabled={!name.trim() || isWorking}
          type="submit"
        >
          Add skill
        </button>
      </form>

      {isLoading ? (
        <p className="text-sm text-gray-600">
          Loading skills...
        </p>
      ) : (
        <>
          <SkillSection title="My skills">
            {ownSkills.length === 0 ? (
              <EmptyState text="You have not added skills yet." />
            ) : (
              ownSkills.map((skill) =>
                editingSkillId === skill.id ? (
                  <form
                    key={skill.id}
                    onSubmit={(event) =>
                      saveEdit(event, skill)
                    }
                    className="flex flex-col gap-4 rounded-xl border p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-base font-semibold">
                        Edit skill
                      </h3>

                      <span className="rounded-full border px-2 py-1 text-xs">
                        {skill.is_published
                          ? "Currently published"
                          : "Currently unpublished"}
                      </span>
                    </div>

                    <SkillFields
                      name={editName}
                      description={editDescription}
                      rating={editRating}
                      isPublished={editPublished}
                      onNameChange={setEditName}
                      onDescriptionChange={setEditDescription}
                      onRatingChange={setEditRating}
                      onPublishedChange={setEditPublished}
                    />

                    <div className="flex flex-col gap-2 sm:flex-row">
                      <button
                        className="w-full rounded-lg bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50 sm:w-fit"
                        disabled={!editName.trim() || isWorking}
                        type="submit"
                      >
                        Save changes
                      </button>

                      <button
                        className="w-full rounded-lg border px-4 py-2 text-sm font-medium disabled:opacity-50 sm:w-fit"
                        disabled={isWorking}
                        onClick={cancelEdit}
                        type="button"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <SkillCard
                    key={skill.id}
                    skill={skill}
                    profile={profileById.get(skill.profile_id)}
                  >
                    <div className="flex flex-wrap gap-2">
                      <button
                        className="rounded-lg border px-3 py-2 text-sm font-medium disabled:opacity-50"
                        disabled={isWorking}
                        onClick={() => beginEdit(skill)}
                        type="button"
                      >
                        Edit
                      </button>

                      <button
                        className="rounded-lg border px-3 py-2 text-sm font-medium disabled:opacity-50"
                        disabled={isWorking}
                        onClick={() => togglePublished(skill)}
                        type="button"
                      >
                        {skill.is_published
                          ? "Unpublish"
                          : "Publish"}
                      </button>

                      <button
                        className="rounded-lg border px-3 py-2 text-sm font-medium text-red-700 disabled:opacity-50"
                        disabled={isWorking}
                        onClick={() =>
                          setDeleteConfirmSkillId(skill.id)
                        }
                        type="button"
                      >
                        Delete
                      </button>
                    </div>

                    {deleteConfirmSkillId === skill.id && (
                      <div
                        className="mt-3 rounded-lg border p-3"
                        role="alert"
                      >
                        <p className="text-sm font-medium">
                          Delete this skill?
                        </p>

                        <p className="mt-1 text-xs text-gray-600">
                          It will be removed from your profile and
                          from published skills.
                        </p>

                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            className="rounded-lg bg-black px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                            disabled={isWorking}
                            onClick={() => deleteSkill(skill)}
                            type="button"
                          >
                            Yes, delete
                          </button>

                          <button
                            className="rounded-lg border px-3 py-2 text-sm font-medium disabled:opacity-50"
                            disabled={isWorking}
                            onClick={() =>
                              setDeleteConfirmSkillId(null)
                            }
                            type="button"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </SkillCard>
                )
              )
            )}
          </SkillSection>

          <SkillSection title="Published skills from the network">
            {publishedSkills.length === 0 ? (
              <EmptyState text="No published skills found yet." />
            ) : (
              publishedSkills.map((skill) => (
                <SkillCard
                  key={skill.id}
                  skill={skill}
                  profile={profileById.get(skill.profile_id)}
                />
              ))
            )}
          </SkillSection>
        </>
      )}
    </section>
  );
}

function SkillFields({
  name,
  description,
  rating,
  isPublished,
  onNameChange,
  onDescriptionChange,
  onRatingChange,
  onPublishedChange,
}: {
  name: string;
  description: string;
  rating: string;
  isPublished: boolean;
  onNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onRatingChange: (value: string) => void;
  onPublishedChange: (value: boolean) => void;
}) {
  return (
    <>
      <label className="flex flex-col gap-2 text-sm font-medium">
        Skill name
        <input
          className="rounded-lg border px-3 py-2"
          value={name}
          onChange={(event) =>
            onNameChange(event.target.value)
          }
          placeholder="Example: GMP, mentoring, React, public speaking"
          required
        />
      </label>

      <label className="flex flex-col gap-2 text-sm font-medium">
        Description
        <textarea
          className="min-h-24 rounded-lg border px-3 py-2"
          value={description}
          onChange={(event) =>
            onDescriptionChange(event.target.value)
          }
          placeholder="Briefly explain your experience with this skill."
        />
      </label>

      <label className="flex flex-col gap-2 text-sm font-medium">
        Proficiency
        <select
          className="w-full rounded-lg border px-3 py-2 sm:w-fit"
          value={rating}
          onChange={(event) =>
            onRatingChange(event.target.value)
          }
        >
          <option value="1">1 - Beginner</option>
          <option value="2">2 - Basic</option>
          <option value="3">3 - Intermediate</option>
          <option value="4">4 - Advanced</option>
          <option value="5">5 - Expert</option>
        </select>
      </label>

      <label className="flex items-start gap-3 text-sm">
        <input
          className="mt-0.5"
          type="checkbox"
          checked={isPublished}
          onChange={(event) =>
            onPublishedChange(event.target.checked)
          }
        />
        <span>
          Publish this skill on my profile.
        </span>
      </label>
    </>
  );
}

function SkillSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold sm:text-xl">
        {title}
      </h2>

      <div className="grid gap-3">{children}</div>
    </section>
  );
}

function SkillCard({
  skill,
  profile,
  children,
}: {
  skill: Skill;
  profile?: Profile;
  children?: React.ReactNode;
}) {
  return (
    <article className="flex flex-col justify-between gap-4 rounded-xl border p-4 md:flex-row md:items-start">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="break-words text-sm font-semibold leading-snug sm:text-base">
            {skill.name}
          </h3>

          <span className="rounded-full border px-2 py-0.5 text-[11px] sm:py-1 sm:text-xs">
            Proficiency: {skill.rating ?? "Not rated"}
          </span>

          <span className="rounded-full border px-2 py-0.5 text-[11px] sm:py-1 sm:text-xs">
            {skill.is_published
              ? "Published"
              : "Unpublished"}
          </span>
        </div>

        <p className="mt-2 text-xs leading-snug text-gray-600 sm:text-sm">
          {profile?.display_name ?? "Unknown profile"}
          {profile?.field ? ` - ${profile.field}` : ""}
        </p>

        {skill.description && (
          <p className="mt-2 max-w-2xl break-words text-sm leading-snug text-gray-700">
            {skill.description}
          </p>
        )}
      </div>

      {children && (
        <div className="shrink-0">{children}</div>
      )}
    </article>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <p className="rounded-xl border border-dashed p-4 text-sm text-gray-600">
      {text}
    </p>
  );
}
