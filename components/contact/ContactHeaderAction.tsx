"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  getSupabaseBrowserClient,
  isSupabaseConfigured,
} from "@/lib/supabase/browser";

type AuthStatus = "checking" | "signed-in" | "guest";

export function ContactHeaderAction() {
  const [status, setStatus] = useState<AuthStatus>("checking");

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setStatus("guest");
      return;
    }

    let mounted = true;
    const client = getSupabaseBrowserClient();
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
      if (mounted) setStatus(session?.user ? "signed-in" : "guest");
    });

    void client.auth.getSession().then(({ data }) => {
      if (mounted) setStatus(data.session?.user ? "signed-in" : "guest");
    }).catch(() => {
      if (mounted) setStatus("guest");
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  if (status === "checking") {
    return <span aria-label="Checking your session" className="min-h-11 min-w-24" />;
  }

  return (
    <Link
      href={status === "signed-in" ? "/timeline" : "/login"}
      className="inline-flex min-h-11 shrink-0 items-center rounded-xl border border-slate-200 px-4 text-sm font-semibold hover:bg-slate-50"
    >
      {status === "signed-in" ? "Back to app" : "Log in"}
    </Link>
  );
}
