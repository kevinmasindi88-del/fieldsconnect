"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/browser";

const AVATAR_BUCKET = "profile-avatars";

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

      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase.storage.from(AVATAR_BUCKET).createSignedUrl(avatarPath, 3600);

      if (!isMounted) return;

      if (error) {
        setSignedUrl(null);
        return;
      }

      setSignedUrl(data?.signedUrl ?? null);
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
