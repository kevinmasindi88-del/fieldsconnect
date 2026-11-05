"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getSupabaseBrowserClient,
  isSupabaseConfigured,
} from "@/lib/supabase/browser";

type VisitState = "checking" | "new" | "returning";

const coreFeatures = [
  {
    number: "01",
    title: "Find your people",
    text: "Connect with students, professionals and people working in fields you want to explore.",
  },
  {
    number: "02",
    title: "Learn through mentorship",
    text: "Discover mentors, request mentorship and keep your learning goals and progress organised.",
  },
  {
    number: "03",
    title: "Share what you know",
    text: "Build your profile, exchange ideas, share resources and grow within a professional community.",
  },
];

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <span className={compact ? "text-base font-extrabold tracking-tight sm:text-xl" : "text-2xl font-extrabold tracking-tight"}>
      <span className="text-blue-700">Fields</span>
      <span className="text-slate-950">Connect</span>
    </span>
  );
}

export default function HomePage() {
  const router = useRouter();
  const [visitState, setVisitState] = useState<VisitState>("checking");

  useEffect(() => {
    let active = true;

    async function routeVisitor() {
      let returning = false;
      try {
        returning = window.localStorage.getItem("fc-returning-member") === "1";
      } catch {
        // Storage may be disabled. The public homepage stays available.
      }

      if (isSupabaseConfigured()) {
        try {
          const { data } = await getSupabaseBrowserClient().auth.getSession();
          if (!active) return;
          if (data.session) {
            try { window.localStorage.setItem("fc-returning-member", "1"); } catch {}
            router.replace("/timeline");
            return;
          }
        } catch {
          // Auth availability must not prevent public access.
        }
      }

      if (!active) return;
      if (returning) {
        setVisitState("returning");
        router.replace("/login");
      } else {
        setVisitState("new");
      }
    }

    void routeVisitor();
    return () => { active = false; };
  }, [router]);

  if (visitState === "checking" || visitState === "returning") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-5" aria-live="polite">
        <div className="text-center">
          <Brand />
          <p className="mt-3 text-sm text-slate-500">Connecting you to your community…</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-white text-slate-950">
      <header className="border-b border-slate-100 bg-white">
        <nav aria-label="Public navigation" className="mx-auto flex max-w-6xl items-center justify-between gap-1.5 px-3 py-3 sm:gap-3 sm:px-8 sm:py-4">
          <Link href="/" aria-label="FieldsConnect home" className="shrink-0 rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-700">
            <Brand compact />
          </Link>
          <div className="flex shrink-0 items-center gap-1 sm:gap-3">
            <Link href="/login" className="inline-flex min-h-11 shrink-0 items-center justify-center whitespace-nowrap rounded-lg px-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 sm:rounded-xl sm:px-5 sm:text-sm">
              Log in
            </Link>
            <Link href="/signup" className="inline-flex min-h-11 shrink-0 items-center justify-center whitespace-nowrap rounded-lg bg-blue-700 px-3 text-xs font-semibold text-white transition hover:bg-blue-800 sm:rounded-xl sm:px-5 sm:text-sm">
              Get started
            </Link>
          </div>
        </nav>
      </header>

      <section className="relative isolate overflow-hidden bg-gradient-to-br from-blue-50 via-white to-slate-50">
        <div aria-hidden="true" className="pointer-events-none absolute -right-24 top-8 h-80 w-80 rounded-full border-[38px] border-blue-100/65 sm:right-0 sm:h-[30rem] sm:w-[30rem] sm:border-[58px]" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-52 right-12 h-80 w-80 rounded-full bg-blue-100/40 blur-3xl" />
        <div className="relative mx-auto max-w-6xl px-5 pb-16 pt-16 sm:px-8 sm:pb-24 sm:pt-24">
          <div className="max-w-3xl">
            <span className="inline-flex rounded-full border border-blue-200 bg-white px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-blue-700">
              Connect and Grow.
            </span>
            <h1 className="mt-7 max-w-3xl text-4xl font-extrabold leading-[1.1] tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">
              Growth begins with the <span className="text-blue-700">right connections.</span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-8 text-slate-600 sm:text-lg">
              FieldsConnect brings learners, mentors and professionals together to share knowledge,
              build meaningful connections and grow through mentorship.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link href="/signup" className="inline-flex min-h-12 items-center justify-center rounded-xl bg-blue-700 px-7 text-sm font-bold text-white shadow-lg shadow-blue-700/15 transition hover:bg-blue-800">
                Join FieldsConnect
                <span aria-hidden="true" className="ml-3">→</span>
              </Link>
              <Link href="#how-it-works" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-slate-200 bg-white px-7 text-sm font-semibold text-slate-900 transition hover:border-blue-200 hover:bg-blue-50">
                How it works
              </Link>
            </div>
            <p className="mt-5 text-xs leading-6 text-slate-500">
              Start building your professional network and explore mentorship opportunities.
            </p>
          </div>


        </div>
      </section>

      <section id="how-it-works" aria-labelledby="features-heading" className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-24">
        <div className="max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">Why FieldsConnect</p>
          <h2 id="features-heading" className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">
            The people. The guidance. The opportunity to grow.
          </h2>
          <p className="mt-4 text-base leading-7 text-slate-600">
            Your next step can start with a conversation, a mentor or an idea worth sharing.
          </p>
        </div>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {coreFeatures.map((feature) => (
            <article key={feature.number} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-900/5 sm:p-7">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-sm font-extrabold text-blue-700">{feature.number}</div>
              <h3 className="mt-6 text-xl font-bold">{feature.title}</h3>
              <p className="mt-3 text-sm leading-7 text-slate-600">{feature.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-blue-100 bg-blue-50/70">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-7 px-5 py-14 sm:px-8 md:flex-row md:items-center">
          <div>
            <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Your next connection starts here.</h2>
            <p className="mt-3 max-w-xl text-sm leading-7 text-slate-600">Join a community built around knowledge, mentorship and growth.</p>
          </div>
          <Link href="/signup" className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-xl bg-blue-700 px-7 text-sm font-bold text-white hover:bg-blue-800">
            Create an account
          </Link>
        </div>
      </section>

      <footer className="border-t border-slate-100 bg-white">
        <nav aria-label="Legal information" className="mx-auto flex max-w-6xl flex-wrap justify-center gap-x-6 gap-y-3 px-5 py-8 text-sm text-slate-700 sm:px-8">
          <Link href="/terms-of-use" className="hover:text-blue-700 hover:underline">Terms of Use</Link>
          <Link href="/privacy-policy" className="hover:text-blue-700 hover:underline">Privacy Policy</Link>
          <Link href="/code-of-conduct" className="hover:text-blue-700 hover:underline">Community Guidelines</Link>
        </nav>
      </footer>
    </main>
  );
}
