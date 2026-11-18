"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/browser";

type LinkPreview = { url: string; title: string; description?: string; image?: string; domain: string; facebookEmbedUrl?: string; facebookEmbedKind?: "post" | "video"; tiktokValidation?: "valid" | "unavailable" | "unknown" };

function isFacebookLink(rawUrl: string | null): boolean {
  if (!rawUrl) return false;
  try {
    const hostname = new URL(rawUrl).hostname.toLowerCase();
    return ["facebook.com", "www.facebook.com", "m.facebook.com",
      "web.facebook.com", "mbasic.facebook.com", "fb.watch", "www.fb.watch",
      "fb.com", "www.fb.com"].includes(hostname);
  } catch { return false; }
}

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
  provider: "YouTube" | "Vimeo" | "TikTok" | "Instagram" | "Facebook";
  playerUrl: string;
  thumbnailUrl?: string;
  vertical?: boolean;
  displayLabel?: string;
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
      playerUrl: "https://www.youtube-nocookie.com/embed/" + youtubeId + "?rel=0&controls=1&fs=1&playsinline=1",
      thumbnailUrl: "https://i.ytimg.com/vi/" + youtubeId + "/hqdefault.jpg",
      vertical: segments.length === 2 && segments[0] === "shorts",
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
      playerUrl: "https://player.vimeo.com/video/" + vimeoId + "?dnt=1&autoplay=0",
    };
  }

  // TikTok's official player supports public video IDs from standard post URLs.
  // Short share links with no media ID fall back to the existing link card.
  if (["tiktok.com", "www.tiktok.com", "m.tiktok.com"].includes(host)) {
    let videoId: string | null = null;
    if (segments.length === 3 && segments[0].startsWith("@") && segments[1] === "video") {
      videoId = segments[2];
    } else if (segments.length === 3 && segments[0] === "player" && segments[1] === "v1") {
      videoId = segments[2];
    }
    if (videoId && /^[0-9]{15,23}$/.test(videoId)) {
      return {
        provider: "TikTok",
        playerUrl: "https://www.tiktok.com/player/v1/" + videoId + "?autoplay=0",
        vertical: true,
      };
    }
  }

  // Official Instagram embed pages can show eligible public Reels and media
  // posts. A /p/ URL may be a video, image, or carousel.
  if (["instagram.com", "www.instagram.com", "m.instagram.com"].includes(host)) {
    const kind = segments[0] === "reels" ? "reel" : segments[0];
    const shortcode = segments.length === 2 ? segments[1] : null;
    if (
      ["reel", "p", "tv"].includes(kind) &&
      shortcode && /^[a-zA-Z0-9_-]{5,30}$/.test(shortcode)
    ) {
      return {
        provider: "Instagram",
        playerUrl: "https://www.instagram.com/" + kind + "/" + shortcode + "/embed/",
        vertical: true,
        displayLabel: kind === "reel" ? "Instagram Reel" : "Instagram post",
      };
    }
  }

  // Facebook's official video plugin accepts the public video URL as its href.
  // Restrict to known Reel, Watch and video permalink shapes.
  if (["facebook.com", "www.facebook.com", "m.facebook.com", "web.facebook.com"].includes(host)) {
    let publicVideoUrl: string | null = null;
    let isReel = false;
    if (segments.length === 2 && segments[0] === "reel" && /^[0-9]{5,25}$/.test(segments[1])) {
      publicVideoUrl = "https://www.facebook.com/reel/" + segments[1] + "/";
      isReel = true;
    } else if ((url.pathname === "/watch/" || url.pathname === "/watch" || url.pathname === "/video.php")) {
      const videoId = url.searchParams.get("v");
      if (videoId && /^[0-9]{5,25}$/.test(videoId)) {
        publicVideoUrl = "https://www.facebook.com/watch/?v=" + videoId;
      }
    } else if (segments.length >= 2 && segments.length <= 4 && segments[segments.length - 2] === "videos") {
      const videoId = segments[segments.length - 1];
      const author = segments.slice(0, -2);
      if (
        /^[0-9]{5,25}$/.test(videoId) &&
        author.every((part) => /^[a-zA-Z0-9_.-]{1,100}$/.test(part))
      ) {
        publicVideoUrl = "https://www.facebook.com/" +
          [...author, "videos", videoId].join("/") + "/";
      }
    }
    if (publicVideoUrl) {
      return {
        provider: "Facebook",
        playerUrl: "https://www.facebook.com/plugins/video.php?href=" +
          encodeURIComponent(publicVideoUrl) + "&show_text=false&width=560",
        vertical: isReel,
        displayLabel: isReel ? "Facebook Reel" : "Facebook video",
      };
    }
  }

  return null;
}


function ExternalVideoCard({ video, preview, originalUrl }: { video: ExternalVideo; preview: LinkPreview | null; originalUrl: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [failed, setFailed] = useState(false);
  const isTikTok = video.provider === "TikTok";
  const unavailable = isTikTok && (failed || preview?.tiktokValidation === "unavailable");

  useEffect(() => {
    if (!isTikTok) return;
    // TikTok officially reports player failures through postMessage. Check
    // origin and iframe source so other embedded content cannot trigger this.
    const handleTikTokMessage = (event: MessageEvent) => {
      if (event.origin !== "https://www.tiktok.com" ||
          event.source !== iframeRef.current?.contentWindow) return;
      const data: unknown = event.data;
      if (!data || typeof data !== "object") return;
      const msg = data as { type?: unknown; value?: unknown; "x-tiktok-player"?: unknown };
      if (msg["x-tiktok-player"] !== true || msg.type !== "onPlayerError") return;
      const detail = msg.value;
      if (!detail || typeof detail !== "object") return;
      const error = detail as { errorCode?: unknown };
      // INVALID_VIDEO, SERVER_ERROR, PLAYBACK_ERROR. Autoplay denial does
      // not mean the video is unavailable and must not replace the player.
      if ([1001, 2001, 3001].includes(Number(error.errorCode))) setFailed(true);
    };
    window.addEventListener("message", handleTikTokMessage);
    return () => window.removeEventListener("message", handleTikTokMessage);
  }, [isTikTok]);

  useEffect(() => {
    // ESC exits browser fullscreen; keep the inline layout in sync.
    const onFullscreenChange = () => {
      if (document.fullscreenElement !== containerRef.current) setExpanded(false);
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  useEffect(() => {
    if (!expanded) return;
    // On devices without Element Fullscreen API, the viewport overlay still
    // provides an enlarged player and can be dismissed with Escape.
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setExpanded(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [expanded]);

  async function expandVideo() {
    setExpanded(true);
    try {
      await containerRef.current?.requestFullscreen?.();
    } catch {
      // Keep the viewport-sized fallback when fullscreen is unavailable/denied.
    }
  }

  async function collapseVideo() {
    if (document.fullscreenElement === containerRef.current) {
      try {
        await document.exitFullscreen();
      } catch {
        // Also allow the CSS overlay to close if the browser denies exit.
      }
    }
    setExpanded(false);
  }

  // Keep the full video visible: standard clips are 16:9; Shorts and Reels
  // are 9:16. The iframe itself fills the box without object-cover cropping.
  const inlineRatio = video.vertical
    ? "mx-auto aspect-[9/16] max-w-[380px]"
    : "aspect-video";

  return (
    <div className="min-w-0 w-full overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div
        ref={containerRef}
        className={expanded
          ? "fixed inset-0 z-[100] flex items-center justify-center bg-black"
          : "min-w-0 w-full"}
      >
        <div className={expanded
          ? "relative h-full w-full bg-black"
          : "relative w-full overflow-hidden bg-black " + inlineRatio}
        >
        {!unavailable ? (
        <iframe
          ref={iframeRef}
          title={video.provider + " video player"}
          src={video.playerUrl}
          className="absolute inset-0 h-full w-full border-0"
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-gray-950 px-5 text-center text-white">
            {preview?.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview.image} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover opacity-25" />
            )}
            <p className="relative text-sm font-medium sm:text-base">
              This TikTok video isn't available to play here.
            </p>
            <a
              className="relative rounded-lg bg-white px-4 py-2 text-sm font-semibold text-gray-950 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              href={originalUrl}
              target="_blank"
              rel="noopener noreferrer nofollow"
            >
              Watch on TikTok
            </a>
          </div>
        )}
        {!unavailable && <button
          aria-label={expanded ? "Close expanded video" : "Expand video"}
          title={expanded ? "Close expanded video" : "Expand video"}
          type="button"
          onClick={() => { void (expanded ? collapseVideo() : expandVideo()); }}
          className="absolute right-2 top-2 z-10 flex h-9 w-9 items-center justify-center rounded-lg bg-black/65 text-white shadow-sm transition hover:bg-black/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          {expanded ? (
            <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 6 18 18M18 6 6 18" />
            </svg>
          ) : (
            <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5" />
            </svg>
          )}
        </button>}
        </div>
      </div>
      <div className="flex min-w-0 flex-col gap-1 px-3 py-3">
        <p className="line-clamp-2 break-words text-sm font-semibold text-gray-900">
          {preview?.title || video.displayLabel || video.provider + " video"}
        </p>
        {preview?.description && (
          <p className="line-clamp-2 break-words text-xs leading-relaxed text-gray-600">
            {preview.description}
          </p>
        )}
        <p className="truncate text-xs text-gray-500">{preview?.domain || video.provider}</p>
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
  const isFacebook = isFacebookLink(targetLink);
  // Meta-validated share/v, share/r and fb.watch links do not always contain
  // a raw video ID. Use Meta's own video player when public oEmbed succeeds.
  const facebookSharedVideo = preview?.facebookEmbedKind === "video" && preview.facebookEmbedUrl
    ? {
        provider: "Facebook" as const,
        playerUrl: preview.facebookEmbedUrl,
        displayLabel: "Facebook video",
        vertical: Boolean(targetLink && /\/share\/r\//i.test(targetLink)),
      }
    : null;
  const externalVideo = getExternalVideo(targetLink) ?? facebookSharedVideo;

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
    // Request safe, authenticated link metadata for both normal links and
    // recognized videos so embedded players retain the same rich preview text.
    if (!targetLink || !targetLink.startsWith("https://")) return;
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
  }, [targetLink]);

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
        <ExternalVideoCard key={targetLink} video={externalVideo} preview={preview} originalUrl={targetLink} />
      )}
      {targetLink && !externalVideo && preview?.facebookEmbedKind === "post" && preview.facebookEmbedUrl && (
        <div className="min-w-0 overflow-hidden rounded-xl border border-gray-200 bg-white">
          {/* This source is constructed by our server only after Meta validates a public post. */}
          <iframe
            title="Facebook post preview"
            src={preview.facebookEmbedUrl}
            className="h-[480px] w-full border-0"
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
            allow="encrypted-media; picture-in-picture"
          />
          <a href={targetLink} target="_blank" rel="noopener noreferrer nofollow" className="block min-w-0 truncate border-t border-gray-100 px-3 py-2 text-xs font-medium text-blue-700 hover:underline">
            Facebook post · View source
          </a>
        </div>
      )}
      {targetLink && !externalVideo && !(preview?.facebookEmbedKind === "post" && preview.facebookEmbedUrl) && (
        <a href={targetLink} target="_blank" rel="noopener noreferrer nofollow" className="group block min-w-0 overflow-hidden rounded-xl border bg-gray-50 transition hover:border-blue-300 hover:bg-blue-50">
          {preview?.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview.image} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" className="max-h-48 w-full object-cover" />
          ) : isFacebook ? (
            <div className="flex h-28 items-center justify-center bg-[#eef3ff] text-[#1877f2]" aria-hidden="true">
              <svg viewBox="0 0 24 24" className="h-12 w-12" fill="currentColor">
                <path d="M22 12a10 10 0 1 0-11.56 9.88v-6.98H7.9V12h2.54V9.8c0-2.5 1.49-3.89 3.77-3.89 1.1 0 2.25.2 2.25.2v2.47h-1.27c-1.24 0-1.63.77-1.63 1.56V12h2.77l-.44 2.9h-2.33v6.98A10 10 0 0 0 22 12Z"/>
              </svg>
            </div>
          ) : null}
          <div className="flex flex-col gap-1 p-3">
            <span className="line-clamp-2 text-sm font-semibold text-gray-900 group-hover:text-blue-700">
              {preview?.title || (isFacebook ? "Facebook post" : "Open external link")}
            </span>
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
