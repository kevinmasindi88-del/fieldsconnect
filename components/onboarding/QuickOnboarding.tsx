"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  getSupabaseBrowserClient,
  isSupabaseConfigured,
} from "@/lib/supabase/browser";
import {
  LegalAgreementCheckbox,
  LEGAL_AGREEMENT_VERSION,
} from "@/components/onboarding/LegalAgreementCheckbox";

type RoleType = "student" | "professional" | "institution";

const journeyChoices: ReadonlyArray<{
  value: RoleType;
  label: string;
  description: string;
}> = [
  { value: "student", label: "School or university", description: "I'm learning or studying" },
  { value: "professional", label: "Professional", description: "I'm building my career" },
  { value: "institution", label: "Institution", description: "I represent an organisation" },
];

type CurrentProfile = {
  display_name: string;
  role_type: RoleType;
  field: string | null;
  terms_accepted_at: string | null;
  privacy_accepted_at: string | null;
  community_guidelines_accepted_at: string | null;
};

export function QuickOnboarding() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasExistingProfile, setHasExistingProfile] = useState(false);
  const [agreementRecorded, setAgreementRecorded] = useState(false);
  const [legacyAgreementAccepted, setLegacyAgreementAccepted] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [roleType, setRoleType] = useState<RoleType | "">("");
  const [field, setField] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      if (!isSupabaseConfigured()) {
        if (active) {
          setMessage("FieldsConnect is temporarily unavailable. Please try again later.");
          setIsLoading(false);
        }
        return;
      }

      try {
        const supabase = getSupabaseBrowserClient();
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;
        if (!userData.user) {
          router.replace("/login");
          return;
        }

        const userId = userData.user.id;
        const [profileResult, agreementResult] = await Promise.all([
          supabase
            .from("profiles")
            .select("display_name, role_type, field, terms_accepted_at, privacy_accepted_at, community_guidelines_accepted_at")
            .eq("id", userId)
            .maybeSingle(),
          supabase
            .from("user_legal_agreements")
            .select("agreement_version")
            .eq("user_id", userId)
            .eq("agreement_version", LEGAL_AGREEMENT_VERSION)
            .maybeSingle(),
        ]);

        if (profileResult.error) throw profileResult.error;
        if (agreementResult.error) throw agreementResult.error;
        if (!active) return;

        const profile = profileResult.data as CurrentProfile | null;
        if (
          profile?.display_name?.trim() &&
          profile.terms_accepted_at &&
          profile.privacy_accepted_at &&
          profile.community_guidelines_accepted_at
        ) {
          router.replace("/timeline");
          return;
        }

        setHasExistingProfile(Boolean(profile));
        setAgreementRecorded(Boolean(agreementResult.data));
        if (profile) {
          setDisplayName(profile.display_name ?? "");
          setRoleType(profile.role_type ?? "");
          setField(profile.field ?? "");
        }
      } catch (error) {
        if (active) {
          setMessage(
            error instanceof Error
              ? error.message
              : "Unable to load your account. Please try again."
          );
        }
      } finally {
        if (active) setIsLoading(false);
      }
    }

    void loadProfile();
    return () => { active = false; };
  }, [router]);

  async function handleFinish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSaving) return;

    const name = displayName.trim();
    const interest = field.trim();
    if (name.length < 2 || name.length > 120) {
      setMessage("Enter a name between 2 and 120 characters.");
      return;
    }
    if (!roleType) {
      setMessage("Choose where you are in your journey.");
      return;
    }
    if (interest.length < 2 || interest.length > 120) {
      setMessage("Enter a field of interest between 2 and 120 characters.");
      return;
    }
    if (!agreementRecorded && !legacyAgreementAccepted) {
      setMessage("Please accept the FieldsConnect agreement to continue.");
      return;
    }

    setIsSaving(true);
    setMessage(null);

    try {
      if (!isSupabaseConfigured()) throw new Error("FieldsConnect is temporarily unavailable.");
      const supabase = getSupabaseBrowserClient();
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!userData.user) throw new Error("Your session has expired. Please sign in again.");
      const userId = userData.user.id;

      // Only legacy members without the versioned signup record need to accept
      // the agreement here. The RPC records acceptance on the server.
      if (!agreementRecorded) {
        const { error: acceptanceError } = await supabase.rpc("accept_fc_legal_agreement_v1");
        if (acceptanceError) throw acceptanceError;
        setAgreementRecorded(true);
      }

      const now = new Date().toISOString();
      const values = {
        display_name: name,
        role_type: roleType,
        field: interest,
        terms_accepted_at: now,
        privacy_accepted_at: now,
        community_guidelines_accepted_at: now,
      };

      // Never convert an existing mentor/profile to default settings. New
      // profiles start private and can change visibility later in /profile.
      const result = hasExistingProfile
        ? await supabase.from("profiles").update(values).eq("id", userId)
        : await supabase.from("profiles").insert({
            id: userId,
            ...values,
            profile_visibility: "private",
            mentor_available: false,
          });

      if (result.error) throw result.error;
      window.dispatchEvent(new Event("fc:profile-updated"));
      router.replace("/timeline");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save your profile.");
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <main className="flex min-h-[80vh] items-center justify-center px-4 py-12">
        <p role="status" className="text-sm text-gray-600">Preparing your FieldsConnect journey…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen w-full bg-gradient-to-b from-blue-50 via-slate-50 to-white px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto w-full max-w-xl">
        <div className="mb-6 text-center">
          <span className="inline-flex items-center rounded-full border border-blue-200 bg-white px-3 py-1 text-xs font-semibold text-blue-700">
            ONE QUICK STEP
          </span>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-gray-950 sm:text-4xl">
            FieldsConnect - Connect and Grow.
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-gray-600 sm:text-base">
            Just the essentials for now. Your photo, skills, bio and mentorship preferences can come later.
          </p>
        </div>

        <form onSubmit={handleFinish} className="space-y-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-lg shadow-slate-200/60 sm:p-8">
          <div>
            <label htmlFor="fc-first-name" className="block text-sm font-semibold text-gray-900">
              What should we call you?
            </label>
            <input
              id="fc-first-name"
              autoComplete="name"
              className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 px-4 py-3 text-base outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              placeholder="Your name"
              maxLength={120}
              minLength={2}
              required
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              disabled={isSaving}
            />
          </div>

          <fieldset>
            <legend className="text-sm font-semibold text-gray-900">
              Where are you in your journey?
            </legend>
            <p className="mt-1 text-xs leading-5 text-gray-500">
              Pick the option that best describes you today. You can change it later.
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {journeyChoices.map((choice) => {
                const selected = roleType === choice.value;
                return (
                  <button
                    key={choice.value}
                    type="button"
                    aria-pressed={selected}
                    disabled={isSaving}
                    onClick={() => setRoleType(choice.value)}
                    className={
                      "rounded-xl border px-3 py-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 " +
                      (selected
                        ? "border-blue-600 bg-blue-50 text-blue-950 ring-1 ring-blue-600"
                        : "border-slate-200 bg-slate-50 text-gray-900 hover:border-blue-300 hover:bg-white")
                    }
                  >
                    <span className="block text-sm font-semibold">{choice.label}</span>
                    <span className="mt-1 block text-xs leading-5 opacity-80">{choice.description}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div>
            <label htmlFor="fc-interest" className="block text-sm font-semibold text-gray-900">
              What field interests you?
            </label>
            <input
              id="fc-interest"
              className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 px-4 py-3 text-base outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              placeholder="e.g. Pharmacy, Engineering, Design"
              maxLength={120}
              minLength={2}
              required
              value={field}
              onChange={(event) => setField(event.target.value)}
              disabled={isSaving}
            />
          </div>

          {agreementRecorded ? (
            <p className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900">
              Your signup agreement has been recorded. No need to accept it again.
            </p>
          ) : (
            <div className="space-y-2">
              <p className="text-xs leading-5 text-gray-600">
                If you joined before the new signup agreement, confirm it once here.
              </p>
              <LegalAgreementCheckbox
                id="fc-onboarding-agreement"
                checked={legacyAgreementAccepted}
                onChange={setLegacyAgreementAccepted}
              />
            </div>
          )}

          <div className="space-y-3">
            <button
              className="min-h-12 w-full rounded-xl bg-blue-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              type="submit"
              disabled={isSaving || !roleType || (!agreementRecorded && !legacyAgreementAccepted)}
            >
              {isSaving ? "Creating your profile…" : "Explore FieldsConnect"}
            </button>
            <p className="text-center text-xs leading-5 text-gray-500">
              Your profile starts private. You can change visibility and add more details in{" "}
              <Link className="font-semibold text-blue-700 hover:underline" href="/profile">
                Profile settings
              </Link>.
            </p>
          </div>
          {message && (
            <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-900">{message}</p>
          )}
        </form>
      </div>
    </main>
  );
}
