"use client";

import { useState, type FormEvent } from "react";

const SUPPORT_EMAIL = "support@fieldsconnect.app";

export function ContactForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSending) return;
    setIsSending(true);
    setIsSent(false);
    setSendError(null);
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          subject: subject.trim(),
          message: message.trim(),
          website: (event.currentTarget.elements.namedItem("website") as HTMLInputElement | null)?.value ?? "",
        }),
      });
      const result: { ok?: boolean; error?: string } = await response.json();
      if (!response.ok || !result.ok) {
        throw new Error(result.error || "Unable to send your message. Please try again.");
      }
      setIsSent(true);
      setName("");
      setEmail("");
      setSubject("");
      setMessage("");
    } catch (error) {
      setSendError(error instanceof Error ? error.message : "Unable to send your message.");
    } finally {
      setIsSending(false);
    }
  }

  function clearStatus() {
    setIsSent(false);
    setSendError(null);
  }

  return (
    <section aria-labelledby="contact-form-heading" className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
      <h2 id="contact-form-heading" className="text-xl font-bold">Send us a message</h2>
      <p className="mt-3 text-sm leading-7 text-slate-600">
        Send your question directly to the FieldsConnect support team.
      </p>
      <form onSubmit={handleSubmit} className="mt-6 space-y-5">
        <div>
          <label htmlFor="contact-name" className="mb-2 block text-sm font-semibold text-slate-800">Name</label>
          <input
            id="contact-name"
            name="name"
            autoComplete="name"
            type="text"
            required
            maxLength={120}
            value={name}
            onChange={(event) => { setName(event.target.value); clearStatus(); }}
            placeholder="Your name"
            className="min-h-12 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-950 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-700/20"
          />
        </div>
        <div>
          <label htmlFor="contact-email" className="mb-2 block text-sm font-semibold text-slate-800">Email address</label>
          <input
            id="contact-email"
            name="email"
            autoComplete="email"
            type="email"
            required
            maxLength={254}
            value={email}
            onChange={(event) => { setEmail(event.target.value); clearStatus(); }}
            placeholder="you@example.com"
            className="min-h-12 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-950 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-700/20"
          />
        </div>
        <div>
          <label htmlFor="contact-subject" className="mb-2 block text-sm font-semibold text-slate-800">Subject</label>
          <input
            id="contact-subject"
            name="subject"
            type="text"
            required
            maxLength={150}
            value={subject}
            onChange={(event) => { setSubject(event.target.value); clearStatus(); }}
            placeholder="What is your enquiry about?"
            className="min-h-12 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-950 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-700/20"
          />
        </div>
        <div>
          <label htmlFor="contact-message" className="mb-2 block text-sm font-semibold text-slate-800">Message</label>
          <textarea
            id="contact-message"
            name="message"
            required
            rows={6}
            maxLength={1500}
            value={message}
            onChange={(event) => { setMessage(event.target.value); clearStatus(); }}
            placeholder="How can we help?"
            className="w-full resize-y rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-950 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-700/20"
          />
        </div>
        <p className="text-xs leading-5 text-slate-500">
          Please do not include passwords, payment-card numbers or other sensitive personal information.
        </p>
        <div className="absolute -left-[10000px] h-px w-px overflow-hidden" aria-hidden="true">
          <label htmlFor="contact-website">Website</label>
          <input id="contact-website" name="website" tabIndex={-1} autoComplete="off" type="text" />
        </div>
        <button
          type="submit"
          disabled={isSending}
          className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-blue-700 px-6 text-sm font-bold text-white transition hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:cursor-wait disabled:opacity-60 sm:w-auto"
        >
          {isSending ? "Sending..." : "Send message"}
        </button>
        {isSent && (
          <p role="status" className="text-sm font-medium leading-6 text-green-700">
            Your message has been sent to the FieldsConnect support team.
          </p>
        )}
        {sendError && (
          <p role="alert" className="text-sm leading-6 text-red-700">
            {sendError}{" "}
            <a className="font-semibold underline underline-offset-2" href={`mailto:${SUPPORT_EMAIL}`}>
              Email support directly
            </a>.
          </p>
        )}
      </form>
    </section>
  );
}
