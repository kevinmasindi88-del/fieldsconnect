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
        ? "Create your FieldsConnect account"
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
      <section className="mx-auto flex w-full max-w-md flex-col gap-4 rounded-xl border p-6">
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
      className="mx-auto flex w-full max-w-md flex-col gap-4 rounded-xl border p-6"
    >
      <div>
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="mt-2 text-sm text-gray-600">
          {mode === "signup"
            ? "Create your account, then verify your email before signing in."
            : mode === "reset"
              ? "Enter your email address and we will send you a password reset link."
              : "Log in to continue to FieldsConnect."}
        </p>
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
              className="absolute inset-y-0 right-0 px-3 text-lg text-gray-600"
              onClick={() => setShowPassword((current) => !current)}
              type="button"
            >
              {showPassword ? "🙈" : "👁"}
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
              aria-label={showConfirmPassword ? "Hide confirmed password" : "Show confirmed password"}
              className="absolute inset-y-0 right-0 px-3 text-lg text-gray-600"
              onClick={() => setShowConfirmPassword((current) => !current)}
              type="button"
            >
              {showConfirmPassword ? "🙈" : "👁"}
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
        className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        type="submit"
        disabled={isSubmitting}
      >
        {isSubmitting ? "Please wait..." : title}
      </button>

      {message && (
        <p className="rounded-lg border p-3 text-sm text-gray-700">{message}</p>
      )}
    </form>
  );
}