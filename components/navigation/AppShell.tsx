"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/browser";

const authRoutes = new Set(["/login", "/signup", "/reset-password"]);

const navItems = [
  { href: "/", label: "Home" },
  { href: "/profile", label: "Profile" },
  { href: "/connections", label: "Connections" },
  { href: "/messages", label: "Messages" },
  { href: "/notifications", label: "Notifications" },
  { href: "/timeline", label: "Timeline" },
  { href: "/skills", label: "Skills" },
  { href: "/library", label: "Library" },
  { href: "/moderation", label: "Moderation" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const shouldHideNavigation = authRoutes.has(pathname);
  const [user, setUser] = useState<User | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);

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
      setUnreadNotificationCount(0);
      return;
    }

    const supabase = getSupabaseBrowserClient();

    async function loadUnreadCount() {
      const { count, error } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .is("read_at", null);

      if (!error) {
        setUnreadNotificationCount(count ?? 0);
      }
    }

    void loadUnreadCount();

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
          void loadUnreadCount();
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

  return (
    <div className="min-h-screen bg-white text-gray-950">
      <header className="sticky top-0 z-20 border-b bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-4">
          <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
            <Link href="/" className="text-xl font-bold tracking-tight">
              FieldsConnect
            </Link>

            <div className="flex flex-wrap items-center gap-2">
              {isLoadingAuth ? (
                <span className="text-sm text-gray-500">Checking session...</span>
              ) : user ? (
                <>
                  <span className="rounded-lg border px-3 py-2 text-sm text-gray-700">
                    Signed in
                  </span>

                  <Link
                    className="relative rounded-lg border px-3 py-2 text-sm font-medium"
                    href="/notifications"
                  >
                    Notifications
                    {unreadNotificationCount > 0 && (
                      <span className="ml-2 inline-flex min-w-5 items-center justify-center rounded-full bg-black px-1.5 py-0.5 text-xs font-semibold text-white">
                        {unreadNotificationCount > 99 ? "99+" : unreadNotificationCount}
                      </span>
                    )}
                  </Link>

                  <Link className="rounded-lg border px-3 py-2 text-sm font-medium" href="/profile">
                    Profile
                  </Link>

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
                  <Link className="rounded-lg border px-3 py-2 text-sm font-medium" href="/login">
                    Login
                  </Link>
                  <Link className="rounded-lg bg-black px-3 py-2 text-sm font-medium text-white" href="/signup">
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
                    isActive ? "bg-black text-white" : "bg-white text-gray-700 hover:bg-gray-50",
                  ].join(" ")}
                  href={item.href}
                >
                  {item.label}

                  {item.href === "/notifications" && unreadNotificationCount > 0 && (
                    <span
                      className={[
                        "ml-2 inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-xs font-semibold",
                        isActive ? "bg-white text-black" : "bg-black text-white",
                      ].join(" ")}
                    >
                      {unreadNotificationCount > 99 ? "99+" : unreadNotificationCount}
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