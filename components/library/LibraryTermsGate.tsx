"use client";

import {
  type ReactNode,
  useEffect,
  useState,
} from "react";

import {
  getSupabaseBrowserClient,
  isSupabaseConfigured,
} from "@/lib/supabase/browser";

type LibraryTerms = {
  id: string;
  version: string;
  title: string;
  summary: string;
  terms_text: string;
  effective_at: string;
};

type LibraryTermsGateProps = {
  children: ReactNode;
};

function getErrorMessage(
  error: unknown,
  fallback: string
) {
  if (error instanceof Error) {
    return error.message;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message?: unknown }).message ===
      "string"
  ) {
    return (error as { message: string }).message;
  }

  return fallback;
}

export function LibraryTermsGate({
  children,
}: LibraryTermsGateProps) {
  const [terms, setTerms] =
    useState<LibraryTerms | null>(null);

  const [hasAccepted, setHasAccepted] =
    useState(false);

  const [rightsAcknowledged, setRightsAcknowledged] =
    useState(false);

  const [privacyAcknowledged, setPrivacyAcknowledged] =
    useState(false);

  const [securityAcknowledged, setSecurityAcknowledged] =
    useState(false);

  const [takedownAcknowledged, setTakedownAcknowledged] =
    useState(false);

  const [isLoading, setIsLoading] =
    useState(true);

  const [isAccepting, setIsAccepting] =
    useState(false);

  const [message, setMessage] =
    useState<string | null>(null);

  async function loadTermsAccess() {
    setMessage(null);

    if (!isSupabaseConfigured()) {
      setMessage(
        "FieldsConnect Library access is currently unavailable."
      );
      setIsLoading(false);
      return;
    }

    try {
      const supabase =
        getSupabaseBrowserClient();

      const {
        data: sessionData,
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        throw sessionError;
      }

      if (!sessionData.session?.user) {
        setMessage(
          "Please log in before using the Library."
        );
        setIsLoading(false);
        return;
      }

      const [
        termsResult,
        acceptanceResult,
      ] = await Promise.all([
        supabase.rpc(
          "get_current_library_terms"
        ),
        supabase.rpc(
          "has_accepted_current_library_terms",
          {
            candidate:
              sessionData.session.user.id,
          }
        ),
      ]);

      if (termsResult.error) {
        throw termsResult.error;
      }

      if (acceptanceResult.error) {
        throw acceptanceResult.error;
      }

      const currentTerms =
        Array.isArray(termsResult.data)
          ? termsResult.data[0]
          : null;

      if (!currentTerms) {
        throw new Error(
          "No current Library Terms version is available."
        );
      }

      setTerms(currentTerms as LibraryTerms);
      setHasAccepted(
        acceptanceResult.data === true
      );
    } catch (error) {
      setMessage(
        getErrorMessage(
          error,
          "Unable to verify Library access."
        )
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadTermsAccess();
  }, []);

  async function acceptTerms() {
    if (
      !rightsAcknowledged ||
      !privacyAcknowledged ||
      !securityAcknowledged ||
      !takedownAcknowledged
    ) {
      setMessage(
        "Complete all required acknowledgements before continuing."
      );
      return;
    }

    setIsAccepting(true);
    setMessage(null);

    try {
      const supabase =
        getSupabaseBrowserClient();

      const { error } = await supabase.rpc(
        "accept_current_library_terms",
        {
          client_user_agent:
            typeof navigator === "undefined"
              ? null
              : navigator.userAgent,
        }
      );

      if (error) {
        throw error;
      }

      setHasAccepted(true);
    } catch (error) {
      setMessage(
        getErrorMessage(
          error,
          "Unable to record your acceptance."
        )
      );
    } finally {
      setIsAccepting(false);
    }
  }

  if (isLoading) {
    return (
      <main className="mx-auto min-h-screen w-full max-w-5xl px-4 py-8 sm:px-6">
        <section className="rounded-2xl border bg-white p-6">
          <p className="text-sm text-gray-600">
            Verifying Library access...
          </p>
        </section>
      </main>
    );
  }

  if (hasAccepted) {
    return <>{children}</>;
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-4 py-8 sm:px-6">
      <section className="grid gap-6 rounded-2xl border bg-white p-5 sm:p-8">
        <header>
          <p className="text-sm font-medium text-blue-700">
            Library access agreement
          </p>

          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            {terms?.title ??
              "FieldsConnect Library Terms"}
          </h1>

          <p className="mt-2 text-sm leading-6 text-gray-600">
            Version {terms?.version ?? "—"} ·
            Effective{" "}
            {terms?.effective_at
              ? new Date(
                  terms.effective_at
                ).toLocaleDateString()
              : "—"}
          </p>

          <p className="mt-4 leading-7 text-gray-700">
            {terms?.summary}
          </p>
        </header>

        <section
          aria-label="Library Terms"
          className="max-h-[28rem] overflow-y-auto rounded-xl border bg-gray-50 p-4"
        >
          <div className="whitespace-pre-wrap text-sm leading-7 text-gray-800">
            {terms?.terms_text}
          </div>
        </section>

        <section className="grid gap-3">
          <h2 className="font-semibold">
            Required acknowledgements
          </h2>

          <label className="flex items-start gap-3 rounded-xl border p-4 text-sm leading-6">
            <input
              checked={rightsAcknowledged}
              className="mt-1"
              onChange={(event) =>
                setRightsAcknowledged(
                  event.target.checked
                )
              }
              type="checkbox"
            />

            <span>
              I understand that I may only
              upload material that I own, am
              licensed or authorised to share,
              or may lawfully use under an
              applicable legal exception.
            </span>
          </label>

          <label className="flex items-start gap-3 rounded-xl border p-4 text-sm leading-6">
            <input
              checked={privacyAcknowledged}
              className="mt-1"
              onChange={(event) =>
                setPrivacyAcknowledged(
                  event.target.checked
                )
              }
              type="checkbox"
            />

            <span>
              I will not upload personal,
              confidential or sensitive
              information unless I have a
              lawful basis and appropriate
              authority.
            </span>
          </label>

          <label className="flex items-start gap-3 rounded-xl border p-4 text-sm leading-6">
            <input
              checked={securityAcknowledged}
              className="mt-1"
              onChange={(event) =>
                setSecurityAcknowledged(
                  event.target.checked
                )
              }
              type="checkbox"
            />

            <span>
              I will not upload malware,
              harmful code, stolen data,
              unlawfully obtained information
              or content intended to compromise
              another person or system.
            </span>
          </label>

          <label className="flex items-start gap-3 rounded-xl border p-4 text-sm leading-6">
            <input
              checked={takedownAcknowledged}
              className="mt-1"
              onChange={(event) =>
                setTakedownAcknowledged(
                  event.target.checked
                )
              }
              type="checkbox"
            />

            <span>
              I understand that FieldsConnect
              may restrict, unpublish or remove
              resources following a copyright,
              privacy, security or legal
              complaint, and may retain a
              limited audit record.
            </span>
          </label>
        </section>

        {message && (
          <p
            aria-live="polite"
            className="rounded-xl border bg-gray-50 p-4 text-sm text-gray-700"
          >
            {message}
          </p>
        )}

        <button
          className="min-h-11 w-full rounded-xl bg-gray-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50 sm:w-fit"
          disabled={
            isAccepting ||
            !rightsAcknowledged ||
            !privacyAcknowledged ||
            !securityAcknowledged ||
            !takedownAcknowledged
          }
          onClick={() => void acceptTerms()}
          type="button"
        >
          {isAccepting
            ? "Recording acceptance..."
            : "Accept and enter Library"}
        </button>


      </section>
    </main>
  );
}