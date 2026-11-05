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
    <span className={compact ? "text-xl font-extrabold tracking-tight" : "text-2xl font-extrabold tracking-tight"}>
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
        <nav aria-label="Public navigation" className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-4 sm:px-8">
          <Link href="/" aria-label="FieldsConnect home" className="shrink-0 rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-700">
            <Brand compact />
          </Link>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link href="/login" className="inline-flex min-h-11 items-center justify-center rounded-xl px-3 text-sm font-semibold text-slate-800 hover:bg-slate-50 sm:px-5">
              Log in
            </Link>
            <Link href="/signup" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-blue-700 px-4 text-sm font-semibold text-white transition hover:bg-blue-800 sm:px-5">
              Get started
            </Link>
          </div>
        </nav>
      </header>

      <section className="relative isolate overflow-hidden bg-gradient-to-br from-blue-50 via-white to-slate-50">
        <div aria-hidden="true" className="pointer-events-none absolute -right-24 top-8 h-80 w-80 rounded-full border-[38px] border-blue-100/65 sm:right-0 sm:h-[30rem] sm:w-[30rem] sm:border-[58px]" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-52 right-12 h-80 w-80 rounded-full bg-blue-100/40 blur-3xl" />
        <div className="relative mx-auto grid max-w-6xl gap-12 px-5 pb-20 pt-20 sm:px-8 sm:pb-24 sm:pt-28 lg:grid-cols-[1.08fr_0.92fr] lg:items-center lg:gap-16">
          <div>
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
                Explore the platform
              </Link>
            </div>
            <p className="mt-5 text-xs leading-6 text-slate-500">
              Start building your professional network and explore mentorship opportunities.
            </p>
          </div>

          <div className="relative mx-auto w-full max-w-lg">
            <div className="absolute -inset-3 rounded-[2rem] border border-blue-100 bg-blue-100/40 sm:-inset-5" aria-hidden="true" />
            <div className="relative rounded-[1.7rem] border border-blue-100 bg-white p-5 shadow-xl shadow-blue-950/5 sm:p-7">
              <div className="flex items-center justify-between border-b border-slate-100 pb-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-blue-700">The FieldsConnect experience</p>
                  <p className="mt-1 text-lg font-bold">A place to move forward</p>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-700 text-xl font-bold text-white">F</div>
              </div>
              <div className="mt-5 space-y-3">
                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Connect</p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">Find people who share your interests.</p>
                </div>
                <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-blue-700">Mentorship</p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">Set goals. Learn together. Track progress.</p>
                </div>
                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Knowledge</p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">Exchange experience, skills and resources.</p>
                </div>
              </div>
              <div className="mt-5 flex items-center gap-2 text-xs font-medium text-slate-500">
                <span aria-hidden="true" className="h-2 w-2 rounded-full bg-blue-600" />
                Built for learning and professional growth
              </div>
            </div>
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

      <footer className="bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-7 px-5 py-10 sm:px-8">
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
            <div>
              <Brand compact />
              <p className="mt-1 text-sm text-slate-500">Connect and Grow.</p>
              <p className="mt-2 text-xs text-slate-500">A South African platform for learning, mentorship and professional connections.</p>
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-3 text-sm text-slate-700">
              <Link href="/terms-of-use" className="hover:text-blue-700 hover:underline">Terms of Use</Link>
              <Link href="/privacy-policy" className="hover:text-blue-700 hover:underline">Privacy Policy</Link>
              <Link href="/code-of-conduct" className="hover:text-blue-700 hover:underline">Community Guidelines</Link>
            </div>
          </div>
          <div className="border-t border-slate-100 pt-5 text-xs text-slate-500">
            © {new Date().getFullYear()} FieldsConnect. All rights reserved.
          </div>
        </div>
      </footer>
    </main>
  );
}
