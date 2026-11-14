import { NextRequest, NextResponse } from "next/server";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

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

export async function GET(request: NextRequest) {
  const target = safeUrl(request.nextUrl.searchParams.get("url") ?? "");
  if (!target) return NextResponse.json({ error: "Unsupported external link" }, { status: 400 });
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
      return NextResponse.json({ error: "Preview unavailable" }, { status: 422 });
    }
    const reader = response.body?.getReader();
    if (!reader) return NextResponse.json({ error: "No preview" }, { status: 422 });
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
    return NextResponse.json({ error: "Preview unavailable" }, { status: 422 });
  }
}
