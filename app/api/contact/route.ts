import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const SUPPORT_EMAIL = "support@fieldsconnect.app";
const MAX_BODY_BYTES = 10_000;
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;

// Best-effort per-instance throttle; platform-level protection can supplement this.
const attemptCounts = new Map<string, { count: number; resetAt: number }>();

function clean(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > max || /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(trimmed)) return null;
  return trimmed;
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      if (new URL(origin).host !== request.nextUrl.host) {
        return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
      }
    } catch {
      return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
    }
  }

  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    return NextResponse.json({ error: "Invalid content type." }, { status: 415 });
  }
  const bodySize = Number(request.headers.get("content-length") || 0);
  if (bodySize > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Your message is too long." }, { status: 413 });
  }

  let payload: Record<string, unknown>;
  try {
    const raw = await request.text();
    if (Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES) {
      return NextResponse.json({ error: "Your message is too long." }, { status: 413 });
    }
    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Invalid body");
    payload = data as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid form data." }, { status: 400 });
  }

  // Invisible field for automated submissions; do not claim the email was sent.
  if (payload.website) {
    return NextResponse.json({ error: "Unable to send your message." }, { status: 400 });
  }

  const name = clean(payload.name, 120);
  const email = clean(payload.email, 254);
  const subject = clean(payload.subject, 150);
  const message = clean(payload.message, 1500);
  if (!name || !email || !subject || !message ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      name.includes("\n") || subject.includes("\n") || email.includes("\n")) {
    return NextResponse.json({ error: "Please check the form fields and try again." }, { status: 400 });
  }

  const ip = request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || "unknown";
  const now = Date.now();
  if (attemptCounts.size > 1000) {
    for (const [key, value] of attemptCounts) if (value.resetAt <= now) attemptCounts.delete(key);
  }
  const last = attemptCounts.get(ip);
  const current = last && last.resetAt > now ? last : { count: 0, resetAt: now + WINDOW_MS };
  if (current.count >= MAX_ATTEMPTS) {
    return NextResponse.json({ error: "Too many messages. Please try again later." }, { status: 429 });
  }
  current.count += 1;
  attemptCounts.set(ip, current);

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.CONTACT_FROM_EMAIL;
  if (!apiKey || !from) {
    console.error("Contact email delivery is not configured.");
    return NextResponse.json(
      { error: "Our contact form is temporarily unavailable. Please email support@fieldsconnect.app directly." },
      { status: 503 }
    );
  }

  const formatted = [
    "New FieldsConnect contact enquiry",
    "",
    "Name: " + name,
    "Email: " + email,
    "Subject: " + subject,
    "",
    "Message:",
    message,
    "",
    "Submitted via fieldsconnect.app/contact",
  ].join("\n");

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    let response: Response;
    try {
      response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "User-Agent": "FieldsConnect/1.0",
        },
        body: JSON.stringify({
          from,
          to: [SUPPORT_EMAIL],
          reply_to: email,
          subject: `FieldsConnect contact: ${subject}`,
          text: formatted,
        }),
        signal: controller.signal,
        cache: "no-store",
      });
    } finally {
      clearTimeout(timeout);
    }
    if (!response.ok) {
      console.error("Contact email provider rejected request", response.status);
      return NextResponse.json({ error: "We could not send your message. Please try again, or email us directly." }, { status: 502 });
    }
    const result: unknown = await response.json();
    if (!result || typeof result !== "object" || !("id" in result)) {
      console.error("Contact email provider returned no message id");
      return NextResponse.json({ error: "We could not confirm delivery. Please email support directly." }, { status: 502 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Contact email delivery error:", error instanceof Error ? error.name : "unknown");
    return NextResponse.json({ error: "We could not send your message. Please try again, or email us directly." }, { status: 502 });
  }
}
