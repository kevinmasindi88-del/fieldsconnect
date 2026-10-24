import Link from "next/link";
import type { ReactNode } from "react";

export type PolicySection = {
  id: string;
  heading: string;
  paragraphs: readonly string[];
  bullets?: readonly string[];
};

type Props = {
  title: string;
  summary: string;
  version: string;
  sections: readonly PolicySection[];
  footer?: ReactNode;
};

export function PolicyDocument({ title, summary, version, sections, footer }: Props) {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 text-gray-950 sm:px-6 sm:py-12">
      <header className="rounded-3xl border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-white px-5 py-8 sm:px-9">
        <p className="text-xs font-bold uppercase tracking-widest text-blue-700">FieldsConnect · Governance and trust</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-gray-700 sm:text-base">{summary}</p>
        <p className="mt-4 text-xs text-gray-600">Version {version} · Last updated 24 October 2026 · Applies upon publication</p>
      </header>
      <div className="mt-6 grid min-w-0 gap-6 md:grid-cols-[220px_minmax(0,1fr)] md:items-start">
        <nav aria-label={`${title} sections`} className="rounded-2xl border bg-white p-4 md:sticky md:top-20">
          <h2 className="mb-2 text-sm font-semibold">On this page</h2>
          <ol className="max-h-80 space-y-1 overflow-y-auto pr-1 text-xs leading-5 md:max-h-[min(75vh,750px)]">
            {sections.map((section, index) => (
              <li key={section.id}>
                <a href={`#${section.id}`} className="block rounded-lg px-2 py-1.5 text-gray-600 hover:bg-blue-50 hover:text-blue-800 focus-visible:outline-blue-600">
                  {index + 1}. {section.heading}
                </a>
              </li>
            ))}
          </ol>
        </nav>
        <article className="min-w-0 space-y-4">
          {sections.map((section, index) => (
            <section key={section.id} id={section.id} className="scroll-mt-24 rounded-2xl border bg-white p-5 sm:p-7">
              <h2 className="text-lg font-semibold leading-snug sm:text-xl">{index + 1}. {section.heading}</h2>
              {section.paragraphs.map((paragraph, j) => (
                <p key={j} className="mt-3 text-sm leading-7 text-gray-700">{paragraph}</p>
              ))}
              {section.bullets && (
                <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-7 text-gray-700">
                  {section.bullets.map((bullet, j) => <li key={j}>{bullet}</li>)}
                </ul>
              )}
            </section>
          ))}
          <div className="rounded-2xl border bg-white p-5 text-sm leading-7 text-gray-700 sm:p-7">
            {footer}
            <div className="mt-4 flex flex-wrap gap-4 font-medium text-blue-700">
              <Link href="/terms-of-use" className="hover:underline">Terms of Use</Link>
              <Link href="/privacy-policy" className="hover:underline">Privacy Policy</Link>
              <Link href="/code-of-conduct" className="hover:underline">Community Guidelines</Link>
              <Link href="/signup" className="hover:underline">Back to signup</Link>
            </div>
          </div>
        </article>
      </div>
    </main>
  );
}
