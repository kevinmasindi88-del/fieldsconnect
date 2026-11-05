"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

type Evidence = {
  cycle: {
    id: string;
    field: string;
    status: string;
    objective: string;
    duration: string;
    frequency: string;
    mentor_name: string;
    mentee_name: string;
    start_date: string;
    expected_end_date: string | null;
    end_reason: string | null;
    pause_reason: string | null;
    completion_request_note: string | null;
    completion_response_note: string | null;
  };
  updates: Array<{
    author_id: string; update_type: string; body: string;
    created_at: string; edited_at: string | null;
  }>;
  milestones: Array<{
    title: string; description: string | null; target_date: string | null;
    status: string; created_at: string;
  }>;
  action_items: Array<{
    title: string; description: string | null; due_date: string | null;
    status: string; completion_summary: string | null;
    completion_review: string | null; completion_rating: number | null;
  }>;
  completion_feedback: Array<{
    author_role: string; feedback: string;
    mentor_rating: number | null; submitted_at: string;
  }>;
  extensions: Array<{
    requested_duration: string; reason: string; status: string;
    requested_at: string; previous_end_date: string | null;
    proposed_end_date: string | null;
  }>;
};

function value(input: unknown): string {
  if (input === null || input === undefined || input === "") return "—";
  return String(input).replaceAll("_", " ");
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message :
    typeof error === "object" && error !== null && "message" in error
      ? String(error.message) : "Evidence could not be loaded.";
}

function EvidenceSection({
  title, items, render,
}: {
  title: string;
  items: Record<string, unknown>[];
  render: (item: Record<string, unknown>) => React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border bg-white p-4 sm:p-5">
      <h2 className="text-lg font-semibold">{title} ({items.length})</h2>
      {items.length ? (
        <div className="mt-4 space-y-3">
          {items.map((item, index) => (
            <article className="rounded-xl border bg-gray-50 p-3 text-sm sm:p-4" key={index}>
              {render(item)}
            </article>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm text-gray-500">No records available.</p>
      )}
    </section>
  );
}

export function ModerationMentorshipEvidence({ ticketId }: { ticketId: string }) {
  const [evidence, setEvidence] = useState<Evidence | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setEvidence(null);
    try {
      const { data, error: rpcError } = await getSupabaseBrowserClient()
        .rpc("get_moderation_mentorship_evidence", { p_report_id: ticketId });
      if (rpcError) throw rpcError;
      if (!data || typeof data !== "object" || !("cycle" in data)) {
        throw new Error("No eligible mentorship evidence was returned.");
      }
      setEvidence(data as Evidence);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  useEffect(() => {
    void load();
    const refreshOnFocus = () => { void load(); };
    window.addEventListener("focus", refreshOnFocus);
    return () => window.removeEventListener("focus", refreshOnFocus);
  }, [load]);

  return (
    <main className="mx-auto max-w-6xl space-y-5 px-4 py-6 sm:px-6">
      <Link className="inline-flex min-h-11 items-center font-medium text-blue-700 underline"
        href={"/moderation/review/" + ticketId}>
        Back to moderation ticket
      </Link>
      <header>
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          FCModerators · Restricted evidence
        </p>
        <h1 className="mt-1 text-2xl font-semibold sm:text-3xl">
          Mentorship cycle — Read only
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          Evidence is available only while this ticket is open or under review.
          No editing or mentorship lifecycle actions are available here.
          Private inbox conversations and payment data are excluded.
        </p>
      </header>

      {loading && <p className="rounded-xl border p-4 text-sm">Checking permissions and loading evidence...</p>}
      {error && <p role="alert" className="rounded-xl border border-red-200 p-4 text-sm text-red-700">{error}</p>}
      {evidence && (
        <>
          <section className="rounded-2xl border bg-white p-4 sm:p-5">
            <h2 className="text-xl font-semibold">{evidence.cycle.field}</h2>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              {([
                ["Mentor", evidence.cycle.mentor_name],
                ["Mentee", evidence.cycle.mentee_name],
                ["Status", evidence.cycle.status],
                ["Duration", evidence.cycle.duration],
                ["Meeting frequency", evidence.cycle.frequency],
                ["Start date", evidence.cycle.start_date],
                ["Expected end", evidence.cycle.expected_end_date],
              ] as Array<[string, unknown]>).map(([label, item]) => (
                <div key={label}><dt className="font-medium text-gray-500">{label}</dt>
                  <dd className="mt-1 break-words">{value(item)}</dd></div>
              ))}
            </dl>
            <h3 className="mt-5 font-semibold">Shared objective</h3>
            <p className="mt-2 whitespace-pre-wrap text-sm">{value(evidence.cycle.objective)}</p>
            {(["pause_reason", "end_reason", "completion_request_note", "completion_response_note"] as const)
              .filter(key => evidence.cycle[key]).map(key => (
                <div className="mt-4" key={key}>
                  <h3 className="text-sm font-semibold capitalize">{value(key)}</h3>
                  <p className="mt-1 whitespace-pre-wrap text-sm">{value(evidence.cycle[key])}</p>
                </div>
              ))}
          </section>

          <EvidenceSection title="Shared updates"
            items={evidence.updates as Record<string, unknown>[]}
            render={item => <><p className="font-semibold capitalize">{value(item.update_type)} · {value(item.created_at)}</p>
              <p className="mt-2 whitespace-pre-wrap">{value(item.body)}</p></>} />
          <EvidenceSection title="Milestones"
            items={evidence.milestones as Record<string, unknown>[]}
            render={item => <><p className="font-semibold">{value(item.title)}</p>
              <p className="mt-1 text-gray-500">Status: {value(item.status)} · Target: {value(item.target_date)}</p>
              {item.description && <p className="mt-2 whitespace-pre-wrap">{value(item.description)}</p>}</>} />
          <EvidenceSection title="Action items and completion evidence"
            items={evidence.action_items as Record<string, unknown>[]}
            render={item => <><p className="font-semibold">{value(item.title)}</p>
              <p className="mt-1 text-gray-500">Status: {value(item.status)} · Due: {value(item.due_date)}</p>
              {(["description", "completion_summary", "completion_review", "completion_rating"] as const)
                .filter(key => item[key] !== null && item[key] !== undefined && item[key] !== "")
                .map(key => <p className="mt-2 whitespace-pre-wrap" key={key}>
                  <span className="font-medium capitalize">{value(key)}: </span>{value(item[key])}
                </p>)}</>} />
          <EvidenceSection title="Completion feedback"
            items={evidence.completion_feedback as Record<string, unknown>[]}
            render={item => <><p className="font-semibold capitalize">{value(item.author_role)} · {value(item.submitted_at)}</p>
              <p className="mt-2 whitespace-pre-wrap">{value(item.feedback)}</p>
              {item.mentor_rating != null && <p className="mt-2">Mentor rating: {value(item.mentor_rating)} / 5</p>}</>} />
          <EvidenceSection title="Extension requests"
            items={evidence.extensions as Record<string, unknown>[]}
            render={item => <><p className="font-semibold">{value(item.requested_duration)} · {value(item.status)}</p>
              <p className="mt-1 text-gray-500">Requested: {value(item.requested_at)}</p>
              <p className="mt-2 whitespace-pre-wrap">{value(item.reason)}</p></>} />
          <p className="text-xs text-gray-500">
            For large cycles, evidence is limited to the latest 200 records per activity type
            and 100 extension requests. This is a restricted review, not an export.
          </p>
        </>
      )}
    </main>
  );
}
