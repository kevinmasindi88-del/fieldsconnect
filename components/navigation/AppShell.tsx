"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";
import type { User } from "@supabase/supabase-js";
import Link from "next/link";
import { RoleAwareAccountLinks } from "@/components/navigation/RoleAwareAccountLinks";
import { usePathname, useRouter } from "next/navigation";
import {
  getSupabaseBrowserClient,
  isSupabaseConfigured,
} from "@/lib/supabase/browser";

type OnlinePresence = {
  user_id?: string;
  online_at?: string;
};

const OnlinePresenceContext =
  createContext<ReadonlySet<string>>(
    new Set()
  );

export function useOnlinePresence() {
  return useContext(
    OnlinePresenceContext
  );
}

const authRoutes = new Set(["/login", "/signup", "/reset-password"]);

const publicRoutes = new Set([
  "/",
  "/login",
  "/signup",
  "/reset-password",
  "/code-of-conduct",
]);

const suspensionAllowedRoutes = new Set([
  "/notifications",
  "/code-of-conduct",
]);

const navItems = [
  { href: "/timeline", label: "Home" },
  { href: "/connections", label: "Connections" },
  { href: "/messages", label: "Messages" },
  { href: "/notifications", label: "Notifications" },
  { href: "/skills", label: "Skills" },
  { href: "/library", label: "Library" },
];

type MobileNavIconName =
  | "home"
  | "connections"
  | "messages"
  | "notifications"
  | "skills"
  | "library";

const mobileNavItems: Array<{
  href: string;
  label: string;
  icon: MobileNavIconName;
}> = [
  {
    href: "/timeline",
    label: "Home",
    icon: "home",
  },
  {
    href: "/connections",
    label: "Connect",
    icon: "connections",
  },
  {
    href: "/messages",
    label: "Messages",
    icon: "messages",
  },
  {
    href: "/notifications",
    label: "Alerts",
    icon: "notifications",
  },
  {
    href: "/skills",
    label: "Skills",
    icon: "skills",
  },
  {
    href: "/library",
    label: "Library",
    icon: "library",
  },
];

function MobileNavIcon({
  name,
  className = "h-5 w-5",
}: {
  name: MobileNavIconName | "account";
  className?: string;
}) {
  const commonProps = {
    className,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  switch (name) {
    case "home":
      return (
        <svg {...commonProps}>
          <path d="M3 11.5 12 4l9 7.5" />
          <path d="M5.5 10.5V20h13v-9.5" />
          <path d="M9.5 20v-6h5v6" />
        </svg>
      );

    case "connections":
      return (
        <svg {...commonProps}>
          <circle cx="9" cy="8" r="3" />
          <circle cx="17" cy="9" r="2.5" />
          <path d="M3.5 19c.5-3.5 2.6-5.5 5.5-5.5S14 15.5 14.5 19" />
          <path d="M14 14.5c2.7-.4 5.2 1.2 5.8 4.5" />
        </svg>
      );

    case "messages":
      return (
        <svg {...commonProps}>
          <path d="M4 5.5h16v11H9l-5 3v-14Z" />
          <path d="M8 10h8" />
          <path d="M8 13h5" />
        </svg>
      );

    case "notifications":
      return (
        <svg {...commonProps}>
          <path d="M6.5 10a5.5 5.5 0 0 1 11 0c0 5 2 5.5 2 5.5h-15S6.5 15 6.5 10Z" />
          <path d="M10 19h4" />
        </svg>
      );

    case "skills":
      return (
        <svg {...commonProps}>
          <path d="m12 3 2.2 4.5 5 .7-3.6 3.5.9 5-4.5-2.4-4.5 2.4.9-5-3.6-3.5 5-.7L12 3Z" />
        </svg>
      );

    case "library":
      return (
        <svg {...commonProps}>
          <path d="M5 4h5.5A2.5 2.5 0 0 1 13 6.5V20a3.5 3.5 0 0 0-3-1.5H5V4Z" />
          <path d="M19 4h-5.5A2.5 2.5 0 0 0 11 6.5" />
          <path d="M19 4v14.5h-5a3.5 3.5 0 0 0-3 1.5" />
        </svg>
      );

    case "account":
      return (
        <svg {...commonProps}>
          <circle cx="12" cy="8" r="3.5" />
          <path d="M5.5 20c.6-4.2 3-6.5 6.5-6.5s5.9 2.3 6.5 6.5" />
        </svg>
      );
  }
}

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
  const router = useRouter();
  const shouldHideNavigation = authRoutes.has(pathname);
  const isPublicRoute = publicRoutes.has(pathname);

  const [user, setUser] = useState<User | null>(null);
  const [welcomeName, setWelcomeName] = useState<string | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [showLoadingScreen, setShowLoadingScreen] =
    useState(false);

  const [activeSuspension, setActiveSuspension] =
    useState<ActiveSuspension | null>(null);

  const [suspensionCheckMessage, setSuspensionCheckMessage] =
    useState<string | null>(null);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  const [onlineUserIds, setOnlineUserIds] =
    useState<Set<string>>(
      () => new Set()
    );

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
    if (isLoadingAuth || user || isPublicRoute) return;

    router.replace("/login");
  }, [isLoadingAuth, user, isPublicRoute, router]);

  useEffect(() => {
    if (
      !user ||
      !isSupabaseConfigured()
    ) {
      setOnlineUserIds(new Set());
      return;
    }

    const supabase =
      getSupabaseBrowserClient();

    const channel = supabase.channel(
      "fieldsconnect-online"
    );

    function syncOnlineUsers() {
      const presenceState =
        channel.presenceState() as Record<
          string,
          OnlinePresence[]
        >;

      const nextOnlineUserIds =
        new Set<string>();

      Object.values(
        presenceState
      ).forEach((presences) => {
        presences.forEach(
          (presence) => {
            if (
              typeof presence.user_id ===
                "string" &&
              presence.user_id
            ) {
              nextOnlineUserIds.add(
                presence.user_id
              );
            }
          }
        );
      });

      setOnlineUserIds(
        nextOnlineUserIds
      );
    }

    channel
      .on(
        "presence",
        { event: "sync" },
        syncOnlineUsers
      )
      .on(
        "presence",
        { event: "join" },
        syncOnlineUsers
      )
      .on(
        "presence",
        { event: "leave" },
        syncOnlineUsers
      )
      .subscribe(async (status) => {
        if (status !== "SUBSCRIBED") {
          return;
        }

        const presenceTrackStatus =
          await channel.track({
            user_id: user.id,
            online_at:
              new Date().toISOString(),
          });

        if (
          presenceTrackStatus !== "ok"
        ) {
          console.warn(
            "Unable to publish online presence:",
            presenceTrackStatus
          );
        }
      });

    return () => {
      void channel.untrack();
      void supabase.removeChannel(
        channel
      );
    };
  }, [user]);
  useEffect(() => {
    const isWaitingForProtectedAccess =
      !isPublicRoute &&
      (isLoadingAuth || !user);

    if (!isWaitingForProtectedAccess) {
      setShowLoadingScreen(false);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setShowLoadingScreen(true);
    }, 400);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [isLoadingAuth, user, isPublicRoute]);

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

        const suspensionError =
          error && typeof error === "object"
            ? error
            : { message: String(error) };

        console.warn(
          "Unable to check active account suspension:",
          suspensionError
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

  const isWaitingForProtectedAccess =
    !isPublicRoute &&
    (isLoadingAuth || !user);

  if (
    isWaitingForProtectedAccess &&
    showLoadingScreen
  ) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--fc-page)] px-4">
        <div className="text-center">
          <div
            aria-label="FieldsConnect"
            className="text-3xl font-bold tracking-tight"
          >
            <span className="text-blue-700">
              Fields
            </span>

            <span className="text-gray-950">
              Connect
            </span>
          </div>

          <p className="mt-3 text-sm text-gray-600">
            Loading...
          </p>
        </div>
      </main>
    );
  }

  if (isWaitingForProtectedAccess) {
    return null;
  }

  if (shouldHideNavigation) {
    return <>{children}</>;
  }

  if (user && activeSuspension) {
    const isAllowedSuspensionRoute =
      suspensionAllowedRoutes.has(pathname);

    return (
      <div className="min-h-screen bg-[var(--fc-page)] text-gray-950">
        <header className="border-b border-gray-200 bg-white/95 backdrop-blur">
          <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4 sm:px-6 md:flex-row md:items-center md:justify-between">
            <Link className="inline-flex items-center text-xl font-bold tracking-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2" href="/">
              <span className="text-blue-700">Fields</span><span className="text-gray-950">Connect</span>
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
    <OnlinePresenceContext.Provider
      value={onlineUserIds}
    >
      <div className="min-h-screen bg-[var(--fc-page)] text-gray-950">
      <header className="sticky top-0 z-20 border-b border-gray-200 bg-white/95 shadow-[0_1px_0_rgba(15,23,42,0.03)] backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-3 py-2.5 sm:hidden">
          <div className="flex items-center justify-between gap-3">
            <Link
              href="/"
              className="inline-flex shrink-0 items-center text-xl font-bold tracking-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
            >
              <span className="text-blue-700">Fields</span>
              <span className="text-gray-950">Connect</span>
            </Link>

            <div className="flex items-center">
              {isLoadingAuth ? (
                <span className="text-xs text-gray-500">
                  Checking...
                </span>
              ) : user ? (
                <details className="group relative">
                  <summary
                    className="flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-full border border-gray-300 bg-white text-gray-700 transition hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
                    aria-label={`Account menu for ${welcomeName ?? "user"}`}
                  >
                    <MobileNavIcon
                      name="account"
                      className="h-5 w-5"
                    />
                  </summary>

                  <div className="absolute right-0 top-full z-30 mt-2 min-w-52 overflow-hidden rounded-xl border border-gray-200 bg-white p-1 shadow-lg">
                    <div className="border-b border-gray-100 px-3 py-2">
                      <p className="text-xs text-gray-500">
                        Signed in as
                      </p>

                      <p className="max-w-44 truncate text-sm font-semibold text-gray-950">
                        {welcomeName ?? user.email ?? "Account"}
                      </p>
                    </div>

                    <Link
                      className={[
                        "block rounded-lg px-3 py-2 text-sm",
                        pathname === "/profile"
                          ? "bg-gray-100 font-medium text-gray-950"
                          : "text-gray-700 hover:bg-gray-50",
                      ].join(" ")}
                      href="/profile"
                      onClick={(event) => {
                        event.currentTarget
                          .closest("details")
                          ?.removeAttribute("open");
                      }}
                    >
                      Profile
                    </Link>

                    <RoleAwareAccountLinks pathname={pathname} />

                    <button
                      className="block w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-gray-700 hover:bg-gray-50"
                      type="button"
                      onClick={handleLogout}
                    >
                      Logout
                    </button>
                  </div>
                </details>
              ) : (
                <div className="flex items-center gap-2">
                  <Link
                    className="rounded-lg border px-2.5 py-2 text-xs font-medium"
                    href="/login"
                  >
                    Login
                  </Link>

                  <Link
                    className="rounded-lg bg-black px-2.5 py-2 text-xs font-medium text-white"
                    href="/signup"
                  >
                    Sign up
                  </Link>
                </div>
              )}
            </div>
          </div>

          <nav
            className="grid grid-cols-6 gap-1"
            aria-label="Primary navigation"
          >
            {mobileNavItems.map((item) => {
              const isActive = pathname === item.href;

              const unreadCount =
                item.href === "/messages"
                  ? unreadMessageCount
                  : item.href === "/notifications"
                    ? unreadNotificationCount
                    : 0;

              return (
                <Link
                  key={item.href}
                  className={[
                    "relative flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl border px-0.5 py-2 text-[10px] font-medium leading-none transition",
                    isActive
                      ? "border-black bg-black text-white"
                      : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50",
                  ].join(" ")}
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  title={item.label}
                >
                  <span className="relative flex h-5 w-5 items-center justify-center">
                    <MobileNavIcon
                      name={item.icon}
                      className="h-5 w-5"
                    />

                    {unreadCount > 0 && (
                      <span
                        className={[
                          "absolute -right-3 -top-2 inline-flex min-w-4 items-center justify-center rounded-full px-1 py-0.5 text-[9px] font-bold leading-none",
                          isActive
                            ? "bg-white text-black"
                            : "bg-black text-white",
                        ].join(" ")}
                      >
                        {unreadCount > 99
                          ? "99+"
                          : unreadCount}
                      </span>
                    )}
                  </span>

                  <span className="w-full truncate text-center">
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="mx-auto hidden max-w-6xl flex-col gap-3 px-4 py-3 sm:flex sm:px-6 sm:py-4">
          <div className="flex items-center justify-between gap-3">
            <Link href="/" className="inline-flex shrink-0 items-center text-xl font-bold tracking-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2">
              <span className="text-blue-700">Fields</span><span className="text-gray-950">Connect</span>
            </Link>

            <div className="flex flex-wrap items-center gap-3">
              {isLoadingAuth ? (
                <span className="text-sm text-gray-500">
                  Checking session...
                </span>
              ) : user ? (
                <>
                  <details className="group relative">
                    <summary className="flex cursor-pointer list-none items-center gap-1 rounded-lg px-2 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                      <span>Welcome, {welcomeName ?? "..."}</span>

                      <span
                        aria-hidden="true"
                        className="text-xs text-gray-500"
                      >
                        &#9662;
                      </span>
                    </summary>

                    <div className="absolute right-0 top-full z-30 mt-2 min-w-44 overflow-hidden rounded-xl border bg-white p-1 shadow-lg">
                      <Link
                        className={[
                          "block rounded-lg px-3 py-2 text-sm",
                          pathname === "/profile"
                            ? "bg-gray-100 font-medium text-gray-950"
                            : "text-gray-700 hover:bg-gray-50",
                        ].join(" ")}
                        href="/profile"
                        onClick={(event) => {
                          event.currentTarget
                            .closest("details")
                            ?.removeAttribute("open");
                        }}
                      >
                        Profile
                      </Link>
                      <RoleAwareAccountLinks pathname={pathname} />
                    </div>
                  </details>

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
    </OnlinePresenceContext.Provider>
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
              <span className="text-blue-700">Fields</span><span className="text-gray-950">Connect</span> Code of Conduct. Normal access will be restored
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