"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  getSupabaseBrowserClient,
  isSupabaseConfigured,
} from "@/lib/supabase/browser";

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    async function routeVisitor() {
      if (!isSupabaseConfigured()) {
        router.replace("/signup");
        return;
      }

      const supabase = getSupabaseBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      router.replace(session ? "/timeline" : "/signup");
    }

    void routeVisitor();
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="text-center">
        <div className="text-3xl font-bold tracking-tight">
          <span className="text-blue-700">Fields</span>
          <span className="text-gray-950">Connect</span>
        </div>

        <p className="mt-3 text-sm text-gray-600">
          Connecting you to your professional community…
        </p>
      </div>
    </main>
  );
}