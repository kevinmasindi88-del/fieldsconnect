"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/browser";

const featureCards = [
  {
    title: "Complete your profile",
    description: "Set up your role, field, bio, visibility, and mentorship availability.",
    href: "/profile",
  },
  {
    title: "Build connections",
    description: "Find people in the network and send or respond to connection requests.",
    href: "/connections",
  },
  {
    title: "Share on the timeline",
    description: "Create text posts, comment, and like updates from the network.",
    href: "/timeline",
  },
  {
    title: "Showcase skills",
    description: "Publish skills with descriptions and ratings for your profile.",
    href: "/skills",
  },
  {
    title: "Use the library",
    description: "Upload and share useful documents with public or connection-only visibility.",
    href: "/library",
  },
  {
    title: "Report concerns",
    description: "Submit reports for content or behaviour that needs moderation review.",
    href: "/moderation",
  },
];

export default function Home() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  const [isLoadingSession, setIsLoadingSession] = useState(true);

  useEffect(() => {
    async function loadSessionState() {
      if (!isSupabaseConfigured()) {
        setIsLoadingSession(false);
        return;
      }

      try {
        const supabase = getSupabaseBrowserClient();
        const { data: sessionData } = await supabase.auth.getSession();
        const userId = sessionData.session?.user.id;

        setIsLoggedIn(Boolean(userId));

        if (!userId) return;

        const { data } = await supabase
          .from("profiles")
          .select("terms_accepted_at, privacy_accepted_at, community_guidelines_accepted_at, age_confirmed_at")
          .eq("id", userId)
          .maybeSingle();

        setHasCompletedOnboarding(Boolean(
          data?.terms_accepted_at &&
            data?.privacy_accepted_at &&
            data?.community_guidelines_accepted_at &&
            data?.age_confirmed_at
        ));
      } finally {
        setIsLoadingSession(false);
      }
    }

    void loadSessionState();
  }, []);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-10 px-6 py-10">
      <section className="rounded-2xl border p-8">
        <p className="text-sm font-medium uppercase tracking-wide text-gray-500">FieldsConnect MVP</p>
        <h1 className="mt-3 max-w-3xl text-4xl font-bold tracking-tight md:text-5xl">
          Connect students, mentors, professionals, and institutions.
        </h1>
        <p className="mt-4 max-w-2xl text-gray-600">
          A focused MVP for profiles, accepted connections, simple messaging, timeline sharing, skills, documents, and safety reporting.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          {!isLoadingSession && !isLoggedIn && (
            <Link className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white" href="/signup">
              Create account
            </Link>
          )}

          {!isLoadingSession && isLoggedIn && !hasCompletedOnboarding && (
            <Link className="rounded-lg border px-4 py-2 text-sm font-medium" href="/onboarding">
              Continue onboarding
            </Link>
          )}

          {!isLoadingSession && isLoggedIn && hasCompletedOnboarding && (
            <Link className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white" href="/timeline">
              Go to timeline
            </Link>
          )}

          <Link className="rounded-lg border px-4 py-2 text-sm font-medium" href="/connections">
            Find connections
          </Link>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {featureCards.map((feature) => (
          <Link key={feature.href} className="rounded-xl border p-5 hover:bg-gray-50" href={feature.href}>
            <h2 className="text-lg font-semibold">{feature.title}</h2>
            <p className="mt-2 text-sm text-gray-600">{feature.description}</p>
          </Link>
        ))}
      </section>
    </main>
  );
}
