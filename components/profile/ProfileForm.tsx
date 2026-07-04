"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/browser";

type RoleType = "student" | "professional" | "institution";
type ProfileVisibility = "public" | "connections" | "private";

type ProfileFormState = {
  displayName: string;
  username: string;
  roleType: RoleType;
  field: string;
  bio: string;
  profileVisibility: ProfileVisibility;
  mentorAvailable: boolean;
};

const initialState: ProfileFormState = {
  displayName: "",
  username: "",
  roleType: "professional",
  field: "",
  bio: "",
  profileVisibility: "public",
  mentorAvailable: false,
};

export function ProfileForm() {
  const [form, setForm] = useState<ProfileFormState>(initialState);
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    async function loadProfile() {
      setMessage(null);

      if (!isSupabaseConfigured()) {
        setMessage("Supabase is not configured yet. Profile saving will work once environment variables are set.");
        setIsLoading(false);
        return;
      }

      try {
        const supabase = getSupabaseBrowserClient();
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) throw sessionError;

        const userId = sessionData.session?.user.id;

        if (!userId) {
          setMessage("Please log in before managing your profile.");
          setIsLoading(false);
          return;
        }

        const { data, error } = await supabase
          .from("profiles")
          .select("display_name, username, role_type, field, bio, profile_visibility, mentor_available")
          .eq("id", userId)
          .maybeSingle();

        if (error) throw error;

        if (data) {
          setForm({
            displayName: data.display_name ?? "",
            username: data.username ?? "",
            roleType: data.role_type ?? "professional",
            field: data.field ?? "",
            bio: data.bio ?? "",
            profileVisibility: data.profile_visibility ?? "public",
            mentorAvailable: Boolean(data.mentor_available),
          });
        }
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to load profile.");
      } finally {
        setIsLoading(false);
      }
    }

    void loadProfile();
  }, []);

  function updateField<K extends keyof ProfileFormState>(key: K, value: ProfileFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    if (!form.displayName.trim()) {
      setMessage("Display name is required.");
      return;
    }

    if (!isSupabaseConfigured()) {
      setMessage("Supabase is not configured yet. Profile saving will work once environment variables are set.");
      return;
    }

    setIsSaving(true);

    try {
      const supabase = getSupabaseBrowserClient();
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

      if (sessionError) throw sessionError;

      const userId = sessionData.session?.user.id;

      if (!userId) {
        setMessage("Please log in before saving your profile.");
        return;
      }

      const { error } = await supabase.from("profiles").upsert({
        id: userId,
        display_name: form.displayName.trim(),
        username: form.username.trim() || null,
        role_type: form.roleType,
        field: form.field.trim() || null,
        bio: form.bio.trim() || null,
        profile_visibility: form.profileVisibility,
        mentor_available: form.mentorAvailable,
      });

      if (error) throw error;

      setMessage("Profile saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save profile.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto flex w-full max-w-2xl flex-col gap-4 rounded-xl border p-6">
      <div>
        <h1 className="text-2xl font-semibold">Profile setup</h1>
        <p className="mt-2 text-sm text-gray-600">
          Complete the basic profile fields needed for the FieldsConnect MVP. Privileged roles are not editable here.
        </p>
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-600">Loading profile...</p>
      ) : (
        <>
          <label className="flex flex-col gap-2 text-sm font-medium">
            Display name
            <input
              className="rounded-lg border px-3 py-2"
              value={form.displayName}
              onChange={(event) => updateField("displayName", event.target.value)}
              required
            />
          </label>

          <label className="flex flex-col gap-2 text-sm font-medium">
            Username
            <input
              className="rounded-lg border px-3 py-2"
              value={form.username}
              onChange={(event) => updateField("username", event.target.value)}
              placeholder="Optional"
            />
          </label>

          <label className="flex flex-col gap-2 text-sm font-medium">
            Role type
            <select
              className="rounded-lg border px-3 py-2"
              value={form.roleType}
              onChange={(event) => updateField("roleType", event.target.value as RoleType)}
            >
              <option value="student">Student</option>
              <option value="professional">Professional</option>
              <option value="institution">Institution</option>
            </select>
          </label>

          <label className="flex flex-col gap-2 text-sm font-medium">
            Field
            <input
              className="rounded-lg border px-3 py-2"
              value={form.field}
              onChange={(event) => updateField("field", event.target.value)}
              placeholder="Example: Pharmacy, Engineering, Finance"
            />
          </label>

          <label className="flex flex-col gap-2 text-sm font-medium">
            Bio
            <textarea
              className="min-h-28 rounded-lg border px-3 py-2"
              value={form.bio}
              onChange={(event) => updateField("bio", event.target.value)}
              placeholder="Briefly introduce yourself."
            />
          </label>

          <label className="flex flex-col gap-2 text-sm font-medium">
            Profile visibility
            <select
              className="rounded-lg border px-3 py-2"
              value={form.profileVisibility}
              onChange={(event) => updateField("profileVisibility", event.target.value as ProfileVisibility)}
            >
              <option value="public">Public</option>
              <option value="connections">Connections only</option>
              <option value="private">Private</option>
            </select>
          </label>

          <label className="flex gap-3 text-sm">
            <input
              type="checkbox"
              checked={form.mentorAvailable}
              onChange={() => updateField("mentorAvailable", !form.mentorAvailable)}
            />
            I am available as a mentor.
          </label>

          <button
            className="w-fit rounded-lg bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            type="submit"
            disabled={isSaving}
          >
            {isSaving ? "Saving..." : "Save profile"}
          </button>
        </>
      )}

      {message && <p className="text-sm text-gray-700">{message}</p>}
    </form>
  );
}
