"use client";

import { useEffect, useRef, useState } from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/browser";
import {
  getActionErrorMessage,
  getMessageAlertClass,
} from "@/lib/action-errors";

type RoleType = "student" | "professional" | "institution";
type ProfileVisibility = "public" | "connections" | "private";
type MentorshipFrequency =
  | "weekly"
  | "fortnightly"
  | "monthly"
  | "flexible";

type MentorSettingsState = {
  mentorshipSummary: string;
  mentoringFields: string;
  mentoringLevels: RoleType[];
  maximumActiveMentees: number;
  preferredFrequency: MentorshipFrequency;
  accepts3Month: boolean;
  accepts6Month: boolean;
  accepts1Year: boolean;
  acceptsOngoing: boolean;
  isAcceptingRequests: boolean;
};

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

const initialMentorSettings: MentorSettingsState = {
  mentorshipSummary: "",
  mentoringFields: "",
  mentoringLevels: [],
  maximumActiveMentees: 3,
  preferredFrequency: "flexible",
  accepts3Month: true,
  accepts6Month: true,
  accepts1Year: true,
  acceptsOngoing: false,
  isAcceptingRequests: true,
};

const AVATAR_BUCKET = "profile-avatars";
const MAX_AVATAR_SIZE_BYTES = 2 * 1024 * 1024;
const AVATAR_OUTPUT_SIZE = 512;
const ALLOWED_AVATAR_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

type AvatarImageSource = HTMLImageElement | ImageBitmap;

function getAvatarImageDimensions(
  image: AvatarImageSource
) {
  if (image instanceof HTMLImageElement) {
    return {
      width: image.naturalWidth,
      height: image.naturalHeight,
    };
  }

  return {
    width: image.width,
    height: image.height,
  };
}

function drawCroppedAvatar(
  context: CanvasRenderingContext2D,
  image: AvatarImageSource,
  outputSize: number,
  cropX: number,
  cropY: number,
  zoom: number
) {
  const dimensions =
    getAvatarImageDimensions(image);

  const baseScale = Math.max(
    outputSize / dimensions.width,
    outputSize / dimensions.height
  );

  const scale = baseScale * zoom;
  const renderedWidth = dimensions.width * scale;
  const renderedHeight = dimensions.height * scale;

  const maxHorizontalOffset = Math.max(
    0,
    (renderedWidth - outputSize) / 2
  );

  const maxVerticalOffset = Math.max(
    0,
    (renderedHeight - outputSize) / 2
  );

  const horizontalOffset =
    ((cropX - 50) / 50) * maxHorizontalOffset;

  const verticalOffset =
    ((cropY - 50) / 50) * maxVerticalOffset;

  context.clearRect(0, 0, outputSize, outputSize);

  context.drawImage(
    image,
    (outputSize - renderedWidth) / 2 - horizontalOffset,
    (outputSize - renderedHeight) / 2 - verticalOffset,
    renderedWidth,
    renderedHeight
  );
}

async function loadAvatarImage(
  file: File
): Promise<AvatarImageSource> {
  if (
    typeof window !== "undefined" &&
    "createImageBitmap" in window
  ) {
    try {
      return await createImageBitmap(file);
    } catch {
      // Fall back to the standard browser image decoder.
    }
  }

  const objectUrl = URL.createObjectURL(file);

  try {
    const image =
      await new Promise<HTMLImageElement>(
        (resolve, reject) => {
          const element = new Image();

          element.onload = () =>
            resolve(element);

          element.onerror = () =>
            reject(
              new Error(
                "Unable to decode the selected profile picture."
              )
            );

          element.src = objectUrl;
        }
      );

    return image;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
async function createProcessedAvatarFile(
  file: File,
  cropX: number,
  cropY: number,
  zoom: number
) {
  const image = await loadAvatarImage(file);

  const canvas = document.createElement("canvas");
  canvas.width = AVATAR_OUTPUT_SIZE;
  canvas.height = AVATAR_OUTPUT_SIZE;

  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error(
      "Your browser could not prepare the profile picture."
    );
  }

  drawCroppedAvatar(
    context,
    image,
    AVATAR_OUTPUT_SIZE,
    cropX,
    cropY,
    zoom
  );

  let quality = 0.9;
  let blob: Blob | null = null;

  while (quality >= 0.5) {
    blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(
        resolve,
        "image/webp",
        quality
      );
    });

    if (
      blob &&
      blob.size <= MAX_AVATAR_SIZE_BYTES
    ) {
      break;
    }

    quality -= 0.1;
  }

  if (!blob) {
    throw new Error(
      "The profile picture could not be processed."
    );
  }

  if (blob.size > MAX_AVATAR_SIZE_BYTES) {
    throw new Error(
      "The processed profile picture is still larger than 2 MB."
    );
  }

  const processedFile = new File(
    [blob],
    "profile-avatar.webp",
    {
      type: "image/webp",
      lastModified: Date.now(),
    }
  );

  if (
    typeof ImageBitmap !== "undefined" &&
    image instanceof ImageBitmap
  ) {
    image.close();
  }

  return processedFile;
}

export function ProfileForm() {
  const [form, setForm] = useState<ProfileFormState>(initialState);
  const [mentorSettings, setMentorSettings] =
    useState<MentorSettingsState>(initialMentorSettings);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [avatarPath, setAvatarPath] = useState<string | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
  const [selectedAvatarFile, setSelectedAvatarFile] =
    useState<File | null>(null);
  const [avatarCropX, setAvatarCropX] =
    useState(50);
  const [avatarCropY, setAvatarCropY] =
    useState(50);
  const [avatarZoom, setAvatarZoom] =
    useState(1);
  const avatarCanvasRef =
    useRef<HTMLCanvasElement | null>(null);
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

        const [
          { data: profileData, error: profileError },
          { data: mentorData, error: mentorError },
        ] = await Promise.all([
          supabase
            .from("profiles")
            .select(
              "display_name, username, role_type, field, bio, profile_visibility, mentor_available, avatar_url"
            )
            .eq("id", userId)
            .maybeSingle(),
          supabase
            .from("mentor_profiles")
            .select(
              "mentorship_summary, mentoring_fields, mentoring_levels, maximum_active_mentees, preferred_frequency, accepts_3_month, accepts_6_month, accepts_1_year, accepts_ongoing, is_accepting_requests"
            )
            .eq("mentor_id", userId)
            .maybeSingle(),
        ]);

        if (profileError) throw profileError;
        if (mentorError) throw mentorError;

        if (profileData) {
          setForm({
            displayName: profileData.display_name ?? "",
            username: profileData.username ?? "",
            roleType: profileData.role_type ?? "professional",
            field: profileData.field ?? "",
            bio: profileData.bio ?? "",
            profileVisibility:
              profileData.profile_visibility ?? "public",
            mentorAvailable: Boolean(profileData.mentor_available),
          });

          setAvatarPath(profileData.avatar_url ?? null);

          if (profileData.avatar_url) {
            await refreshAvatarPreview(profileData.avatar_url);
          }
        }

        if (mentorData) {
          const loadedFrequency: MentorshipFrequency =
            mentorData.preferred_frequency === "weekly" ||
            mentorData.preferred_frequency === "fortnightly" ||
            mentorData.preferred_frequency === "monthly"
              ? mentorData.preferred_frequency
              : "flexible";

          const loadedLevels = Array.isArray(
            mentorData.mentoring_levels
          )
            ? mentorData.mentoring_levels.filter(
                (level): level is RoleType =>
                  level === "student" ||
                  level === "professional" ||
                  level === "institution"
              )
            : [];

          setMentorSettings({
            mentorshipSummary:
              mentorData.mentorship_summary ?? "",
            mentoringFields: Array.isArray(
              mentorData.mentoring_fields
            )
              ? mentorData.mentoring_fields.join(", ")
              : "",
            mentoringLevels: loadedLevels,
            maximumActiveMentees:
              mentorData.maximum_active_mentees ?? 3,
            preferredFrequency: loadedFrequency,
            accepts3Month:
              Boolean(mentorData.accepts_3_month),
            accepts6Month:
              Boolean(mentorData.accepts_6_month),
            accepts1Year:
              Boolean(mentorData.accepts_1_year),
            acceptsOngoing:
              Boolean(mentorData.accepts_ongoing),
            isAcceptingRequests:
              Boolean(mentorData.is_accepting_requests),
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

  function updateField<K extends keyof ProfileFormState>(
    key: K,
    value: ProfileFormState[K]
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updateMentorSetting<K extends keyof MentorSettingsState>(
    key: K,
    value: MentorSettingsState[K]
  ) {
    setMentorSettings((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function toggleMentoringLevel(level: RoleType) {
    setMentorSettings((current) => ({
      ...current,
      mentoringLevels: current.mentoringLevels.includes(level)
        ? current.mentoringLevels.filter(
            (currentLevel) => currentLevel !== level
          )
        : [...current.mentoringLevels, level],
    }));
  }

  function parseMentoringFields(value: string) {
    return Array.from(
      new Set(
        value
          .split(",")
          .map((field) => field.trim())
          .filter(Boolean)
      )
    );
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

  useEffect(() => {
    let cancelled = false;

    async function renderSelectedAvatar() {
      if (!selectedAvatarFile) return;

      try {
        const image =
          await loadAvatarImage(
            selectedAvatarFile
          );

        if (cancelled) return;

        const canvas =
          avatarCanvasRef.current;

        if (!canvas) return;

        const context =
          canvas.getContext("2d");

        if (!context) return;

        drawCroppedAvatar(
          context,
          image,
          canvas.width,
          avatarCropX,
          avatarCropY,
          avatarZoom
        );
      } catch {
        // Validation/upload will surface a useful
        // message if the file cannot be decoded.
      }
    }

    void renderSelectedAvatar();

    return () => {
      cancelled = true;
    };
  }, [
    selectedAvatarFile,
    avatarCropX,
    avatarCropY,
    avatarZoom,
  ]);

  function handleAvatarSelection(
    file: File | null
  ) {
    setMessage(null);

    if (!file) {
      setSelectedAvatarFile(null);
      setAvatarCropX(50);
      setAvatarCropY(50);
      setAvatarZoom(1);
      return;
    }

    const validationError =
      validateAvatarFile(file);

    if (validationError) {
      setSelectedAvatarFile(null);
      setMessage(validationError);
      return;
    }

    setSelectedAvatarFile(file);
    setAvatarCropX(50);
    setAvatarCropY(50);
    setAvatarZoom(1);
  }

  function validateAvatarFile(file: File) {
    if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
      return "Profile picture must be a JPG, PNG, WebP, or GIF image.";
    }


    return null;
  }

  async function uploadAvatar() {
    if (!currentUserId || !selectedAvatarFile || !isSupabaseConfigured()) return;

    const validationError =
      validateAvatarFile(
        selectedAvatarFile
      );

    if (validationError) {
      setMessage(validationError);
      return;
    }

    setIsAvatarWorking(true);
    setMessage(null);

    const supabase =
      getSupabaseBrowserClient();
    const oldAvatarPath = avatarPath;

    try {
      const processedAvatarFile =
        await createProcessedAvatarFile(
          selectedAvatarFile,
          avatarCropX,
          avatarCropY,
          avatarZoom
        );

      const newAvatarPath =
        `${currentUserId}/${crypto.randomUUID()}-profile-avatar.webp`;

      const { error: uploadError } =
        await supabase.storage
          .from(AVATAR_BUCKET)
          .upload(
            newAvatarPath,
            processedAvatarFile,
            {
              cacheControl: "3600",
              upsert: false,
              contentType: "image/webp",
            }
          );

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
      setAvatarCropX(50);
      setAvatarCropY(50);
      setAvatarZoom(1);
      await refreshAvatarPreview(newAvatarPath);
      setMessage(oldAvatarPath ? "Profile picture replaced. Old picture was deleted." : "Profile picture uploaded.");
    } catch (error) {
      setMessage(getActionErrorMessage(error, "upload profile picture"));
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
      setMessage(getActionErrorMessage(error, "delete profile picture"));
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

    if (form.mentorAvailable) {
      const mentoringFields = parseMentoringFields(
        mentorSettings.mentoringFields
      );

      if (mentoringFields.length === 0) {
        setMessage(
          "Add at least one field in which you can provide mentorship."
        );
        return;
      }

      if (mentorSettings.mentoringLevels.length === 0) {
        setMessage(
          "Select at least one level of mentee you are willing to mentor."
        );
        return;
      }

      if (
        !Number.isInteger(
          mentorSettings.maximumActiveMentees
        ) ||
        mentorSettings.maximumActiveMentees < 1 ||
        mentorSettings.maximumActiveMentees > 50
      ) {
        setMessage(
          "Maximum active mentees must be a whole number between 1 and 50."
        );
        return;
      }

      if (
        !mentorSettings.accepts3Month &&
        !mentorSettings.accepts6Month &&
        !mentorSettings.accepts1Year &&
        !mentorSettings.acceptsOngoing
      ) {
        setMessage(
          "Select at least one mentorship period."
        );
        return;
      }
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

      const { error: profileError } = await supabase
        .from("profiles")
        .upsert({
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

      if (profileError) throw profileError;

      if (form.mentorAvailable) {
        const { error: mentorError } = await supabase
          .from("mentor_profiles")
          .upsert({
            mentor_id: userId,
            mentorship_summary:
              mentorSettings.mentorshipSummary.trim() || null,
            mentoring_fields: parseMentoringFields(
              mentorSettings.mentoringFields
            ),
            mentoring_levels:
              mentorSettings.mentoringLevels,
            maximum_active_mentees:
              mentorSettings.maximumActiveMentees,
            preferred_frequency:
              mentorSettings.preferredFrequency,
            accepts_3_month:
              mentorSettings.accepts3Month,
            accepts_6_month:
              mentorSettings.accepts6Month,
            accepts_1_year:
              mentorSettings.accepts1Year,
            accepts_ongoing:
              mentorSettings.acceptsOngoing,
            is_accepting_requests:
              mentorSettings.isAcceptingRequests,
          });

        if (mentorError) throw mentorError;
      } else {
        const { error: mentorDisableError } = await supabase
          .from("mentor_profiles")
          .update({
            is_accepting_requests: false,
          })
          .eq("mentor_id", userId);

        if (mentorDisableError) throw mentorDisableError;
      }

      setMessage(
        form.mentorAvailable
          ? "Profile and mentor settings saved."
          : "Profile saved."
      );
    } catch (error) {
      setMessage(getActionErrorMessage(error, "save profile"));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mx-auto flex w-full min-w-0 max-w-2xl flex-col gap-4 rounded-xl border p-4 sm:p-6"
    >
      {isLoading ? (
        <p className="text-sm text-gray-600">Loading profile...</p>
      ) : (
        <>
          <section className="flex min-w-0 flex-col gap-4 rounded-xl border p-3 sm:p-4">
            <h2 className="text-lg font-semibold">
              Profile picture
            </h2>

            <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start">
              <div className="flex shrink-0 justify-center sm:justify-start">
                <div className="flex h-32 w-32 items-center justify-center overflow-hidden rounded-full border bg-gray-50 text-sm text-gray-500">
                  {selectedAvatarFile ? (
                    <canvas
                      ref={avatarCanvasRef}
                      aria-label="Selected profile picture crop preview"
                      className="h-full w-full"
                      height={256}
                      width={256}
                    />
                  ) : avatarPreviewUrl ? (
                    <img
                      alt="Profile preview"
                      className="h-full w-full object-cover"
                      src={avatarPreviewUrl}
                    />
                  ) : (
                    <span>No photo</span>
                  )}
                </div>
              </div>

              <div className="flex min-w-0 flex-1 flex-col gap-3">
                <input
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="block w-full min-w-0 max-w-full rounded-lg border px-2 py-2 text-sm"
                  type="file"
                  onChange={(event) =>
                    handleAvatarSelection(
                      event.target.files?.[0] ??
                        null
                    )
                  }
                />

                {selectedAvatarFile && (
                  <div className="grid min-w-0 gap-3 rounded-xl border bg-gray-50 p-3">
                    <p className="text-sm font-medium">
                      Choose how your picture is shown
                    </p>

                    <label className="grid min-w-0 gap-1 text-xs text-gray-600">
                      Horizontal position
                      <input
                        className="w-full"
                        max={100}
                        min={0}
                        onChange={(event) =>
                          setAvatarCropX(
                            Number(
                              event.target.value
                            )
                          )
                        }
                        type="range"
                        value={avatarCropX}
                      />
                    </label>

                    <label className="grid min-w-0 gap-1 text-xs text-gray-600">
                      Vertical position
                      <input
                        className="w-full"
                        max={100}
                        min={0}
                        onChange={(event) =>
                          setAvatarCropY(
                            Number(
                              event.target.value
                            )
                          )
                        }
                        type="range"
                        value={avatarCropY}
                      />
                    </label>

                    <label className="grid min-w-0 gap-1 text-xs text-gray-600">
                      Zoom
                      <input
                        className="w-full"
                        max={2.5}
                        min={1}
                        onChange={(event) =>
                          setAvatarZoom(
                            Number(
                              event.target.value
                            )
                          )
                        }
                        step={0.05}
                        type="range"
                        value={avatarZoom}
                      />
                    </label>
                  </div>
                )}

                <div className="grid min-w-0 gap-2 sm:flex sm:flex-wrap">
                  <button
                    className="w-full min-w-0 rounded-lg bg-black px-3 py-2 text-sm font-medium text-white disabled:opacity-50 sm:w-auto"
                    disabled={
                      !selectedAvatarFile ||
                      isAvatarWorking
                    }
                    onClick={uploadAvatar}
                    type="button"
                  >
                    {isAvatarWorking
                      ? "Processing..."
                      : avatarPath
                        ? "Replace picture"
                        : "Upload picture"}
                  </button>

                  {avatarPath && (
                    <button
                      className="w-full min-w-0 rounded-lg border border-red-300 px-3 py-2 text-sm font-medium text-red-700 disabled:opacity-50 sm:w-auto"
                      disabled={isAvatarWorking}
                      onClick={deleteAvatar}
                      type="button"
                    >
                      Delete picture
                    </button>
                  )}
                </div>

                <p className="max-w-full break-words text-xs leading-5 text-gray-500">
                  JPG, PNG, WebP, or GIF. FieldsConnect will
                  crop your selected framing to a square and
                  automatically compress the uploaded profile
                  picture to below 2 MB.
                </p>
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

          <section className="flex flex-col gap-4 rounded-xl border p-4">
            <div>
              <h2 className="text-lg font-semibold">
                Mentorship
              </h2>
              <p className="mt-1 text-sm text-gray-600">
                Make yourself discoverable to people seeking
                structured mentorship.
              </p>
            </div>

            <label className="flex gap-3 text-sm">
              <input
                type="checkbox"
                checked={form.mentorAvailable}
                onChange={() =>
                  updateField(
                    "mentorAvailable",
                    !form.mentorAvailable
                  )
                }
              />

              <span>
                <span className="font-medium">
                  I am available as a mentor
                </span>

                <span className="mt-1 block text-gray-600">
                  Your mentor information will be shown to
                  eligible FieldsConnect users.
                </span>
              </span>
            </label>

            {form.mentorAvailable && (
              <div className="flex flex-col gap-4 border-t pt-4">
                <label className="flex flex-col gap-2 text-sm font-medium">
                  Mentorship summary
                  <textarea
                    className="min-h-24 rounded-lg border px-3 py-2"
                    maxLength={1000}
                    value={mentorSettings.mentorshipSummary}
                    onChange={(event) =>
                      updateMentorSetting(
                        "mentorshipSummary",
                        event.target.value
                      )
                    }
                    placeholder="Describe your experience, approach and the support you can provide."
                  />
                  <span className="text-xs font-normal text-gray-500">
                    Optional. Maximum 1,000 characters.
                  </span>
                </label>

                <label className="flex flex-col gap-2 text-sm font-medium">
                  Mentoring fields
                  <input
                    className="rounded-lg border px-3 py-2"
                    value={mentorSettings.mentoringFields}
                    onChange={(event) =>
                      updateMentorSetting(
                        "mentoringFields",
                        event.target.value
                      )
                    }
                    placeholder="Pharmacy, Manufacturing, Leadership"
                  />
                  <span className="text-xs font-normal text-gray-500">
                    Separate multiple fields with commas.
                  </span>
                </label>

                <fieldset className="flex flex-col gap-2">
                  <legend className="text-sm font-medium">
                    Mentee levels
                  </legend>

                  <div className="grid gap-2 sm:grid-cols-3">
                    {(
                      [
                        ["student", "Students"],
                        ["professional", "Professionals"],
                        ["institution", "Institutions"],
                      ] as const
                    ).map(([level, label]) => (
                      <label
                        key={level}
                        className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={mentorSettings.mentoringLevels.includes(
                            level
                          )}
                          onChange={() =>
                            toggleMentoringLevel(level)
                          }
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                </fieldset>

                <label className="flex flex-col gap-2 text-sm font-medium">
                  Preferred contact frequency
                  <select
                    className="rounded-lg border px-3 py-2"
                    value={mentorSettings.preferredFrequency}
                    onChange={(event) =>
                      updateMentorSetting(
                        "preferredFrequency",
                        event.target.value as MentorshipFrequency
                      )
                    }
                  >
                    <option value="weekly">Weekly</option>
                    <option value="fortnightly">
                      Every two weeks
                    </option>
                    <option value="monthly">Monthly</option>
                    <option value="flexible">Flexible</option>
                  </select>
                </label>

                <label className="flex flex-col gap-2 text-sm font-medium">
                  Maximum active mentees
                  <input
                    className="rounded-lg border px-3 py-2"
                    min={1}
                    max={50}
                    step={1}
                    type="number"
                    value={mentorSettings.maximumActiveMentees}
                    onChange={(event) =>
                      updateMentorSetting(
                        "maximumActiveMentees",
                        Number(event.target.value)
                      )
                    }
                  />
                  <span className="text-xs font-normal text-gray-500">
                    Choose a whole number between 1 and 50.
                  </span>
                </label>

                <fieldset className="flex flex-col gap-2">
                  <legend className="text-sm font-medium">
                    Mentorship periods accepted
                  </legend>

                  <div className="grid gap-2 sm:grid-cols-2">
                    <label className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
                      <input
                        type="checkbox"
                        checked={mentorSettings.accepts3Month}
                        onChange={() =>
                          updateMentorSetting(
                            "accepts3Month",
                            !mentorSettings.accepts3Month
                          )
                        }
                      />
                      3 months
                    </label>

                    <label className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
                      <input
                        type="checkbox"
                        checked={mentorSettings.accepts6Month}
                        onChange={() =>
                          updateMentorSetting(
                            "accepts6Month",
                            !mentorSettings.accepts6Month
                          )
                        }
                      />
                      6 months
                    </label>

                    <label className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
                      <input
                        type="checkbox"
                        checked={mentorSettings.accepts1Year}
                        onChange={() =>
                          updateMentorSetting(
                            "accepts1Year",
                            !mentorSettings.accepts1Year
                          )
                        }
                      />
                      1 year
                    </label>

                    <label className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
                      <input
                        type="checkbox"
                        checked={mentorSettings.acceptsOngoing}
                        onChange={() =>
                          updateMentorSetting(
                            "acceptsOngoing",
                            !mentorSettings.acceptsOngoing
                          )
                        }
                      />
                      Full-time / ongoing
                    </label>
                  </div>
                </fieldset>

                <label className="flex gap-3 rounded-lg border px-3 py-3 text-sm">
                  <input
                    type="checkbox"
                    checked={mentorSettings.isAcceptingRequests}
                    onChange={() =>
                      updateMentorSetting(
                        "isAcceptingRequests",
                        !mentorSettings.isAcceptingRequests
                      )
                    }
                  />

                  <span>
                    <span className="font-medium">
                      Accept new mentorship requests
                    </span>

                    <span className="mt-1 block text-gray-600">
                      Turn this off temporarily without removing
                      your mentor information.
                    </span>
                  </span>
                </label>
              </div>
            )}
          </section>

          <button
            className="w-fit rounded-lg bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            type="submit"
            disabled={isSaving}
          >
            {isSaving ? "Saving..." : "Save profile"}
          </button>
        </>
      )}

      {message && <p className={getMessageAlertClass(message)}>{message}</p>}
    </form>
  );
}
