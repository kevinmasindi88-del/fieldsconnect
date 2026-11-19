"use client";

import { useState } from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/browser";

type AcceptanceKey =
  | "termsAccepted"
  | "privacyAccepted"
  | "communityGuidelinesAccepted"
  | "ageConfirmed";

const initialState: Record<AcceptanceKey, boolean> = {
  termsAccepted: false,
  privacyAccepted: false,
  communityGuidelinesAccepted: false,
  ageConfirmed: false,
};

export function AcceptanceForm() {
  const [accepted, setAccepted] = useState(initialState);
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canSubmit = Object.values(accepted).every(Boolean);

  function toggle(key: AcceptanceKey) {
    setAccepted((current) => ({ ...current, [key]: !current[key] }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    if (!canSubmit) {
      setMessage("All required confirmations must be accepted before continuing.");
      return;
    }

    if (!isSupabaseConfigured()) {
      setMessage("Supabase is not configured yet. Acceptance recording will work once environment variables are set.");
      return;
    }

    setIsSubmitting(true);

    try {
      const supabase = getSupabaseBrowserClient();
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

      if (sessionError) throw sessionError;

      const userId = sessionData.session?.user.id;

      if (!userId) {
        setMessage("Please log in before completing onboarding.");
        return;
      }

      const now = new Date().toISOString();

      const { error } = await supabase
        .from("profiles")
        .update({
          terms_accepted_at: now,
          privacy_accepted_at: now,
          community_guidelines_accepted_at: now,
          age_confirmed_at: now,
        })
        .eq("id", userId);

      if (error) throw error;

      setMessage("Onboarding acceptance recorded."); window.location.href = "/timeline";
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto flex w-full max-w-2xl flex-col gap-4 rounded-xl border p-6">
      <div>
        <h1 className="text-2xl font-semibold">Required onboarding acceptance</h1>
        <p className="mt-2 text-sm text-gray-600">
          FieldsConnect MVP requires policy acceptance and 18+ confirmation before core features are enabled.
        </p>
      </div>

      <label className="flex gap-3 text-sm">
        <input type="checkbox" checked={accepted.termsAccepted} onChange={() => toggle("termsAccepted")} />
        I accept the FieldsConnect Terms.
      </label>

      <label className="flex gap-3 text-sm">
        <input type="checkbox" checked={accepted.privacyAccepted} onChange={() => toggle("privacyAccepted")} />
        I accept the FieldsConnect Privacy Policy.
      </label>

      <label className="flex gap-3 text-sm">
        <input
          type="checkbox"
          checked={accepted.communityGuidelinesAccepted}
          onChange={() => toggle("communityGuidelinesAccepted")}
        />
        I accept the FieldsConnect Community Guidelines.
      </label>

      <label className="flex gap-3 text-sm">
        <input type="checkbox" checked={accepted.ageConfirmed} onChange={() => toggle("ageConfirmed")} />
        I confirm that I am 18 or older.
      </label>

      <button
        className="w-fit rounded-lg bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        type="submit"
        disabled={!canSubmit || isSubmitting}
      >
        {isSubmitting ? "Saving..." : "Complete onboarding"}
      </button>

      {message && <p className="text-sm text-gray-700">{message}</p>}
    </form>
  );
}

