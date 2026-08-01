"use client";

import { useState } from "react";
import {
  getSupabaseBrowserClient,
  isSupabaseConfigured,
} from "@/lib/supabase/browser";

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }

  return fallback;
}

export function FeedbackWorkflow() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isSuccessful, setIsSuccessful] = useState(false);

  const titleLength = title.trim().length;
  const descriptionLength = description.trim().length;

  const canSubmit =
    titleLength >= 3 &&
    titleLength <= 160 &&
    descriptionLength >= 10 &&
    descriptionLength <= 5000;

  async function submitFeedback(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!isSupabaseConfigured()) {
      setMessage("FieldsConnect feedback is currently unavailable.");
      return;
    }

    if (!canSubmit) {
      setMessage(
        "Add a title of at least 3 characters and a description of at least 10 characters."
      );
      return;
    }

    setIsSubmitting(true);
    setMessage(null);
    setIsSuccessful(false);

    try {
      const supabase = getSupabaseBrowserClient();

      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();

      if (sessionError) throw sessionError;

      if (!sessionData.session?.user) {
        throw new Error("Please log in before submitting feedback.");
      }

      const { error } = await supabase.rpc("submit_fc_feedback", {
        feedback_title: title.trim(),
        feedback_description: description.trim(),
      });

      if (error) throw error;

      setTitle("");
      setDescription("");
      setIsSuccessful(true);
      setMessage(
        "Thank you for submitting your feedback. The FieldsConnect team will review it and take appropriate action."
      );
    } catch (error) {
      setMessage(
        getErrorMessage(
          error,
          "Unable to submit your feedback. Please try again."
        )
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10">
      <header>
<h1 className="mt-1 text-3xl font-semibold tracking-tight text-gray-950">
          Share feedback
        </h1>

        <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-600">
          Share an idea, improvement, concern or observation. Your feedback
          will be reviewed by the FieldsConnect team and may inform future
          platform improvements.
        </p>
      </header>

      <form
        className="grid gap-5 rounded-3xl border border-gray-200 bg-white p-5 shadow-sm sm:p-7"
        onSubmit={submitFeedback}
      >
        <label className="grid gap-2 text-sm font-medium text-gray-900">
          Title

          <input
            autoFocus
            className="min-h-11 rounded-xl border border-gray-300 px-4 py-3 text-sm font-normal outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
            disabled={isSubmitting}
            maxLength={160}
            minLength={3}
            onChange={(event) => {
              setTitle(event.target.value);
              setMessage(null);
              setIsSuccessful(false);
            }}
            placeholder="Summarise your feedback"
            required
            type="text"
            value={title}
          />

          <span className="text-right text-xs font-normal text-gray-500">
            {title.length}/160
          </span>
        </label>

        <label className="grid gap-2 text-sm font-medium text-gray-900">
          Description

          <textarea
            className="min-h-48 resize-y rounded-xl border border-gray-300 px-4 py-3 text-sm font-normal leading-6 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
            disabled={isSubmitting}
            maxLength={5000}
            minLength={10}
            onChange={(event) => {
              setDescription(event.target.value);
              setMessage(null);
              setIsSuccessful(false);
            }}
            placeholder="Describe your feedback, suggestion or idea in as much useful detail as possible."
            required
            value={description}
          />

          <span className="text-right text-xs font-normal text-gray-500">
            {description.length}/5000
          </span>
        </label>

        <button
          className="min-h-11 w-full rounded-xl bg-gray-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:w-fit"
          disabled={isSubmitting || !canSubmit}
          type="submit"
        >
          {isSubmitting ? "Submitting feedback..." : "Submit feedback"}
        </button>

        {message && (
          <div
            aria-live="polite"
            className={[
              "rounded-xl border p-4 text-sm leading-6",
              isSuccessful
                ? "border-green-200 bg-green-50 text-green-900"
                : "border-amber-200 bg-amber-50 text-amber-900",
            ].join(" ")}
            role={isSuccessful ? "status" : "alert"}
          >
            {message}
          </div>
        )}
      </form>
</section>
  );
}