"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/browser";

const AVATAR_BUCKET = "profile-avatars";

// Profile cards are remounted during normal navigation. Reuse a short-lived
// signed URL per account and avatar path so the browser can also reuse its
// downloaded image. Never persist signed URLs to localStorage.
const avatarUrls = new Map<string, { url: string; expiresAt: number }>();
const pendingAvatarUrls = new Map<string, Promise<string | null>>();
const AVATAR_CACHE_MS = 5 * 60 * 1000;
const AVATAR_CACHE_LIMIT = 200;

async function getAvatarSignedUrl(avatarPath: string): Promise<string | null> {
  const supabase = getSupabaseBrowserClient();
  const { data: { session } } = await supabase.auth.getSession();
  // Scope cache by account; a different signed-in member cannot reuse the
  // previous member's cached access URL.
  const key = JSON.stringify([session?.user.id ?? "anonymous", avatarPath]);
  const cached = avatarUrls.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.url;
  if (cached) avatarUrls.delete(key);

  const pending = pendingAvatarUrls.get(key);
  if (pending) return pending;

  const task = (async () => {
    const { data, error } = await supabase.storage
      .from(AVATAR_BUCKET).createSignedUrl(avatarPath, 3600);
    if (error || !data?.signedUrl) return null;

    if (avatarUrls.size >= AVATAR_CACHE_LIMIT) {
      const oldest = avatarUrls.keys().next().value;
      if (oldest !== undefined) avatarUrls.delete(oldest);
    }
    avatarUrls.set(key, {
      url: data.signedUrl,
      expiresAt: Date.now() + AVATAR_CACHE_MS,
    });
    return data.signedUrl;
  })().catch(() => null).finally(() => pendingAvatarUrls.delete(key));

  pendingAvatarUrls.set(key, task);
  return task;
}

type ProfileAvatarProps = {
  avatarPath?: string | null;
  displayName?: string | null;
  size?: number;
};

export function ProfileAvatar({ avatarPath, displayName, size = 36 }: ProfileAvatarProps) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadAvatar() {
      if (!avatarPath || !isSupabaseConfigured()) {
        setSignedUrl(null);
        return;
      }

      const url = await getAvatarSignedUrl(avatarPath);
      if (isMounted) setSignedUrl(url);
    }

    void loadAvatar();

    return () => {
      isMounted = false;
    };
  }, [avatarPath]);

  const initials = getInitials(displayName);

  return (
    <div
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-full border bg-gray-100 text-xs font-semibold text-gray-600"
      style={{ height: size, width: size }}
      aria-label={displayName ? `${displayName} profile picture` : "Profile picture"}
    >
      {signedUrl ? (
        <img alt="" className="h-full w-full object-cover" src={signedUrl} />
      ) : (
        <span>{initials}</span>
      )}
    </div>
  );
}

function getInitials(displayName?: string | null) {
  if (!displayName?.trim()) return "?";

  return displayName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}
