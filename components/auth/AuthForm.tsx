"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/browser";
import { LegalAgreementCheckbox, LEGAL_AGREEMENT_VERSION } from "@/components/onboarding/LegalAgreementCheckbox";

type AuthMode = "login" | "signup" | "reset";
type NetworkCategory = "student" | "professional" | "institution";
const networkCategories: NetworkCategory[] = ["student", "professional", "institution"];

type AuthFormProps = {
  mode: AuthMode;
};

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [networkCategory, setNetworkCategory] = useState<NetworkCategory | "">("");
  const [fieldOfInterest, setFieldOfInterest] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [signupComplete, setSignupComplete] = useState(false);
  const [agreementAccepted, setAgreementAccepted] = useState(false);
  const [isAdultDeclared, setIsAdultDeclared] = useState(false);

  const title =
    mode === "login"
      ? "Log in"
      : mode === "signup"
        ? "Create your account"
        : "Reset your password";

  const routeAfterLogin = useCallback(async (userId: string) => {
    const supabase = getSupabaseBrowserClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!authData.user || authData.user.id !== userId) {
      throw new Error("Unable to verify your signed-in account.");
    }

    const { data: existingProfile, error: profileLookupError } = await supabase
      .from("profiles")
      .select("id, terms_accepted_at, privacy_accepted_at, community_guidelines_accepted_at")
      .eq("id", userId)
      .maybeSingle();
    if (profileLookupError) throw profileLookupError;

    const completePolicies = Boolean(
      existingProfile?.terms_accepted_at &&
      existingProfile.privacy_accepted_at &&
      existingProfile.community_guidelines_accepted_at
    );
    if (completePolicies) {
      router.push("/timeline");
      router.refresh();
      return;
    }

    // Require the protected server-side signup record, not user-editable
    // metadata, as evidence of policy acknowledgement.
    const { data: agreement, error: agreementError } = await supabase
      .from("user_legal_agreements")
      .select("agreement_version")
      .eq("user_id", userId)
      .eq("agreement_version", LEGAL_AGREEMENT_VERSION)
      .maybeSingle();
    if (agreementError) throw agreementError;

    const hasAgreement = Boolean(agreement);
    const now = new Date().toISOString();
    const policyTimes = hasAgreement
      ? {
          terms_accepted_at: now,
          privacy_accepted_at: now,
          community_guidelines_accepted_at: now,
        }
      : {};

    if (!existingProfile) {
      // Signup already collects the member's name, category and field.
      // Read those self-declared profile details after verified sign-in.
      // User metadata is not used to grant any permissions or determine
      // legal guardian consent; it is only source data for the user's profile.
      const metadata = authData.user.user_metadata;
      const storedName = typeof metadata?.display_name === "string"
        ? metadata.display_name.trim().slice(0, 120)
        : "";
      const storedCategory = networkCategories.includes(metadata?.role_type as NetworkCategory)
        ? (metadata.role_type as NetworkCategory)
        : null;
      const storedField = typeof metadata?.field === "string"
        ? metadata.field.trim().slice(0, 120)
        : "";
      const emailLocal = authData.user.email?.split("@")[0] ?? "";
      const provisionalName =
        storedName || emailLocal.replace(/[._-]+/g, " ").trim().slice(0, 120) || "New member";
      const { error: createError } = await supabase.from("profiles").insert({
        id: userId,
        display_name: provisionalName,
        role_type: storedCategory,
        field: storedField || null,
        profile_visibility: "private",
        mentor_available: false,
        ...policyTimes,
      });
      if (createError && createError.code !== "23505") throw createError;
    } else if (hasAgreement) {
      // Only fill missing legacy acceptance timestamps, keeping existing
      // profile preferences and historical acceptance dates untouched.
      const { error: updateError } = await supabase.from("profiles")
        .update({
          terms_accepted_at: existingProfile.terms_accepted_at ?? now,
          privacy_accepted_at: existingProfile.privacy_accepted_at ?? now,
          community_guidelines_accepted_at: existingProfile.community_guidelines_accepted_at ?? now,
        })
        .eq("id", userId);
      if (updateError) throw updateError;
    }

    router.push(hasAgreement ? "/timeline" : "/onboarding");
    router.refresh();
  }, [router]);

  // Verification links may establish a session automatically. If they do,
  // take the confirmed member directly to the timeline instead of making
  // them submit a second login form after email verification.
  useEffect(() => {
    if (mode !== "login" || !isSupabaseConfigured()) return;
    let active = true;
    const supabase = getSupabaseBrowserClient();
    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active || error || !data.session?.user?.email_confirmed_at) return;
      void routeAfterLogin(data.session.user.id).catch((error: unknown) => {
        if (active) setMessage(error instanceof Error ? error.message : "Unable to complete sign-in.");
      });
    });
    return () => { active = false; };
  }, [mode, routeAfterLogin]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    if (!isSupabaseConfigured()) {
      setMessage("Supabase is not configured yet. Add local environment values first.");
      return;
    }

    if (mode === "signup") {
      if (!isAdultDeclared) {
        setMessage("If you are under 18, please use the guardian-assisted registration route.");
        return;
      }
      const name = displayName.trim();
      const interest = fieldOfInterest.trim();
      if (name.length < 2 || name.length > 120) {
        setMessage("Enter your name (2–120 characters).");
        return;
      }
      if (!networkCategory) {
        setMessage("Select your career or educational category.");
        return;
      }
      if (interest.length < 2 || interest.length > 120) {
        setMessage("Enter your field of interest (2–120 characters).");
        return;
      }
    }

    if (mode === "signup" && password !== confirmPassword) {
      setMessage("The passwords do not match.");
      return;
    }

    if (mode === "signup" && !agreementAccepted) {
      setMessage("Please accept the FieldsConnect agreement before continuing.");
      return;
    }

    setIsSubmitting(true);

    try {
      const supabase = getSupabaseBrowserClient();

      if (mode === "login") {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error) throw error;
        if (!data.user) throw new Error("Unable to identify the signed-in user.");

        await routeAfterLogin(data.user.id);
        return;
      }

      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/login`,
            // User attestation at registration; the server stores an immutable
            // versioned record when the account is first created.
            data: {
              display_name: displayName.trim(),
              role_type: networkCategory,
              field: fieldOfInterest.trim(),
              // Age is self-declared: this is not verified identity or guardian consent.
              fc_age_18_plus_declared: true,
              fc_agreement_accepted: true,
              fc_agreement_version: LEGAL_AGREEMENT_VERSION,
            },
          },
        });

        if (error) throw error;

        if (data.session && data.user) {
          await routeAfterLogin(data.user.id);
          return;
        }

        setSignupComplete(true);
        setMessage(
          "A confirmation link has been sent to your email. Open it to verify your address and complete signup."
        );
        return;
      }

      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) throw error;

      setMessage(
        "A password reset link has been sent if an account exists for that email address."
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (mode === "signup" && signupComplete) {
    return (
      <section className="mx-auto flex w-full max-w-md flex-col gap-5 rounded-3xl border border-gray-200 bg-white p-6 text-center shadow-xl shadow-gray-200/60 sm:p-8">
        <Link
          aria-label="FieldsConnect home"
          className="inline-flex items-center justify-center text-3xl font-bold tracking-tight"
          href="/"
        >
          <span className="text-blue-700">Fields</span>
          <span className="text-gray-950">Connect</span>
        </Link>

        <div>
          <h1 className="text-2xl font-semibold">Check your email</h1>
          <p className="mt-2 text-sm text-gray-700">
            A confirmation link has been sent to <strong>{email}</strong>. Open the link to
            verify your address and complete signup.
          </p>
        </div>

        <p className="rounded-lg border bg-gray-50 p-3 text-sm text-gray-700">
          Open the confirmation link in the same browser profile where you want to use
          FieldsConnect.
        </p>

        <Link
          className="w-full rounded-lg border px-4 py-2 text-center text-sm font-medium sm:w-fit"
          href="/login"
        >
          Go to login
        </Link>
      </section>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mx-auto flex w-full max-w-md flex-col gap-5 rounded-3xl border border-gray-200 bg-white p-6 shadow-xl shadow-gray-200/60 sm:p-8"
    >
      <div className="text-center">
        <Link
          aria-label="FieldsConnect home"
          className="inline-flex items-center justify-center text-3xl font-bold tracking-tight"
          href="/"
        >
          <span className="text-blue-700">Fields</span>
          <span className="text-gray-950">Connect</span>
        </Link>

        {mode !== "login" && (
          <>
            <h1 className="mt-6 text-2xl font-semibold tracking-tight text-gray-950">
              {title}
            </h1>

            <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-gray-600">
              {mode === "signup"
                ? "Create your account, then verify your email before signing in."
                : "Enter your email address and we will send you a password reset link."}
            </p>
          </>
        )}
      </div>

      {mode === "signup" && (
        <label className="flex flex-col gap-2 text-sm font-medium">
            Name
            <input
              autoComplete="name"
              className="min-h-11 rounded-lg border px-3 py-2"
              type="text"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              maxLength={120}
              minLength={2}
              placeholder="Your name"
              required
            />
        </label>
      )}

      <label className="flex flex-col gap-2 text-sm font-medium">
        Email
        <input
          autoComplete="email"
          className="rounded-lg border px-3 py-2"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
      </label>

      {mode === "signup" && (
        <div className="space-y-3">
          <label className="flex items-start gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm leading-6 text-gray-800">
            <input
              type="checkbox"
              id="fc-age-18-plus"
              checked={isAdultDeclared}
              onChange={(event) => setIsAdultDeclared(event.target.checked)}
              className="mt-1 h-4 w-4 shrink-0 accent-blue-700"
            />
            <span>I confirm that I am 18 years old or older.</span>
          </label>
          {!isAdultDeclared && (
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-950">
              <p>Under 18? Your parent or legal guardian can help you register through the guardian-assisted process.</p>
              <Link className="mt-2 inline-flex font-semibold text-blue-700 underline underline-offset-2 hover:text-blue-900" href="/guardian-registration">
                Guardian-assisted registration
              </Link>
            </div>
          )}
        </div>
      )}

      {mode === "signup" && (
        <>
          <label className="flex flex-col gap-2 text-sm font-medium">
            Career or educational category
            <select
              className="min-h-11 rounded-lg border px-3 py-2"
              value={networkCategory}
              onChange={(event) => setNetworkCategory(event.target.value as NetworkCategory | "")}
              required
            >
              <option value="" disabled>Select a category</option>
              <option value="student">Student / Learner</option>
              <option value="professional">Professional</option>
              <option value="institution">Institution</option>
            </select>
          </label>

          <label className="flex flex-col gap-2 text-sm font-medium">
            Field of interest
            <input
              className="min-h-11 rounded-lg border px-3 py-2"
              type="text"
              value={fieldOfInterest}
              onChange={(event) => setFieldOfInterest(event.target.value)}
              maxLength={120}
              minLength={2}
              placeholder="e.g. Pharmacy, Engineering, Law"
              required
            />
          </label>
        </>
      )}

      {mode !== "reset" && (
        <label className="flex flex-col gap-2 text-sm font-medium">
          Password
          <div className="relative">
            <input
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              className="w-full rounded-lg border px-3 py-2 pr-12"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={8}
            />
            <button
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              className={[
                "absolute inset-y-1 right-1 flex w-10 items-center justify-center rounded-lg border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600",
                showPassword
                  ? "border-gray-950 bg-gray-950 text-white"
                  : "border-transparent bg-white text-gray-700 hover:bg-gray-100",
              ].join(" ")}
              onClick={() => setShowPassword((current) => !current)}
              title={showPassword ? "Hide password" : "Show password"}
              type="button"
            >
              <svg
                aria-hidden="true"
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
              >
                <path
                  d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.8"
                />
                <circle
                  cx="12"
                  cy="12"
                  r="2.8"
                  stroke="currentColor"
                  strokeWidth="1.8"
                />
              </svg>
            </button>
          </div>
        </label>
      )}

      {mode === "signup" && (
        <label className="flex flex-col gap-2 text-sm font-medium">
          Confirm password
          <div className="relative">
            <input
              autoComplete="new-password"
              className="w-full rounded-lg border px-3 py-2 pr-12"
              type={showConfirmPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
              minLength={8}
            />
            <button
              aria-label={
                showConfirmPassword
                  ? "Hide confirmed password"
                  : "Show confirmed password"
              }
              aria-pressed={showConfirmPassword}
              className={[
                "absolute inset-y-1 right-1 flex w-10 items-center justify-center rounded-lg border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600",
                showConfirmPassword
                  ? "border-gray-950 bg-gray-950 text-white"
                  : "border-transparent bg-white text-gray-700 hover:bg-gray-100",
              ].join(" ")}
              onClick={() =>
                setShowConfirmPassword((current) => !current)
              }
              title={
                showConfirmPassword
                  ? "Hide confirmed password"
                  : "Show confirmed password"
              }
              type="button"
            >
              <svg
                aria-hidden="true"
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
              >
                <path
                  d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.8"
                />
                <circle
                  cx="12"
                  cy="12"
                  r="2.8"
                  stroke="currentColor"
                  strokeWidth="1.8"
                />
              </svg>
            </button>
          </div>
        </label>
      )}

      {mode === "signup" && (
        <LegalAgreementCheckbox
          id="fc-signup-agreement"
          checked={agreementAccepted}
          onChange={setAgreementAccepted}
        />
      )}

      {mode === "login" && (
        <div className="text-right">
          <Link className="text-sm font-medium underline" href="/reset-password">
            Forgot password?
          </Link>
        </div>
      )}

      <button
        className="min-h-12 rounded-xl bg-gray-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:opacity-50"
        type="submit"
        disabled={
          isSubmitting ||
          (mode === "signup" &&
            (!isAdultDeclared || !agreementAccepted || !displayName.trim() || !networkCategory || !fieldOfInterest.trim()))
        }
      >
        {isSubmitting ? "Please wait..." : title}
      </button>

      {mode === "login" && (
        <p className="text-center text-sm text-gray-600">
          New to FieldsConnect?{" "}
          <Link
            className="font-semibold text-blue-700 hover:text-blue-800 hover:underline"
            href="/signup"
          >
            Create an account
          </Link>
        </p>
      )}

      {mode === "signup" && (
        <p className="text-center text-sm text-gray-600">
          Already have an account?{" "}
          <Link
            className="font-semibold text-blue-700 hover:text-blue-800 hover:underline"
            href="/login"
          >
            Log in
          </Link>
        </p>
      )}

      {message && (
        <p className="rounded-lg border p-3 text-sm text-gray-700">{message}</p>
      )}
    </form>
  );
}