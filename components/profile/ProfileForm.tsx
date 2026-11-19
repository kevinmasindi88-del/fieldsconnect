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

const AVATAR_BUCKET = "profile-avatars";
const MAX_AVATAR_SIZE_BYTES = 2 * 1024 * 1024;
const ALLOWED_AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export function ProfileForm() {
  const [form, setForm] = useState<ProfileFormState>(initialState);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [avatarPath, setAvatarPath] = useState<string | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
  const [selectedAvatarFile, setSelectedAvatarFile] = useState<File | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isAvatarWorking, setIsAvatarWorking] = useState(false);

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

        setCurrentUserId(userId);

        const { data, error } = await supabase
          .from("profiles")
          .select("display_name, username, role_type, field, bio, profile_visibility, mentor_available, avatar_url")
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

          setAvatarPath(data.avatar_url ?? null);

          if (data.avatar_url) {
            await refreshAvatarPreview(data.avatar_url);
          }
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

  async function refreshAvatarPreview(path: string | null) {
    if (!path || !isSupabaseConfigured()) {
      setAvatarPreviewUrl(null);
      return;
    }

    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase.storage.from(AVATAR_BUCKET).createSignedUrl(path, 3600);

    if (error) {
      setAvatarPreviewUrl(null);
      return;
    }

    setAvatarPreviewUrl(data?.signedUrl ?? null);
  }

  function validateAvatarFile(file: File) {
    if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
      return "Profile picture must be a JPG, PNG, WebP, or GIF image.";
    }

    if (file.size > MAX_AVATAR_SIZE_BYTES) {
      return "Profile picture is too large. Maximum size is 2 MB.";
    }

    return null;
  }

  async function uploadAvatar() {
    if (!currentUserId || !selectedAvatarFile || !isSupabaseConfigured()) return;

    const validationError = validateAvatarFile(selectedAvatarFile);

    if (validationError) {
      setMessage(validationError);
      return;
    }

    setIsAvatarWorking(true);
    setMessage(null);

    const supabase = getSupabaseBrowserClient();
    const oldAvatarPath = avatarPath;
    const safeFileName = selectedAvatarFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const newAvatarPath = `${currentUserId}/${crypto.randomUUID()}-${safeFileName}`;

    try {
      const { error: uploadError } = await supabase.storage
        .from(AVATAR_BUCKET)
        .upload(newAvatarPath, selectedAvatarFile, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { error: profileError } = await supabase
        .from("profiles")
        .update({ avatar_url: newAvatarPath })
        .eq("id", currentUserId);

      if (profileError) {
        await supabase.storage.from(AVATAR_BUCKET).remove([newAvatarPath]);
        throw profileError;
      }

      if (oldAvatarPath && oldAvatarPath !== newAvatarPath) {
        const { error: oldDeleteError } = await supabase.storage.from(AVATAR_BUCKET).remove([oldAvatarPath]);
        if (oldDeleteError) throw oldDeleteError;
      }

      setAvatarPath(newAvatarPath);
      setSelectedAvatarFile(null);
      await refreshAvatarPreview(newAvatarPath);
      setMessage(oldAvatarPath ? "Profile picture replaced. Old picture was deleted." : "Profile picture uploaded.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to upload profile picture.");
    } finally {
      setIsAvatarWorking(false);
    }
  }

  async function deleteAvatar() {
    if (!currentUserId || !avatarPath || !isSupabaseConfigured()) return;

    const shouldDelete = window.confirm("Delete your current profile picture?");

    if (!shouldDelete) return;

    setIsAvatarWorking(true);
    setMessage(null);

    const supabase = getSupabaseBrowserClient();
    const pathToDelete = avatarPath;

    try {
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ avatar_url: null })
        .eq("id", currentUserId);

      if (profileError) throw profileError;

      const { error: storageError } = await supabase.storage.from(AVATAR_BUCKET).remove([pathToDelete]);

      if (storageError) throw storageError;

      setAvatarPath(null);
      setAvatarPreviewUrl(null);
      setSelectedAvatarFile(null);
      setMessage("Profile picture deleted.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to delete profile picture.");
    } finally {
      setIsAvatarWorking(false);
    }
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
        avatar_url: avatarPath,
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
          <section className="flex flex-col gap-3 rounded-xl border p-4">
            <h2 className="text-lg font-semibold">Profile picture</h2>

            <div className="flex flex-wrap items-center gap-4">
              <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border bg-gray-50 text-sm text-gray-500">
                {avatarPreviewUrl ? (
                  <img alt="Profile preview" className="h-full w-full object-cover" src={avatarPreviewUrl} />
                ) : (
                  <span>No photo</span>
                )}
              </div>

              <div className="flex flex-col gap-3">
                <input
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="rounded-lg border px-3 py-2 text-sm"
                  type="file"
                  onChange={(event) => setSelectedAvatarFile(event.target.files?.[0] ?? null)}
                />

                <div className="flex flex-wrap gap-2">
                  <button
                    className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                    disabled={!selectedAvatarFile || isAvatarWorking}
                    onClick={uploadAvatar}
                    type="button"
                  >
                    {avatarPath ? "Replace picture" : "Upload picture"}
                  </button>

                  {avatarPath && (
                    <button
                      className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 disabled:opacity-50"
                      disabled={isAvatarWorking}
                      onClick={deleteAvatar}
                      type="button"
                    >
                      Delete picture
                    </button>
                  )}
                </div>

                <p className="text-xs text-gray-500">JPG, PNG, WebP, or GIF. Maximum size: 2 MB.</p>
              </div>
            </div>
          </section>

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
