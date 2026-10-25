"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getSupabaseBrowserClient,
  isSupabaseConfigured,
} from "@/lib/supabase/browser";
import {
  LegalAgreementCheckbox,
  LEGAL_AGREEMENT_VERSION,
} from "@/components/onboarding/LegalAgreementCheckbox";

export function AcceptanceForm() {
  const router = useRouter();
  const [accepted, setAccepted] = useState(false);
  const [hasRecordedAgreement, setHasRecordedAgreement] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // A policy agreement is NOT an age statement or evidence of guardian consent.
  const refreshAgreement = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setMessage("Supabase is not configured.");
      setIsChecking(false);
      return;
    }

    try {
      const supabase = getSupabaseBrowserClient();
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      const userId = userData.user?.id;
      if (!userId) throw new Error("Please log in to finish setting up your profile.");

      const [agreementResult, profileResult] = await Promise.all([
        supabase
          .from("user_legal_agreements")
          .select("agreement_version")
          .eq("user_id", userId)
          .eq("agreement_version", LEGAL_AGREEMENT_VERSION)
          .maybeSingle(),
        supabase
          .from("profiles")
          .select("display_name, terms_accepted_at, privacy_accepted_at, community_guidelines_accepted_at")
          .eq("id", userId)
          .maybeSingle(),
      ]);
      if (agreementResult.error) throw agreementResult.error;
      if (profileResult.error) throw profileResult.error;

      const profile = profileResult.data;
      if (profile?.display_name?.trim() &&
        profile.terms_accepted_at &&
        profile.privacy_accepted_at &&
        profile.community_guidelines_accepted_at) {
        router.replace("/timeline");
        return;
      }

      const agreementRecorded = Boolean(agreementResult.data);
      setHasRecordedAgreement(agreementRecorded);
      if (agreementRecorded && profile?.display_name?.trim()) {
        // Synchronise legacy agreement timestamps after the profile exists.
        // Do not modify the old age_confirmed_at column.
        const now = new Date().toISOString();
        const { error: updateError } = await supabase
          .from("profiles")
          .update({
            terms_accepted_at: now,
            privacy_accepted_at: now,
            community_guidelines_accepted_at: now,
          })
          .eq("id", userId);
        if (updateError) throw updateError;
        router.replace("/timeline");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to check your agreement.");
    } finally {
      setIsChecking(false);
    }
  }, [router]);

  useEffect(() => {
    void refreshAgreement();
    function handleProfileSaved() { void refreshAgreement(); }
    window.addEventListener("fc:profile-saved", handleProfileSaved);
    return () => window.removeEventListener("fc:profile-saved", handleProfileSaved);
  }, [refreshAgreement]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accepted || hasRecordedAgreement || isSubmitting) return;

    setMessage(null);
    setIsSubmitting(true);

    try {
      if (!isSupabaseConfigured()) throw new Error("Supabase is not configured.");
      const supabase = getSupabaseBrowserClient();
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      const userId = userData.user?.id;
      if (!userId) throw new Error("Please log in before completing onboarding.");

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", userId)
        .maybeSingle();
      if (profileError) throw profileError;
      if (!profile?.display_name?.trim()) {
        throw new Error("Your account needs updating. Please sign out and sign in again.");
      }

      const { error: agreementError } = await supabase.rpc("accept_fc_legal_agreement_v1");
      if (agreementError) throw agreementError;

      const now = new Date().toISOString();
      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          terms_accepted_at: now,
          privacy_accepted_at: now,
          community_guidelines_accepted_at: now,
        })
        .eq("id", userId);
      if (updateError) throw updateError;
      router.replace("/timeline");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save the agreement.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isChecking) {
    return <div className="mx-auto w-full max-w-2xl rounded-xl border bg-white p-4 text-sm text-gray-600">Checking your signup agreement…</div>;
  }

  return (
    <section className="mx-auto w-full max-w-2xl rounded-xl border bg-white p-4 sm:p-6">
      <h1 className="text-xl font-semibold">Complete your FieldsConnect setup</h1>
      {hasRecordedAgreement ? (
        <p className="mt-3 text-sm leading-6 text-gray-600">
          Your agreement has already been recorded. Continue to FieldsConnect.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
          <p className="text-sm text-gray-600">
            You registered before the consolidated agreement was introduced. Confirm it once here to continue.
          </p>
          <LegalAgreementCheckbox
            id="fc-onboarding-agreement"
            checked={accepted}
            onChange={setAccepted}
          />
          <button
            className="w-fit rounded-xl bg-gray-950 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
            type="submit"
            disabled={!accepted || isSubmitting}
          >
            {isSubmitting ? "Saving..." : "Continue to FieldsConnect"}
          </button>
        </form>
      )}
      {message && <p role="status" className="mt-3 text-sm text-gray-700">{message}</p>}
    </section>
  );
}
