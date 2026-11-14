"use client";

import { useEffect, useState } from "react";
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

function LinkedText({ body, hidePreviewUrl }: { body: string; hidePreviewUrl?: string | null }) {
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
        if (!url || !/^https?:\/\//i.test(piece)) return <span key={i}>{piece}</span>;
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
  body, imagePath, linkUrl,
}: { body: string; imagePath?: string | null; linkUrl?: string | null }) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [preview, setPreview] = useState<LinkPreview | null>(null);
  const [expanded, setExpanded] = useState(false);
  const targetLink = linkUrl ?? extractFirstPostUrl(body);

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
        <LinkedText body={body} hidePreviewUrl={preview ? targetLink : null} />
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
      {targetLink && (
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
