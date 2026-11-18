import { NextRequest, NextResponse } from "next/server";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function publicAddress(address: string): boolean {
  if (isIP(address) === 4) {
    const n = address.split(".").map(Number);
    if (n[0] === 0 || n[0] === 10 || n[0] === 127 || n[0] >= 224) return false;
    if (n[0] === 169 && n[1] === 254) return false;
    if (n[0] === 172 && n[1] >= 16 && n[1] <= 31) return false;
    if (n[0] === 192 && (n[1] === 168 || (n[1] === 0 && n[2] === 0))) return false;
    if (n[0] === 100 && n[1] >= 64 && n[1] <= 127) return false;
    if (n[0] === 198 && (n[1] === 18 || n[1] === 19)) return false;
    return true;
  }
  if (isIP(address) === 6) {
    const n = address.toLowerCase();
    if (n === "::1" || n === "::" || n.startsWith("fc") || n.startsWith("fd") || n.startsWith("fe8") || n.startsWith("fe9") || n.startsWith("fea") || n.startsWith("feb")) return false;
    if (n.startsWith("::ffff:")) return publicAddress(n.slice(7));
    return n.startsWith("2") || n.startsWith("3");
  }
  return false;
}

function safeUrl(value: string): URL | null {
  try {
    if (value.length > 2048) return null;
    const url = new URL(value);
    if (url.protocol !== "https:" || url.port || url.username || url.password) return null;
    if (url.hostname === "localhost" || url.hostname.endsWith(".local") || url.hostname.endsWith(".internal") || url.hostname.endsWith(".test") || !url.hostname.includes(".")) return null;
    if (isIP(url.hostname)) return null;
    return url;
  } catch { return null; }
}

function htmlDecode(value: string): string {
  return value.replace(/&(?:amp|quot|apos|lt|gt|#(\d+)|#x([a-f0-9]+));/gi, (match, decimal, hex) => {
    if (decimal || hex) {
      const code = Number.parseInt(decimal || hex, hex ? 16 : 10);
      return code > 0 && code < 0x110000 ? String.fromCodePoint(code) : "";
    }
    return ({ "&amp;": "&", "&quot;": "\"", "&apos;": "'", "&lt;": "<", "&gt;": ">" } as Record<string,string>)[match.toLowerCase()] ?? match;
  }).replace(/\s+/g, " ").trim().slice(0, 240);
}

function metaTags(html: string): Record<string, string> {
  const tags: Record<string, string> = {};
  for (const tag of html.match(/<meta\s+[^>]*>/gi) ?? []) {
    const attr: Record<string, string> = {};
    for (const m of tag.matchAll(/([a-z-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)) attr[m[1].toLowerCase()] = m[2] ?? m[3] ?? "";
    const key = (attr.property ?? attr.name ?? "").toLowerCase();
    if (key && attr.content) tags[key] = htmlDecode(attr.content);
  }
  return tags;
}


/**
 * YouTube sometimes blocks ordinary server-side page previews. Fall back to
 * its public oEmbed metadata, which provides the real title and channel name.
 * This never fetches a user-controlled URL: only a validated video ID is
 * passed to YouTube's fixed official endpoint.
 */
async function youtubeOembedFallback(target: URL): Promise<NextResponse> {
  const unavailable = () => NextResponse.json({ error: "Preview unavailable" }, { status: 422 });
  const host = target.hostname.toLowerCase();
  const segments = target.pathname.split("/").filter(Boolean);
  let id: string | null = null;
  if (["youtu.be", "www.youtu.be"].includes(host) && segments.length === 1) {
    id = segments[0];
  } else if (["youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com", "youtube-nocookie.com", "www.youtube-nocookie.com"].includes(host)) {
    if (target.pathname === "/watch") id = target.searchParams.get("v");
    if (segments.length === 2 && ["shorts", "live", "embed"].includes(segments[0])) id = segments[1];
  }
  if (!id || !/^[a-zA-Z0-9_-]{11}$/.test(id)) return unavailable();

  try {
    const videoUrl = "https://www.youtube.com/watch?v=" + id;
    const endpoint = "https://www.youtube.com/oembed?format=json&url=" + encodeURIComponent(videoUrl);
    const response = await fetch(endpoint, {
      redirect: "manual",
      signal: AbortSignal.timeout(4000),
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!response.ok || !(response.headers.get("content-type") ?? "").includes("json")) return unavailable();
    const metadata = await response.json() as { title?: unknown; author_name?: unknown };
    if (typeof metadata.title !== "string" || !metadata.title.trim()) return unavailable();
    const title = metadata.title.trim().slice(0, 240);
    // oEmbed exposes creator attribution, but not the video's full description.
    const description = typeof metadata.author_name === "string" && metadata.author_name.trim()
      ? "By " + metadata.author_name.trim().slice(0, 150)
      : "";
    return NextResponse.json({
      url: target.href,
      domain: target.hostname,
      title,
      description,
      image: "https://i.ytimg.com/vi/" + id + "/hqdefault.jpg",
    }, { headers: { "Cache-Control": "private, max-age=3600" } });
  } catch {
    return unavailable();
  }
}


/**
 * Public Facebook posts and videos may not expose Open Graph metadata to
 * crawlers. Meta's tokenless oEmbed can validate public posts (June 2026+).
 * Never return provider HTML or fetch a user-specified redirect.
 */
function facebookContentKind(url: URL): "post" | "video" | "link" | null {
  const host = url.hostname.toLowerCase();
  if (!["facebook.com", "www.facebook.com", "m.facebook.com", "web.facebook.com",
        "mbasic.facebook.com", "fb.watch", "www.fb.watch", "fb.com", "www.fb.com"].includes(host)) return null;
  const parts = url.pathname.toLowerCase().split("/").filter(Boolean);
  if (host === "fb.watch" || host === "www.fb.watch") return "video";
  if (["reel", "watch", "videos", "video.php"].includes(parts[0]) ||
      parts.includes("videos") || (parts[0] === "share" && ["v", "r"].includes(parts[1]))) return "video";
  if (["permalink.php", "story.php", "posts"].includes(parts[0]) ||
      parts.includes("posts") || (parts[0] === "share" && parts[1] === "p")) return "post";
  return "link";
}

async function facebookPreviewFallback(url: URL): Promise<NextResponse> {
  const kind = facebookContentKind(url);
  if (!kind) return NextResponse.json({ error: "Preview unavailable" }, { status: 422 });
  let verifiedEmbed = false;
  if (kind !== "link") {
    try {
      // The endpoint is fixed and only the already validated Facebook URL is a parameter.
      const endpoint = "https://graph.facebook.com/v27.0/oembed_" + kind +
        "?url=" + encodeURIComponent(url.href) + "&maxwidth=500";
      const response = await fetch(endpoint, {
        redirect: "manual",
        signal: AbortSignal.timeout(3500),
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      if (response.ok && (response.headers.get("content-type") ?? "").includes("json")) {
        const payload = await response.json() as { html?: unknown; provider_name?: unknown };
        verifiedEmbed = typeof payload.html === "string" && payload.html.length > 0 &&
          payload.provider_name === "Facebook";
      }
    } catch {
      // Normal fallback still provides a useful, clickable preview.
    }
  }
  const label = kind === "video" ? "Facebook video" :
                kind === "post" ? "Facebook post" : "Facebook link";
  // Only confirmed public posts get a Facebook embed; private or unsupported
  // links remain clickable cards, never a blank iframe.
  const facebookEmbedUrl = verifiedEmbed
    ? "https://www.facebook.com/plugins/" + (kind === "video" ? "video.php" : "post.php") +
      "?href=" + encodeURIComponent(url.href) +
      (kind === "video" ? "&show_text=false&width=500" : "&show_text=true&width=500")
    : undefined;
  return NextResponse.json({
    url: url.href,
    domain: url.hostname,
    title: label,
    description: "View on Facebook",
    facebookEmbedUrl,
    facebookEmbedKind: facebookEmbedUrl ? kind : undefined,
    fallback: true,
  }, { headers: { "Cache-Control": "private, max-age=900" } });
}


/**
 * Fetch the actual TikTok video's metadata rather than the generic
 * "TikTok - Make Your Day" homepage title. The URL is validated by safeUrl,
 * and requests only go to TikTok's fixed official oEmbed endpoint.
 */
async function tiktokVideoPreview(target: URL): Promise<NextResponse> {
  const originalHost = target.hostname.toLowerCase();
  const path = target.pathname.split("/").filter(Boolean);
  const isShort = ["vt.tiktok.com", "vm.tiktok.com"].includes(originalHost);
  const isVideo = (path.length === 3 && path[0].startsWith("@") && ["video", "photo"].includes(path[1])) ||
    (path.length === 3 && path[0] === "player" && path[1] === "v1");
  if (!isShort && !isVideo) {
    return NextResponse.json({ error: "Not a TikTok video URL" }, { status: 422 });
  }

  const id = isShort ? null : path[2];
  if (id && !/^[0-9]{15,23}$/.test(id)) {
    return NextResponse.json({ error: "Invalid TikTok media ID" }, { status: 422 });
  }

  const fallback = (status: "unknown" | "unavailable") => NextResponse.json({
    url: target.href,
    domain: "tiktok.com",
    title: "TikTok video",
    description: "",
    tiktokValidation: status,
  }, { headers: { "Cache-Control": "private, max-age=600" } });

  try {
    // A canonical post URL is best, while TikTok's oEmbed also accepts
    // standard user share URLs. No arbitrary host is fetched.
    const videoUrl = new URL(target.href);
    videoUrl.search = "";
    videoUrl.hash = "";
    const endpoint = "https://www.tiktok.com/oembed?url=" + encodeURIComponent(videoUrl.href);
    const response = await fetch(endpoint, {
      redirect: "manual",
      signal: AbortSignal.timeout(4500),
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (response.status === 404 || response.status === 400) {
      return fallback("unavailable");
    }
    if (!response.ok || !(response.headers.get("content-type") ?? "").includes("json")) {
      // Transient TikTok/API restrictions are not proof that the video is gone.
      return fallback("unknown");
    }

    const data = await response.json() as {
      title?: unknown; author_name?: unknown; thumbnail_url?: unknown;
      provider_name?: unknown; embed_product_id?: unknown;
    };
    if (data.provider_name && data.provider_name !== "TikTok") return fallback("unknown");
    if (id && typeof data.embed_product_id === "string" && data.embed_product_id !== id) {
      return fallback("unknown");
    }
    const title = typeof data.title === "string" && data.title.trim()
      ? data.title.trim().slice(0, 240)
      : "TikTok video";
    const description = typeof data.author_name === "string" && data.author_name.trim()
      ? "By " + data.author_name.trim().slice(0, 150)
      : "";
    let image: string | undefined;
    if (typeof data.thumbnail_url === "string") {
      try {
        const thumbnail = new URL(data.thumbnail_url);
        if (thumbnail.protocol === "https:" && !thumbnail.username && !thumbnail.password &&
            !thumbnail.port && !isIP(thumbnail.hostname)) image = thumbnail.href;
      } catch {}
    }
    return NextResponse.json({
      url: target.href,
      domain: "tiktok.com",
      title,
      description,
      image,
      tiktokValidation: "valid",
    }, { headers: { "Cache-Control": "private, max-age=3600" } });
  } catch {
    return fallback("unknown");
  }
}


/**
 * Resolve Vimeo vanity URLs, including /newyorktimes/stalinboys, via the
 * official oEmbed API. Only approved Vimeo player URLs are returned.
 */
async function vimeoVideoPreview(target: URL): Promise<NextResponse> {
  const fallback = () => NextResponse.json({
    url: target.href,
    domain: "vimeo.com",
    title: "Vimeo video",
    description: "View on Vimeo",
  }, { headers: { "Cache-Control": "private, max-age=900" } });

  const host = target.hostname.toLowerCase();
  if (!["vimeo.com", "www.vimeo.com", "player.vimeo.com"].includes(host)) return fallback();
  const parts = target.pathname.split("/").filter(Boolean);
  if (!parts.length || parts.length > 6 ||
      parts.some((part) => !/^[a-zA-Z0-9_-]{1,100}$/.test(part))) return fallback();

  // Keep the privacy hash of an unlisted video; discard marketing parameters.
  const cleanUrl = new URL(target.href);
  for (const key of Array.from(cleanUrl.searchParams.keys())) {
    if (key !== "h") cleanUrl.searchParams.delete(key);
  }

  try {
    // The upstream URL is fixed; never fetch arbitrary destinations or follow redirects.
    const endpoint = "https://vimeo.com/api/oembed.json?url=" + encodeURIComponent(cleanUrl.href);
    const response = await fetch(endpoint, {
      redirect: "manual",
      signal: AbortSignal.timeout(5000),
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!response.ok || !(response.headers.get("content-type") ?? "").toLowerCase().includes("json")) {
      return fallback();
    }
    const metadata = await response.json() as {
      title?: unknown; author_name?: unknown; thumbnail_url?: unknown;
      html?: unknown; video_id?: unknown; type?: unknown;
    };
    if (metadata.type && metadata.type !== "video") return fallback();

    // Never inject Vimeo's HTML. Extract and validate the official player URL.
    const html = typeof metadata.html === "string" ? metadata.html : "";
    const src = html.match(/<iframe\b[^>]*\bsrc=["']([^"']+)["']/i)?.[1] ?? "";
    let id: string | null = null;
    let hash: string | null = null;
    try {
      const embedded = new URL(src.replace(/&amp;/gi, "&"));
      const match = embedded.pathname.match(/^\/video\/([0-9]{1,12})\/?$/);
      if (embedded.protocol === "https:" && embedded.hostname === "player.vimeo.com" &&
          !embedded.port && !embedded.username && !embedded.password && match) {
        id = match[1];
        const embeddedHash = embedded.searchParams.get("h");
        if (embeddedHash && /^[a-zA-Z0-9]{5,64}$/.test(embeddedHash)) hash = embeddedHash;
      }
    } catch {
      // Some oEmbed responses supply video_id but not an iframe.
    }
    if (!id && /^[0-9]{1,12}$/.test(String(metadata.video_id ?? ""))) {
      id = String(metadata.video_id);
    }
    const requestedHash = cleanUrl.searchParams.get("h");
    if (!hash && requestedHash && /^[a-zA-Z0-9]{5,64}$/.test(requestedHash)) {
      hash = requestedHash;
    }
    const vimeoPlayerUrl = id
      ? "https://player.vimeo.com/video/" + id +
        (hash ? "?h=" + hash + "&dnt=1&autoplay=0" : "?dnt=1&autoplay=0")
      : undefined;

    let image: string | undefined;
    if (typeof metadata.thumbnail_url === "string") {
      try {
        const thumbnail = new URL(metadata.thumbnail_url);
        if (thumbnail.protocol === "https:" && !thumbnail.port && !thumbnail.username &&
            !thumbnail.password && !isIP(thumbnail.hostname)) image = thumbnail.href;
      } catch {}
    }

    return NextResponse.json({
      url: target.href,
      domain: "vimeo.com",
      title: typeof metadata.title === "string" && metadata.title.trim()
        ? metadata.title.trim().slice(0, 240) : "Vimeo video",
      description: typeof metadata.author_name === "string" && metadata.author_name.trim()
        ? "By " + metadata.author_name.trim().slice(0, 150) : "",
      image,
      vimeoPlayerUrl,
    }, { headers: { "Cache-Control": "private, max-age=3600" } });
  } catch {
    return fallback();
  }
}

export async function GET(request: NextRequest) {
  const token = request.headers.get("authorization")?.match(/^Bearer ([A-Za-z0-9._~-]+)$/i)?.[1];
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!token || !supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Sign in to preview links" }, { status: 401 });
  }
  const authClient = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: authData, error: authError } = await authClient.auth.getUser(token);
  if (authError || !authData.user) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }
  const target = safeUrl(request.nextUrl.searchParams.get("url") ?? "");
  if (!target) return NextResponse.json({ error: "Unsupported external link" }, { status: 400 });
  const isFacebook = facebookContentKind(target) !== null;
  if (["tiktok.com", "www.tiktok.com", "m.tiktok.com", "vt.tiktok.com", "vm.tiktok.com"].includes(target.hostname.toLowerCase())) {
    return tiktokVideoPreview(target);
  }
  if (["vimeo.com", "www.vimeo.com", "player.vimeo.com"].includes(target.hostname.toLowerCase())) {
    return vimeoVideoPreview(target);
  }
  try {
    // Prevent fetching loopback, private-network, link-local, and literal IP hosts.
    // Never follow redirects, which could change an otherwise valid destination.
    const addresses = await lookup(target.hostname, { all: true });
    if (!addresses.length || addresses.some((entry) => !publicAddress(entry.address))) {
      return NextResponse.json({ error: "Untrusted link destination" }, { status: 400 });
    }
    const response = await fetch(target, {
      redirect: "manual",
      signal: AbortSignal.timeout(4500),
      headers: { "Accept": "text/html", "User-Agent": "FieldsConnect-LinkPreview/1.0" },
      cache: "no-store",
    });
    if (!response.ok || !(response.headers.get("content-type") ?? "").toLowerCase().includes("text/html")) {
      return isFacebook ? facebookPreviewFallback(target) : youtubeOembedFallback(target);
    }
    const reader = response.body?.getReader();
    if (!reader) return isFacebook ? facebookPreviewFallback(target) : youtubeOembedFallback(target);
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (size < 131072) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) { chunks.push(value); size += value.byteLength; }
      if (size >= 131072) break;
    }
    await reader.cancel().catch(() => {});
    const bytes = new Uint8Array(Math.min(size, 131072));
    let offset = 0;
    for (const chunk of chunks) {
      const amount = Math.min(chunk.byteLength, bytes.length - offset);
      bytes.set(chunk.subarray(0, amount), offset);
      offset += amount;
      if (offset >= bytes.length) break;
    }
    const html = new TextDecoder().decode(bytes);
    const metadata = metaTags(html);
    const titleTag = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "";
    const title = metadata["og:title"] || metadata["twitter:title"] || htmlDecode(titleTag) || target.hostname;
    // Facebook often returns a generic sign-in wall instead of actual post metadata.
    // Prefer a safe branded preview rather than showing misleading login titles.
    if (isFacebook && (!title || /^(facebook|log in|login|sign in|sign up)(\b|\s|$)/i.test(title) ||
        /log in or sign up|you must log in/i.test(title))) return facebookPreviewFallback(target);
    const description = metadata["og:description"] || metadata.description || metadata["twitter:description"] || "";
    const imageValue = metadata["og:image:secure_url"] || metadata["og:image"] || metadata["twitter:image"] || "";
    let image: string | undefined;
    try {
      const img = new URL(imageValue, target);
      if (img.protocol === "https:" && !img.username && !img.password && !img.port && !isIP(img.hostname)) image = img.href;
    } catch {}
    return NextResponse.json(
      { url: target.href, domain: target.hostname, title, description, image },
      { headers: { "Cache-Control": "private, max-age=3600" } }
    );
  } catch {
    return isFacebook ? facebookPreviewFallback(target) : youtubeOembedFallback(target);
  }
}
