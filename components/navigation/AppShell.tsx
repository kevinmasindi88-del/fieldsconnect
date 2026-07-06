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
