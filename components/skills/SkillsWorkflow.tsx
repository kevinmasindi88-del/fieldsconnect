"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/browser";

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
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isWorking, setIsWorking] = useState(false);

  const profileById = useMemo(() => {
    return new Map(profiles.map((profile) => [profile.id, profile]));
  }, [profiles]);

  const ownSkills = skills.filter((skill) => skill.profile_id === currentUserId);
  const publishedSkills = skills.filter((skill) => skill.profile_id !== currentUserId && skill.is_published);

  async function loadData() {
    setMessage(null);

    if (!isSupabaseConfigured()) {
      setMessage("Supabase is not configured yet. Skills will work once environment variables are set.");
      setIsLoading(false);
      return;
    }

    try {
      const supabase = getSupabaseBrowserClient();
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

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
          .select("id, profile_id, name, description, rating, is_published, created_at")
          .is("deleted_at", null)
          .order("created_at", { ascending: false }),
      ]);

      if (profileError) throw profileError;
      if (skillError) throw skillError;

      setProfiles((profileData ?? []) as Profile[]);
      setSkills((skillData ?? []) as Skill[]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load skills.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  async function addSkill(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!currentUserId || !name.trim() || !isSupabaseConfigured()) return;

    setIsWorking(true);
    setMessage(null);

    try {
      const supabase = getSupabaseBrowserClient();

      const { error } = await supabase.from("skills").insert({
        profile_id: currentUserId,
        name: name.trim(),
        description: description.trim() || null,
        rating: Number(rating),
        is_published: isPublished,
      });

      if (error) throw error;

      setName("");
      setDescription("");
      setRating("3");
      setIsPublished(true);
      setMessage("Skill added.");
      await loadData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to add skill.");
    } finally {
      setIsWorking(false);
    }
  }

  async function togglePublished(skill: Skill) {
    setIsWorking(true);
    setMessage(null);

    try {
      const supabase = getSupabaseBrowserClient();

      const { error } = await supabase
        .from("skills")
        .update({ is_published: !skill.is_published })
        .eq("id", skill.id);

      if (error) throw error;

      setMessage(skill.is_published ? "Skill unpublished." : "Skill published.");
      await loadData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update skill.");
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-8 p-8">
      <div>
        <h1 className="text-3xl font-semibold">Skills</h1>
        <p className="mt-2 text-sm text-gray-600">
          Add and publish skills for your FieldsConnect profile. Endorsements and uploads are out of scope for this baseline.
        </p>
      </div>

      {message && <p className="rounded-lg border p-3 text-sm text-gray-700">{message}</p>}

      <form onSubmit={addSkill} className="flex flex-col gap-4 rounded-xl border p-4">
        <h2 className="text-xl font-semibold">Add a skill</h2>

        <label className="flex flex-col gap-2 text-sm font-medium">
          Skill name
          <input
            className="rounded-lg border px-3 py-2"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Example: GMP, mentoring, React, public speaking"
            required
          />
        </label>

        <label className="flex flex-col gap-2 text-sm font-medium">
          Description
          <textarea
            className="min-h-24 rounded-lg border px-3 py-2"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Briefly explain your experience with this skill."
          />
        </label>

        <label className="flex flex-col gap-2 text-sm font-medium">
          Rating
          <select
            className="w-fit rounded-lg border px-3 py-2"
            value={rating}
            onChange={(event) => setRating(event.target.value)}
          >
            <option value="1">1 - Beginner</option>
            <option value="2">2 - Basic</option>
            <option value="3">3 - Intermediate</option>
            <option value="4">4 - Advanced</option>
            <option value="5">5 - Expert</option>
          </select>
        </label>

        <label className="flex gap-3 text-sm">
          <input
            type="checkbox"
            checked={isPublished}
            onChange={() => setIsPublished((current) => !current)}
          />
          Publish this skill on my profile.
        </label>

        <button
          className="w-fit rounded-lg bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          disabled={!name.trim() || isWorking}
          type="submit"
        >
          Add skill
        </button>
      </form>

      {isLoading ? (
        <p className="text-sm text-gray-600">Loading skills...</p>
      ) : (
        <>
          <SkillSection title="My skills">
            {ownSkills.length === 0 ? (
              <EmptyState text="You have not added skills yet." />
            ) : (
              ownSkills.map((skill) => (
                <SkillCard key={skill.id} skill={skill} profile={profileById.get(skill.profile_id)}>
                  <button
                    className="rounded-lg border px-3 py-2 text-sm font-medium disabled:opacity-50"
                    disabled={isWorking}
                    onClick={() => togglePublished(skill)}
                    type="button"
                  >
                    {skill.is_published ? "Unpublish" : "Publish"}
                  </button>
                </SkillCard>
              ))
            )}
          </SkillSection>

          <SkillSection title="Published skills from the network">
            {publishedSkills.length === 0 ? (
              <EmptyState text="No published skills found yet." />
            ) : (
              publishedSkills.map((skill) => (
                <SkillCard key={skill.id} skill={skill} profile={profileById.get(skill.profile_id)} />
              ))
            )}
          </SkillSection>
        </>
      )}
    </section>
  );
}

function SkillSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xl font-semibold">{title}</h2>
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
    <article className="flex flex-col justify-between gap-4 rounded-xl border p-4 md:flex-row md:items-center">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-semibold">{skill.name}</h3>
          <span className="rounded-full border px-2 py-1 text-xs">
            Rating: {skill.rating ?? "Not rated"}
          </span>
          <span className="rounded-full border px-2 py-1 text-xs">
            {skill.is_published ? "Published" : "Unpublished"}
          </span>
        </div>

        <p className="mt-2 text-sm text-gray-600">
          {profile?.display_name ?? "Unknown profile"}
          {profile?.field ? ` - ${profile.field}` : ""}
        </p>

        {skill.description && <p className="mt-2 max-w-2xl text-sm text-gray-700">{skill.description}</p>}
      </div>

      {children && <div>{children}</div>}
    </article>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p className="rounded-xl border border-dashed p-4 text-sm text-gray-600">{text}</p>;
}
