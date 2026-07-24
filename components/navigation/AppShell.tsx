"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  getSupabaseBrowserClient,
  isSupabaseConfigured,
} from "@/lib/supabase/browser";

const authRoutes = new Set(["/login", "/signup", "/reset-password"]);

const suspensionAllowedRoutes = new Set([
  "/notifications",
  "/code-of-conduct",
]);

const navItems = [
  { href: "/", label: "Home" },
  { href: "/profile", label: "Profile" },
  { href: "/connections", label: "Connections" },
  { href: "/messages", label: "Messages" },
  { href: "/notifications", label: "Notifications" },
  { href: "/skills", label: "Skills" },
  { href: "/library", label: "Library" },
  { href: "/moderation", label: "Moderation" },
];

type ActiveSuspension = {
  suspension_id: string;
  report_id: string;
  duration_days: number;
  reason: string;
  starts_at: string;
  ends_at: string;
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const shouldHideNavigation = authRoutes.has(pathname);

  const [user, setUser] = useState<User | null>(null);
  const [welcomeName, setWelcomeName] = useState<string | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [activeSuspension, setActiveSuspension] =
    useState<ActiveSuspension | null>(null);

  const [suspensionCheckMessage, setSuspensionCheckMessage] =
    useState<string | null>(null);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setIsLoadingAuth(false);
      return;
    }

    const supabase = getSupabaseBrowserClient();

    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setIsLoadingAuth(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setIsLoadingAuth(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || !isSupabaseConfigured()) {
      setWelcomeName(null);
      return;
    }

    const supabase = getSupabaseBrowserClient();
    const authenticatedUser = user;

    async function loadWelcomeName() {
      const { data, error } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", authenticatedUser.id)
        .maybeSingle();

      if (!error && data?.display_name?.trim()) {
        setWelcomeName(data.display_name.trim());
        return;
      }

      const metadataName =
        typeof authenticatedUser.user_metadata?.display_name === "string"
          ? authenticatedUser.user_metadata.display_name
          : typeof authenticatedUser.user_metadata?.full_name === "string"
            ? authenticatedUser.user_metadata.full_name
            : null;

      setWelcomeName(
        metadataName?.trim() ||
          authenticatedUser.email?.split("@")[0] ||
          "there"
      );
    }

    void loadWelcomeName();
  }, [user]);

  useEffect(() => {
    if (!user || !isSupabaseConfigured()) {
      setActiveSuspension(null);
      setSuspensionCheckMessage(null);
      return;
    }

    const supabase = getSupabaseBrowserClient();
    let isCancelled = false;

    async function loadActiveSuspension() {
      try {
        const { data, error } = await supabase.rpc(
          "get_my_active_suspension"
        );

        if (error) throw error;
        if (isCancelled) return;

        const suspensionData = Array.isArray(data)
          ? data[0]
          : data;

        setActiveSuspension(
          suspensionData
            ? (suspensionData as ActiveSuspension)
            : null
        );

        setSuspensionCheckMessage(null);
      } catch (error) {
        if (isCancelled) return;

        console.error(
          "Unable to check active account suspension:",
          error
        );

        setSuspensionCheckMessage(
          "Unable to refresh your account status. Please try again shortly."
        );
      }
    }

    void loadActiveSuspension();

    const intervalId = window.setInterval(() => {
      void loadActiveSuspension();
    }, 30000);

    function handleWindowFocus() {
      void loadActiveSuspension();
    }

    window.addEventListener("focus", handleWindowFocus);

    return () => {
      isCancelled = true;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleWindowFocus);
    };
  }, [user]);

  useEffect(() => {
    if (!user || !isSupabaseConfigured()) {
      setUnreadNotificationCount(0);
      setUnreadMessageCount(0);
      return;
    }

    const supabase = getSupabaseBrowserClient();

    async function loadUnreadCounts() {
      const [
        { count: notificationCount, error: notificationError },
        { count: messageCount, error: messageError },
      ] = await Promise.all([
        supabase
          .from("notifications")
          .select("id", { count: "exact", head: true })
          .is("read_at", null),
        supabase
          .from("notifications")
          .select("id", { count: "exact", head: true })
          .eq("notification_type", "new_message")
          .is("read_at", null),
      ]);

      if (!notificationError) {
        setUnreadNotificationCount(notificationCount ?? 0);
      }

      if (!messageError) {
        setUnreadMessageCount(messageCount ?? 0);
      }
    }

    void loadUnreadCounts();

    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `recipient_id=eq.${user.id}`,
        },
        () => {
          void loadUnreadCounts();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user, pathname]);

  async function handleLogout() {
    if (!isSupabaseConfigured()) return;

    const supabase = getSupabaseBrowserClient();

    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  if (shouldHideNavigation) {
    return <>{children}</>;
  }


  if (user && activeSuspension) {
    const isAllowedSuspensionRoute =
      suspensionAllowedRoutes.has(pathname);

    return (
      <div className="min-h-screen bg-gray-50 text-gray-950">
        <header className="border-b bg-white">
          <div className="mx-auto flex max-w-5xl flex-col gap-4 px-6 py-4 md:flex-row md:items-center md:justify-between">
            <Link className="text-xl font-bold tracking-tight" href="/">
              FieldsConnect
            </Link>

            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-medium text-gray-700">
                {welcomeName
                  ? `Signed in as ${welcomeName}`
                  : "Signed in"}
              </span>

              <Link
                className="rounded-lg border px-3 py-2 text-sm font-medium"
                href="/notifications"
              >
                Notifications
                {unreadNotificationCount > 0 && (
                  <span className="ml-2 rounded-full bg-red-700 px-2 py-0.5 text-xs font-semibold text-white">
                    {unreadNotificationCount > 99
                      ? "99+"
                      : unreadNotificationCount}
                  </span>
                )}
              </Link>

              <Link
                className="rounded-lg border px-3 py-2 text-sm font-medium"
                href="/code-of-conduct"
              >
                Code of Conduct
              </Link>

              <button
                className="rounded-lg bg-black px-3 py-2 text-sm font-medium text-white"
                onClick={handleLogout}
                type="button"
              >
                Logout
              </button>
            </div>
          </div>
        </header>

        {isAllowedSuspensionRoute ? (
          <>
            <div className="mx-auto max-w-5xl px-6 pt-6">
              <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-800">
                Your account is currently suspended. Only notifications,
                the Code of Conduct and logout are available.
              </div>
            </div>

            {children}
          </>
        ) : (
          <SuspensionScreen
            suspension={activeSuspension}
            suspensionCheckMessage={suspensionCheckMessage}
          />
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-gray-950">
      <header className="sticky top-0 z-20 border-b bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-4">
          <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
            <Link href="/" className="text-xl font-bold tracking-tight">
              FieldsConnect
            </Link>

            <div className="flex flex-wrap items-center gap-3">
              {isLoadingAuth ? (
                <span className="text-sm text-gray-500">
                  Checking session...
                </span>
              ) : user ? (
                <>
                  <span className="text-sm font-medium text-gray-700">
                    Welcome, {welcomeName ?? "..."}
                  </span>

                  <button
                    className="rounded-lg bg-black px-3 py-2 text-sm font-medium text-white"
                    type="button"
                    onClick={handleLogout}
                  >
                    Logout
                  </button>
                </>
              ) : (
                <>
                  <Link
                    className="rounded-lg border px-3 py-2 text-sm font-medium"
                    href="/login"
                  >
                    Login
                  </Link>

                  <Link
                    className="rounded-lg bg-black px-3 py-2 text-sm font-medium text-white"
                    href="/signup"
                  >
                    Sign up
                  </Link>
                </>
              )}
            </div>
          </div>

          <nav className="flex gap-2 overflow-x-auto pb-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href;

              return (
                <Link
                  key={item.href}
                  className={[
                    "whitespace-nowrap rounded-full border px-3 py-2 text-sm",
                    isActive
                      ? "bg-black text-white"
                      : "bg-white text-gray-700 hover:bg-gray-50",
                  ].join(" ")}
                  href={item.href}
                >
                  {item.label}

                  {item.href === "/messages" &&
                    unreadMessageCount > 0 && (
                      <span
                        className={[
                          "ml-2 inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-xs font-semibold",
                          isActive
                            ? "bg-white text-black"
                            : "bg-black text-white",
                        ].join(" ")}
                      >
                        {unreadMessageCount > 99
                          ? "99+"
                          : unreadMessageCount}
                      </span>
                    )}

                  {item.href === "/notifications" &&
                    unreadNotificationCount > 0 && (
                      <span
                        className={[
                          "ml-2 inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-xs font-semibold",
                          isActive
                            ? "bg-white text-black"
                            : "bg-black text-white",
                        ].join(" ")}
                      >
                        {unreadNotificationCount > 99
                          ? "99+"
                          : unreadNotificationCount}
                      </span>
                    )}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      {children}
    </div>
  );
}

function SuspensionScreen({
  suspension,
  suspensionCheckMessage,
}: {
  suspension: ActiveSuspension;
  suspensionCheckMessage: string | null;
}) {
  const startDate = new Date(suspension.starts_at);
  const endDate = new Date(suspension.ends_at);

  const remainingMilliseconds = Math.max(
    0,
    endDate.getTime() - Date.now()
  );

  const remainingDays = Math.max(
    1,
    Math.ceil(remainingMilliseconds / (1000 * 60 * 60 * 24))
  );

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col px-6 py-12">
      <section className="overflow-hidden rounded-2xl border border-red-300 bg-white shadow-sm">
        <div className="border-b border-red-200 bg-red-50 px-6 py-5">
          <p className="text-sm font-semibold uppercase tracking-wide text-red-700">
            Account suspended
          </p>

          <h1 className="mt-2 text-3xl font-semibold text-red-950">
            FieldsConnect activity is temporarily unavailable
          </h1>

          <p className="mt-3 text-sm leading-6 text-red-900">
            Your account remains accessible for reviewing notifications
            and the Code of Conduct, but platform participation is disabled
            until the suspension ends or is lifted following senior review.
          </p>
        </div>

        <div className="space-y-6 p-6">
          <dl className="grid gap-4 text-sm md:grid-cols-2">
            <div className="rounded-xl bg-gray-50 p-4">
              <dt className="font-medium text-gray-600">
                Suspension duration
              </dt>
              <dd className="mt-1 text-lg font-semibold">
                {suspension.duration_days} days
              </dd>
            </div>

            <div className="rounded-xl bg-gray-50 p-4">
              <dt className="font-medium text-gray-600">
                Estimated remaining period
              </dt>
              <dd className="mt-1 text-lg font-semibold">
                {remainingDays}{" "}
                {remainingDays === 1 ? "day" : "days"}
              </dd>
            </div>

            <div className="rounded-xl bg-gray-50 p-4">
              <dt className="font-medium text-gray-600">
                Suspension started
              </dt>
              <dd className="mt-1 font-medium">
                {startDate.toLocaleString("en-ZA", {
                  dateStyle: "long",
                  timeStyle: "short",
                })}
              </dd>
            </div>

            <div className="rounded-xl bg-gray-50 p-4">
              <dt className="font-medium text-gray-600">
                Scheduled restoration
              </dt>
              <dd className="mt-1 font-medium">
                {endDate.toLocaleString("en-ZA", {
                  dateStyle: "long",
                  timeStyle: "short",
                })}
              </dd>
            </div>
          </dl>

          <div className="rounded-xl border border-red-200 bg-red-50 p-4">
            <h2 className="font-semibold text-red-950">
              Reason for suspension
            </h2>

            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-red-900">
              {suspension.reason}
            </p>
          </div>

          <div className="rounded-xl border p-4">
            <h2 className="font-semibold">
              Available during suspension
            </h2>

            <p className="mt-2 text-sm leading-6 text-gray-600">
              You may review platform notifications and read the
              FieldsConnect Code of Conduct. Normal access will be restored
              automatically when the suspension expires or is lifted early.
            </p>

            <div className="mt-4 flex flex-wrap gap-3">
              <Link
                className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white"
                href="/notifications"
              >
                View notifications
              </Link>

              <Link
                className="rounded-lg border px-4 py-2 text-sm font-medium"
                href="/code-of-conduct"
              >
                Read Code of Conduct
              </Link>
            </div>
          </div>

          {suspensionCheckMessage && (
            <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              {suspensionCheckMessage}
            </p>
          )}

          <p className="text-xs leading-5 text-gray-500">
            Account status is checked automatically. Following an early
            lift, access should return within 30 seconds or when this tab
            regains focus.
          </p>
        </div>
      </section>
    </main>
  );
}