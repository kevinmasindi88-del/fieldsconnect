"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  getSupabaseBrowserClient,
  isSupabaseConfigured,
} from "@/lib/supabase/browser";

export function ResetPasswordWorkflow() {
  const router = useRouter();

  const [isCheckingLink, setIsCheckingLink] = useState(true);
  const [isRecoveryReady, setIsRecoveryReady] = useState(false);
  const [hasRecoveryLink, setHasRecoveryLink] = useState(false);

  const [email, setEmail] = useState("");
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setMessage("Supabase is not configured.");
      setIsCheckingLink(false);
      return;
    }

    const supabase = getSupabaseBrowserClient();
    let isMounted = true;

    const searchParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(
      window.location.hash.replace(/^#/, "")
    );

    const code = searchParams.get("code");
    const accessToken = hashParams.get("access_token");
    const refreshToken = hashParams.get("refresh_token");
    const recoveryType = hashParams.get("type");

    const recoveryLinkPresent =
      Boolean(code) ||
      Boolean(
        accessToken &&
          refreshToken &&
          recoveryType === "recovery"
      );

    setHasRecoveryLink(recoveryLinkPresent);

    async function prepareRecoverySession() {
      try {
        if (code) {
          const { error } =
            await supabase.auth.exchangeCodeForSession(code);

          if (error) throw error;

          window.history.replaceState(
            {},
            document.title,
            "/reset-password"
          );
        }

        if (
          accessToken &&
          refreshToken &&
          recoveryType === "recovery"
        ) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (error) throw error;

          window.history.replaceState(
            {},
            document.title,
            "/reset-password"
          );
        }

        if (!recoveryLinkPresent) {
          if (isMounted) {
            setIsCheckingLink(false);
            setMessage(null);
          }

          return;
        }

        await new Promise((resolve) =>
          window.setTimeout(resolve, 500)
        );

        const {
          data: sessionData,
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) throw sessionError;

        if (sessionData.session) {
          if (isMounted) {
            setIsRecoveryReady(true);
            setIsCheckingLink(false);
            setMessage(null);
          }

          return;
        }

        if (isMounted) {
          setMessage(
            "This password reset link is invalid or has expired. Request a fresh reset link."
          );
          setIsCheckingLink(false);
        }
      } catch (error) {
        if (isMounted) {
          setMessage(
            error instanceof Error
              ? error.message
              : "Unable to validate the password reset link."
          );
          setIsCheckingLink(false);
        }
      }
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (
        (event === "PASSWORD_RECOVERY" ||
          event === "SIGNED_IN" ||
          event === "INITIAL_SESSION") &&
        session &&
        recoveryLinkPresent
      ) {
        setIsRecoveryReady(true);
        setIsCheckingLink(false);
        setMessage(null);
      }
    });

    void prepareRecoverySession();

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function handleRequestReset(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    setMessage(null);
    setEmailSent(false);

    const cleanEmail = email.trim();

    if (!cleanEmail) {
      setMessage("Enter the email address linked to your account.");
      return;
    }

    setIsSendingEmail(true);

    try {
      const supabase = getSupabaseBrowserClient();

      const { error } =
        await supabase.auth.resetPasswordForEmail(cleanEmail, {
          redirectTo: `${window.location.origin}/reset-password`,
        });

      if (error) throw error;

      setEmailSent(true);
      setMessage(
        "Check your email for a password reset link. Use the newest email sent to you."
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to send the password reset email."
      );
    } finally {
      setIsSendingEmail(false);
    }
  }

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    setMessage(null);

    if (password.length < 8) {
      setMessage(
        "Your new password must contain at least 8 characters."
      );
      return;
    }

    if (password !== confirmPassword) {
      setMessage("The passwords do not match.");
      return;
    }

    setIsSubmitting(true);

    try {
      const supabase = getSupabaseBrowserClient();

      const { error } = await supabase.auth.updateUser({
        password,
      });

      if (error) throw error;

      await supabase.auth.signOut();

      router.replace("/login");
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to reset your password."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isCheckingLink) {
    return (
      <section className="mx-auto w-full max-w-md rounded-xl border p-6">
        <h1 className="text-2xl font-semibold">
          Checking reset link
        </h1>

        <p className="mt-2 text-sm text-gray-600">
          Please wait while FieldsConnect verifies your password
          recovery link.
        </p>
      </section>
    );
  }

  if (!hasRecoveryLink && !isRecoveryReady) {
    return (
      <form
        className="mx-auto flex w-full max-w-md flex-col gap-4 rounded-xl border p-6"
        onSubmit={handleRequestReset}
      >
        <div>
          <h1 className="text-2xl font-semibold">
            Forgot your password?
          </h1>

          <p className="mt-2 text-sm text-gray-600">
            Enter your email address and FieldsConnect will send
            you a secure password reset link.
          </p>
        </div>

        <label className="flex flex-col gap-2 text-sm font-medium">
          Email address

          <input
            autoComplete="email"
            className="rounded-lg border px-3 py-2"
            disabled={isSendingEmail}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            required
            type="email"
            value={email}
          />
        </label>

        <button
          className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          disabled={isSendingEmail}
          type="submit"
        >
          {isSendingEmail
            ? "Sending reset link..."
            : "Send reset link"}
        </button>

        {message && (
          <p className="rounded-lg border p-3 text-sm text-gray-700">
            {message}
          </p>
        )}

        {emailSent && (
          <p className="text-sm text-gray-600">
            You can close this page after opening the email.
          </p>
        )}

        <Link
          className="w-fit text-sm font-medium underline"
          href="/login"
        >
          Return to login
        </Link>
      </form>
    );
  }

  if (!isRecoveryReady) {
    return (
      <section className="mx-auto flex w-full max-w-md flex-col gap-4 rounded-xl border p-6">
        <div>
          <h1 className="text-2xl font-semibold">
            Reset link unavailable
          </h1>

          <p className="mt-2 text-sm text-gray-600">
            {message}
          </p>
        </div>

        <Link
          className="w-fit rounded-lg border px-4 py-2 text-sm font-medium"
          href="/reset-password"
        >
          Request a new reset link
        </Link>

        <Link
          className="w-fit text-sm font-medium underline"
          href="/login"
        >
          Return to login
        </Link>
      </section>
    );
  }

  return (
    <form
      className="mx-auto flex w-full max-w-md flex-col gap-4 rounded-xl border p-6"
      onSubmit={handleSubmit}
    >
      <div>
        <h1 className="text-2xl font-semibold">
          Choose a new password
        </h1>

        <p className="mt-2 text-sm text-gray-600">
          Enter and confirm your new FieldsConnect password.
        </p>
      </div>

      <label className="flex flex-col gap-2 text-sm font-medium">
        New password

        <div className="relative">
          <input
            autoComplete="new-password"
            className="w-full rounded-lg border px-3 py-2 pr-20"
            minLength={8}
            onChange={(event) =>
              setPassword(event.target.value)
            }
            required
            type={showPassword ? "text" : "password"}
            value={password}
          />

          <button
            aria-label={
              showPassword ? "Hide password" : "Show password"
            }
            className="absolute inset-y-0 right-0 px-3 text-sm font-medium text-gray-600"
            onClick={() =>
              setShowPassword((current) => !current)
            }
            type="button"
          >
            {showPassword ? "Hide" : "Show"}
          </button>
        </div>
      </label>

      <label className="flex flex-col gap-2 text-sm font-medium">
        Confirm new password

        <div className="relative">
          <input
            autoComplete="new-password"
            className="w-full rounded-lg border px-3 py-2 pr-20"
            minLength={8}
            onChange={(event) =>
              setConfirmPassword(event.target.value)
            }
            required
            type={showConfirmPassword ? "text" : "password"}
            value={confirmPassword}
          />

          <button
            aria-label={
              showConfirmPassword
                ? "Hide confirmed password"
                : "Show confirmed password"
            }
            className="absolute inset-y-0 right-0 px-3 text-sm font-medium text-gray-600"
            onClick={() =>
              setShowConfirmPassword((current) => !current)
            }
            type="button"
          >
            {showConfirmPassword ? "Hide" : "Show"}
          </button>
        </div>
      </label>

      <button
        className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        disabled={isSubmitting}
        type="submit"
      >
        {isSubmitting
          ? "Resetting password..."
          : "Reset password"}
      </button>

      {message && (
        <p className="rounded-lg border p-3 text-sm text-gray-700">
          {message}
        </p>
      )}
    </form>
  );
}