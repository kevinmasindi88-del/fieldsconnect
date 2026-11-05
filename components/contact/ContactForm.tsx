"use client";

import { useState, type FormEvent } from "react";

const SUPPORT_EMAIL = "support@fieldsconnect.app";

export function ContactForm() {
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [openedEmail, setOpenedEmail] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const cleanName = name.trim();
    const cleanSubject = subject.trim();
    const cleanMessage = message.trim();
    if (!cleanName || !cleanSubject || !cleanMessage) return;

    const body = `Name: ${cleanName}\n\nMessage:\n${cleanMessage}\n\n---\nSent from the FieldsConnect contact form.`;
    const href = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(cleanSubject)}&body=${encodeURIComponent(body)}`;

    // A mailto link opens the visitor's configured mail application.
    // This page does not send or store the message itself.
    setOpenedEmail(true);
    window.location.href = href;
  }

  return (
    <section aria-labelledby="contact-form-heading" className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
      <h2 id="contact-form-heading" className="text-xl font-bold">Send us a message</h2>
      <p className="mt-3 text-sm leading-7 text-slate-600">
        Complete the form to prepare a message to our support team. Clicking
        &nbsp;<strong>Continue to email</strong> opens your email app, where you can review and send it.
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
            onChange={(event) => { setName(event.target.value); setOpenedEmail(false); }}
            placeholder="Your name"
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
            onChange={(event) => { setSubject(event.target.value); setOpenedEmail(false); }}
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
            onChange={(event) => { setMessage(event.target.value); setOpenedEmail(false); }}
            placeholder="How can we help?"
            className="w-full resize-y rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-950 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-700/20"
          />
        </div>
        <p className="text-xs leading-5 text-slate-500">
          Please do not include passwords, payment-card numbers or other sensitive personal information.
          The form does not submit information directly to FieldsConnect.
        </p>
        <button
          type="submit"
          className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-blue-700 px-6 text-sm font-bold text-white transition hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 sm:w-auto"
        >
          Continue to email
        </button>
        {openedEmail && (
          <p role="status" className="text-sm leading-6 text-slate-700">
            Your email app should open with the message prepared. Please press Send there.
            If nothing opens, you can email{" "}
            <a className="font-semibold text-blue-700 underline" href={`mailto:${SUPPORT_EMAIL}`}>
              {SUPPORT_EMAIL}
            </a>.
          </p>
        )}
      </form>
    </section>
  );
}
