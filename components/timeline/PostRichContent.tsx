"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/browser";

type LinkPreview = { url: string; title: string; description?: string; image?: string; domain: string };

export function extractFirstPostUrl(body: string): string | null {
  const match = body.match(/https?:\/\/[^\s<>"']+/i);
  if (!match) return null;
  const candidate = match[0].replace(/[),.;!?]+$/, "");
  try {
    const parsed = new URL(candidate);
    if (!["https:", "http:"].includes(parsed.protocol)) return null;
    return parsed.href.slice(0, 2048);
  } catch { return null; }
}


type ExternalVideo = {
  provider: "YouTube" | "Vimeo";
  playerUrl: string;
  thumbnailUrl?: string;
};

// Only recognized HTTPS links from exact provider hostnames become iframes.
// Video IDs are validated and never inserted into iframe HTML.
export function getExternalVideo(rawUrl: string | null): ExternalVideo | null {
  if (!rawUrl) return null;
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port) return null;

  const host = url.hostname.toLowerCase();
  const segments = url.pathname.split("/").filter(Boolean);
  let youtubeId: string | null = null;

  if (host === "youtu.be" || host === "www.youtu.be") {
    if (segments.length === 1) youtubeId = segments[0];
  } else if (["youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com", "www.youtube-nocookie.com", "youtube-nocookie.com"].includes(host)) {
    if (url.pathname === "/watch") {
      youtubeId = url.searchParams.get("v");
    } else if (
      segments.length === 2 &&
      ["shorts", "live", "embed"].includes(segments[0])
    ) {
      youtubeId = segments[1];
    }
  }

  if (youtubeId && /^[a-zA-Z0-9_-]{11}$/.test(youtubeId)) {
    return {
      provider: "YouTube",
      playerUrl: "https://www.youtube-nocookie.com/embed/" + youtubeId + "?rel=0&autoplay=1",
      thumbnailUrl: "https://i.ytimg.com/vi/" + youtubeId + "/hqdefault.jpg",
    };
  }

  let vimeoId: string | null = null;
  if (host === "vimeo.com" || host === "www.vimeo.com") {
    if (segments.length === 1) vimeoId = segments[0];
  } else if (host === "player.vimeo.com") {
    if (segments.length === 2 && segments[0] === "video") vimeoId = segments[1];
  }

  if (vimeoId && /^[0-9]{1,12}$/.test(vimeoId)) {
    return {
      provider: "Vimeo",
      playerUrl: "https://player.vimeo.com/video/" + vimeoId + "?dnt=1&autoplay=1",
    };
  }

  return null;
}

function ExternalVideoCard({
  video, originalUrl, preview,
}: { video: ExternalVideo; originalUrl: string; preview: LinkPreview | null }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const thumbnail = video.thumbnailUrl ?? preview?.image;

  return (
    <div className="min-w-0 overflow-hidden rounded-xl border border-gray-200 bg-white">
      {isPlaying ? (
        <div className="relative aspect-video w-full bg-black">
          <iframe
            className="absolute inset-0 h-full w-full"
            title={video.provider + " video player"}
            src={video.playerUrl}
            loading="lazy"
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
      ) : (
        <button
          type="button"
          aria-label={"Play " + video.provider + " video"}
          className="group relative flex aspect-video w-full items-center justify-center overflow-hidden bg-gray-900 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500"
          onClick={() => setIsPlaying(true)}
        >
          {thumbnail && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thumbnail} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" className="absolute inset-0 h-full w-full object-cover opacity-80 transition-opacity group-hover:opacity-95" />
          )}
          <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-black/75 shadow-lg transition-transform group-hover:scale-105" aria-hidden="true">
            <svg className="ml-1 h-8 w-8" viewBox="0 0 24 24" fill="currentColor"><path d="m7 4 14 8-14 8V4Z" /></svg>
          </span>
          <span className="absolute bottom-3 left-3 rounded bg-black/75 px-2 py-1 text-xs font-medium text-white">Play from {video.provider}</span>
        </button>
      )}
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 px-3 py-2.5">
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-900">{preview?.title ?? video.provider + " video"}</span>
        {isPlaying && (
          <button type="button" className="text-xs font-medium text-gray-600 underline underline-offset-2 hover:text-gray-950" onClick={() => setIsPlaying(false)}>Close player</button>
        )}
        <a href={originalUrl} target="_blank" rel="noopener noreferrer nofollow" className="shrink-0 text-xs font-medium text-blue-700 underline underline-offset-2 hover:text-blue-900">Open on {video.provider}</a>
      </div>
    </div>
  );
}

export type MentionIdentity = { id: string; display_name: string };

export function MentionedText({ text, mentions = [] }: { text: string; mentions?: MentionIdentity[] }) {
  const names = mentions.filter((person) => person.display_name.trim());
  if (!names.length) return <>{text}</>;
  const parts: React.ReactNode[] = [];
  let position = 0;
  while (position < text.length) {
    let first = text.length;
    let matched: MentionIdentity | null = null;
    for (const person of names) {
      const label = "@" + person.display_name;
      let location = text.indexOf(label, position);
      while (location !== -1) {
        const preceding = location === 0 ? "" : text[location - 1];
        const following = text[location + label.length] ?? "";
        if ((!preceding || /[^\p{L}\p{N}_]/u.test(preceding)) &&
            (!following || /[^\p{L}\p{N}_]/u.test(following))) break;
        location = text.indexOf(label, location + label.length);
      }
      if (location !== -1 && location < first) {
        first = location;
        matched = person;
      }
    }
    if (!matched) {
      parts.push(text.slice(position));
      break;
    }
    if (first > position) parts.push(text.slice(position, first));
    const label = "@" + matched.display_name;
    parts.push(<Link key={parts.length} className="font-medium text-blue-700 hover:underline" href={`/profile/${matched.id}`}>{label}</Link>);
    position = first + label.length;
  }
  return <>{parts}</>;
}

function LinkedText({ body, hidePreviewUrl, mentionedProfiles = [] }: { body: string; hidePreviewUrl?: string | null; mentionedProfiles?: MentionIdentity[] }) {
  // Only the URL represented by a successful card is hidden. All other links
  // and the surrounding message remain visible and clickable.
  const displayBody = hidePreviewUrl
    ? body.replace(/https?:\/\/[^\s<>"']+/gi, (candidate) =>
        extractFirstPostUrl(candidate) === hidePreviewUrl
          ? (candidate.match(/[),.;!?]+$/)?.[0] ?? "")
          : candidate
      ).trim()
    : body;
  const pieces = displayBody.split(/(https?:\/\/[^\s<>"']+)/gi);
  return (
    <span className="whitespace-pre-wrap break-words">
      {pieces.map((piece, i) => {
        const url = extractFirstPostUrl(piece);
        if (!url || !/^https?:\/\//i.test(piece)) return <span key={i}><MentionedText text={piece} mentions={mentionedProfiles} /></span>;
        const trailing = piece.match(/[),.;!?]+$/)?.[0] ?? "";
        return (
          <span key={i}>
            <a href={url} target="_blank" rel="noopener noreferrer nofollow" className="break-all font-medium text-blue-700 underline underline-offset-2 hover:text-blue-900">{piece.slice(0, piece.length - trailing.length)}</a>
            {trailing}
          </span>
        );
      })}
    </span>
  );
}

export function PostRichContent({
  body, imagePath, linkUrl, mentionedProfiles = [],
}: { body: string; imagePath?: string | null; linkUrl?: string | null; mentionedProfiles?: MentionIdentity[] }) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [preview, setPreview] = useState<LinkPreview | null>(null);
  const [expanded, setExpanded] = useState(false);
  const targetLink = linkUrl ?? extractFirstPostUrl(body);
  const externalVideo = getExternalVideo(targetLink);

  useEffect(() => {
    let cancelled = false;
    setImageUrl(null);
    if (!imagePath || !isSupabaseConfigured()) return;
    const supabase = getSupabaseBrowserClient();
    void supabase.storage.from("timeline-images").createSignedUrl(imagePath, 3600)
      .then(({ data, error }) => {
        if (!cancelled && !error) setImageUrl(data?.signedUrl ?? null);
      });
    return () => { cancelled = true; };
  }, [imagePath]);

  useEffect(() => {
    let cancelled = false;
    setPreview(null);
    if (!targetLink || !targetLink.startsWith("https://") || externalVideo?.provider === "YouTube") return;
    if (!isSupabaseConfigured()) return;
    const supabase = getSupabaseBrowserClient();
    void supabase.auth.getSession().then(({ data }) => {
      const token = data.session?.access_token;
      if (!token || cancelled) return null;
      return fetch(`/api/link-preview?url=${encodeURIComponent(targetLink)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
    }).then((response) => response?.ok ? response.json() : null)
      .then((data: LinkPreview | null) => { if (!cancelled) setPreview(data); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [targetLink, externalVideo?.provider]);

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="text-sm leading-relaxed text-gray-800">
        <LinkedText body={body} hidePreviewUrl={(preview || externalVideo) ? targetLink : null} mentionedProfiles={mentionedProfiles} />
      </div>
      {imageUrl && (
        <>
          <button className="block overflow-hidden rounded-xl border bg-gray-50 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600" type="button" aria-label="Expand post image" onClick={() => setExpanded(true)}>
            {/* User-uploaded image served through a short-lived, authorized Storage URL. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl} alt="Image attached to this post" loading="lazy" decoding="async" className="mx-auto max-h-[440px] w-full object-contain" />
          </button>
          {expanded && (
            <div role="dialog" aria-modal="true" aria-label="Post image" className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4" onClick={() => setExpanded(false)}>
              <button className="absolute right-4 top-4 rounded-lg bg-white px-3 py-2 text-sm font-medium text-gray-900" type="button" onClick={() => setExpanded(false)}>Close image</button>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageUrl} alt="Expanded post attachment" className="max-h-[88vh] max-w-full object-contain" onClick={(event) => event.stopPropagation()} />
            </div>
          )}
        </>
      )}
      {targetLink && externalVideo && (
        <ExternalVideoCard key={targetLink} video={externalVideo} originalUrl={targetLink} preview={preview} />
      )}
      {targetLink && !externalVideo && (
        <a href={targetLink} target="_blank" rel="noopener noreferrer nofollow" className="group block min-w-0 overflow-hidden rounded-xl border bg-gray-50 transition hover:border-blue-300 hover:bg-blue-50">
          {preview?.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview.image} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" className="max-h-48 w-full object-cover" />
          )}
          <div className="flex flex-col gap-1 p-3">
            <span className="line-clamp-2 text-sm font-semibold text-gray-900 group-hover:text-blue-700">{preview?.title ?? "Open external link"}</span>
            {preview?.description && <span className="line-clamp-2 text-xs text-gray-600">{preview.description}</span>}
            <span className="truncate text-xs text-blue-700">{preview?.domain ?? (() => { try { return new URL(targetLink).hostname; } catch { return targetLink; } })()} · Visit link ↗</span>
          </div>
        </a>
      )}
    </div>
  );
}

export async function compressTimelineImage(file: File): Promise<Blob> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("Use a JPEG, PNG or WebP image.");
  if (file.size > 12 * 1024 * 1024) throw new Error("Choose an image smaller than 12 MB.");
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("This browser cannot compress images.");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    let compressed: Blob | null = null;
    for (const quality of [0.8, 0.68, 0.55, 0.42]) {
      compressed = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
      if (compressed && compressed.size <= 300 * 1024) break;
    }
    if (!compressed || compressed.size > 2 * 1024 * 1024) throw new Error("Unable to compress this image under 2 MB.");
    return compressed;
  } finally {
    bitmap.close();
  }
}
