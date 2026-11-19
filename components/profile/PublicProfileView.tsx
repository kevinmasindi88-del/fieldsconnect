"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/browser";
import { ProfileAvatar } from "@/components/profile/ProfileAvatar";

type Profile = {
  id: string;
  display_name: string;
  username: string | null;
  bio: string | null;
  field: string | null;
  role_type: string;
  profile_visibility: "public" | "connections" | "private";
  mentor_available: boolean;
  avatar_url: string | null;
};

type Skill = {
  id: string;
  name: string;
  description: string | null;
  rating: number | null;
  is_published: boolean;
};

type LibraryDocument = {
  id: string;
  title: string;
  description: string | null;
  file_name: string;
  file_size_bytes: number;
  storage_bucket: string;
  storage_path: string;
  visibility: "public" | "connections";
  is_published: boolean;
};

type PublicProfileViewProps = {
  profileId: string;
};

export function PublicProfileView({ profileId }: PublicProfileViewProps) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [documents, setDocuments] = useState<LibraryDocument[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isWorking, setIsWorking] = useState(false);

  useEffect(() => {
    async function loadProfile() {
      setMessage(null);

      if (!isSupabaseConfigured()) {
        setMessage("Supabase is not configured yet. Public profiles will work once environment variables are set.");
        setIsLoading(false);
        return;
      }

      try {
        const supabase = getSupabaseBrowserClient();
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) throw sessionError;

        if (!sessionData.session?.user.id) {
          setMessage("Please log in before viewing profiles.");
          setIsLoading(false);
          return;
        }

        const [
          { data: profileData, error: profileError },
          { data: skillData, error: skillError },
          { data: documentData, error: documentError },
        ] = await Promise.all([
          supabase
            .from("profiles")
            .select("id, display_name, username, bio, field, role_type, profile_visibility, mentor_available, avatar_url")
            .eq("id", profileId)
            .maybeSingle(),
          supabase
            .from("skills")
            .select("id, name, description, rating, is_published")
            .eq("profile_id", profileId)
            .eq("is_published", true)
            .is("deleted_at", null)
            .order("created_at", { ascending: false }),
          supabase
            .from("library_documents")
            .select("id, title, description, file_name, file_size_bytes, storage_bucket, storage_path, visibility, is_published")
            .eq("owner_id", profileId)
            .eq("is_published", true)
            .is("deleted_at", null)
            .order("created_at", { ascending: false }),
        ]);

        if (profileError) throw profileError;
        if (skillError) throw skillError;
        if (documentError) throw documentError;

        setProfile((profileData ?? null) as Profile | null);
        setSkills((skillData ?? []) as Skill[]);
        setDocuments((documentData ?? []) as LibraryDocument[]);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to load profile.");
      } finally {
        setIsLoading(false);
      }
    }

    void loadProfile();
  }, [profileId]);

  async function openDocument(document: LibraryDocument) {
    if (!isSupabaseConfigured()) return;

    setIsWorking(true);
    setMessage(null);

    try {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase.storage
        .from(document.storage_bucket)
        .createSignedUrl(document.storage_path, 60);

      if (error) throw error;

      if (data?.signedUrl) {
        window.open(data.signedUrl, "_blank", "noopener,noreferrer");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to open document.");
    } finally {
      setIsWorking(false);
    }
  }

  if (isLoading) {
    return (
      <section className="mx-auto w-full max-w-5xl p-8">
        <p className="text-sm text-gray-600">Loading profile...</p>
      </section>
    );
  }

  if (!profile) {
    return (
      <section className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-8">
        <p className="rounded-xl border border-dashed p-4 text-sm text-gray-600">
          This profile is not available. It may be private, connection-only, or removed.
        </p>
        <Link className="w-fit rounded-lg border px-4 py-2 text-sm font-medium" href="/connections">
          Back to connections
        </Link>
        {message && <p className="text-sm text-gray-700">{message}</p>}
      </section>
    );
  }

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-8">
      <Link className="w-fit text-sm font-medium text-gray-600 hover:text-black" href="/connections">
        ← Back to connections
      </Link>

      {message && <p className="rounded-lg border p-3 text-sm text-gray-700">{message}</p>}

      <header className="flex flex-col gap-4 rounded-xl border p-6 md:flex-row md:items-center">
        <ProfileAvatar avatarPath={profile.avatar_url} displayName={profile.display_name} size={88} />

        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-3xl font-semibold">{profile.display_name}</h1>
            <span className="rounded-full border px-3 py-1 text-xs">
              {profile.profile_visibility}
            </span>
          </div>

          {profile.username && <p className="mt-1 text-sm text-gray-600">@{profile.username}</p>}

          <p className="mt-2 text-sm text-gray-600">
            {[profile.role_type, profile.field].filter(Boolean).join(" - ") || "Profile"}
          </p>

          {profile.mentor_available && <p className="mt-2 text-sm font-medium">Available as mentor</p>}

          {profile.bio && <p className="mt-4 max-w-3xl whitespace-pre-wrap text-sm text-gray-700">{profile.bio}</p>}
        </div>
      </header>

      <section className="rounded-xl border p-4">
        <h2 className="text-xl font-semibold">Published skills</h2>

        {skills.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed p-4 text-sm text-gray-600">
            No published skills are visible yet.
          </p>
        ) : (
          <div className="mt-3 grid gap-3">
            {skills.map((skill) => (
              <article key={skill.id} className="rounded-xl border p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold">{skill.name}</h3>
                  <span className="rounded-full border px-2 py-1 text-xs">
                    Rating: {skill.rating ?? "Not rated"}
                  </span>
                </div>
                {skill.description && <p className="mt-2 text-sm text-gray-700">{skill.description}</p>}
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-xl border p-4">
        <h2 className="text-xl font-semibold">Visible library documents</h2>

        {documents.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed p-4 text-sm text-gray-600">
            No library documents are visible yet.
          </p>
        ) : (
          <div className="mt-3 grid gap-3">
            {documents.map((document) => (
              <article
                key={document.id}
                className="flex flex-col justify-between gap-4 rounded-xl border p-4 md:flex-row md:items-center"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold">{document.title}</h3>
                    <span className="rounded-full border px-2 py-1 text-xs">
                      {document.visibility === "public" ? "Public" : "Connections"}
                    </span>
                  </div>

                  {document.description && <p className="mt-2 text-sm text-gray-700">{document.description}</p>}

                  <p className="mt-2 text-xs text-gray-500">
                    {document.file_name} - {formatBytes(document.file_size_bytes)}
                  </p>
                </div>

                <button
                  className="w-fit rounded-lg bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                  disabled={isWorking}
                  onClick={() => openDocument(document)}
                  type="button"
                >
                  Open
                </button>
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
