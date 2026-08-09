"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/browser";

type AuthMode = "login" | "signup" | "reset";

type AuthFormProps = {
  mode: AuthMode;
};

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [signupComplete, setSignupComplete] = useState(false);

  const title =
    mode === "login"
      ? "Log in"
      : mode === "signup"
        ? "Create your account"
        : "Reset your password";

  async function routeAfterLogin(userId: string) {
    const supabase = getSupabaseBrowserClient();

    const { data: profile, error } = await supabase
      .from("profiles")
      .select(
        "terms_accepted_at, privacy_accepted_at, community_guidelines_accepted_at, age_confirmed_at"
      )
      .eq("id", userId)
      .maybeSingle();

    if (error) throw error;

    const onboardingComplete =
      profile?.terms_accepted_at &&
      profile?.privacy_accepted_at &&
      profile?.community_guidelines_accepted_at &&
      profile?.age_confirmed_at;

    router.push(onboardingComplete ? "/timeline" : "/onboarding");
    router.refresh();
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    if (!isSupabaseConfigured()) {
      setMessage("Supabase is not configured yet. Add local environment values first.");
      return;
    }

    if (mode === "signup" && password !== confirmPassword) {
      setMessage("The passwords do not match.");
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
          className="w-fit rounded-lg border px-4 py-2 text-sm font-medium"
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
        disabled={isSubmitting}
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