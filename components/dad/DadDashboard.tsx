"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/browser";

type MetricRow = {
  metric_date: string;
  metric_key: string;
  metric_value: number | string;
  calculated_at: string;
};

const metricLabels: Record<string, string> = {
  users_total: "Total users",
  users_new: "New users today",
  connections_total: "Connection requests",
  connections_accepted: "Accepted connections",
  mentorship_requests_total: "Mentorship requests",
  mentorship_requests_accepted: "Accepted mentorship requests",
  mentorships_active: "Active mentorships",
  mentorships_completed: "Completed mentorships",
  mentorship_milestones_completed: "Milestones completed",
  mentorship_action_items_completed: "Action items completed",
  library_documents_total: "Library resources",
  library_documents_published: "Published Library resources",
  posts_total: "Posts",
  comments_total: "Comments",
  post_reactions_total: "Post reactions",
  messages_total: "Messages",
  analytics_events_today: "Tracked events today",
};

const overviewKeys = [
  "users_total",
  "connections_accepted",
  "mentorships_active",
  "library_documents_published",
];

const mentorshipKeys = [
  "mentorship_requests_total",
  "mentorship_requests_accepted",
  "mentorships_active",
  "mentorships_completed",
  "mentorship_milestones_completed",
  "mentorship_action_items_completed",
];

const engagementKeys = [
  "posts_total",
  "comments_total",
  "post_reactions_total",
  "messages_total",
  "analytics_events_today",
];

const libraryKeys = ["library_documents_total", "library_documents_published"];

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight">{value.toLocaleString()}</p>
    </div>
  );
}

function MetricBars({
  title,
  keys,
  metrics,
}: {
  title: string;
  keys: string[];
  metrics: Map<string, number>;
}) {
  const max = Math.max(1, ...keys.map((key) => metrics.get(key) ?? 0));

  return (
    <section className="rounded-2xl border bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="mt-5 space-y-4">
        {keys.map((key) => {
          const value = metrics.get(key) ?? 0;
          const width = Math.max(value === 0 ? 0 : 4, (value / max) * 100);

          return (
            <div key={key}>
              <div className="mb-1 flex items-center justify-between gap-4 text-sm">
                <span className="text-gray-700">{metricLabels[key] ?? key}</span>
                <span className="font-semibold">{value.toLocaleString()}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                <div
                  className="h-full rounded-full bg-black transition-all"
                  style={{ width: `${width}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function DadDashboard() {
  const [metrics, setMetrics] = useState<MetricRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadMetrics = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setMessage("Supabase is not configured.");
      setIsLoading(false);
      return;
    }

    const supabase = getSupabaseBrowserClient();
    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData.session?.user;

    if (!user) {
      setHasAccess(false);
      setIsLoading(false);
      return;
    }

    const { data: access, error: accessError } = await supabase.rpc("has_dad_access");

    if (accessError || !access) {
      setHasAccess(false);
      setIsLoading(false);
      return;
    }

    setHasAccess(true);

    const { data, error } = await supabase
      .from("dad_daily_metrics")
      .select("metric_date, metric_key, metric_value, calculated_at")
      .eq("dimension_type", "global")
      .eq("dimension_value", "all")
      .order("metric_date", { ascending: false })
      .limit(100);

    if (error) {
      setMessage(error.message);
      setIsLoading(false);
      return;
    }

    const newestDate = data?.[0]?.metric_date;
    setMetrics((data ?? []).filter((row) => row.metric_date === newestDate));
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void loadMetrics();
  }, [loadMetrics]);

  const metricMap = useMemo(() => {
    return new Map(metrics.map((row) => [row.metric_key, Number(row.metric_value)]));
  }, [metrics]);

  const lastCalculatedAt = metrics
    .map((row) => row.calculated_at)
    .sort()
    .at(-1);

  async function refreshLatest() {
    if (!isSupabaseConfigured()) return;

    setIsRefreshing(true);
    setMessage(null);

    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.rpc("refresh_dad_metrics", {
        p_date: new Date().toISOString().slice(0, 10),
      });

      if (error) throw error;

      await loadMetrics();
      setMessage("Latest metrics refreshed.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to refresh DAD.");
    } finally {
      setIsRefreshing(false);
    }
  }

  if (isLoading || hasAccess === null) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-10">
        <p className="text-sm text-gray-500">Loading DAD…</p>
      </main>
    );
  }

  if (!hasAccess) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="rounded-2xl border p-6">
          <h1 className="text-2xl font-semibold">Data Analytics Dashboard</h1>
          <p className="mt-2 text-gray-600">You do not currently have access to DAD.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-gray-500">
            FieldsConnect intelligence
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Data Analytics Dashboard</h1>
          <p className="mt-2 max-w-2xl text-gray-600">
            Daily operational view across growth, mentorship, engagement and Library activity.
          </p>
        </div>

        <div className="flex flex-col items-start gap-2 md:items-end">
          <button
            className="rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            disabled={isRefreshing}
            onClick={refreshLatest}
            type="button"
          >
            {isRefreshing ? "Refreshing…" : "Refresh latest"}
          </button>
          {lastCalculatedAt && (
            <p className="text-xs text-gray-500">
              Last calculated {new Date(lastCalculatedAt).toLocaleString()}
            </p>
          )}
        </div>
      </div>

      {message && (
        <div className="mt-5 rounded-xl border bg-gray-50 px-4 py-3 text-sm text-gray-700">
          {message}
        </div>
      )}

      <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {overviewKeys.map((key) => (
          <MetricCard
            key={key}
            label={metricLabels[key] ?? key}
            value={metricMap.get(key) ?? 0}
          />
        ))}
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <MetricBars title="Mentorship" keys={mentorshipKeys} metrics={metricMap} />
        <MetricBars title="Engagement" keys={engagementKeys} metrics={metricMap} />
        <MetricBars title="Library" keys={libraryKeys} metrics={metricMap} />

        <section className="rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Analyst workflow</h2>
          <p className="mt-2 text-sm text-gray-600">
            Observation → evidence → interpretation → recommendation → action → outcome.
          </p>
          <div className="mt-5 rounded-xl border border-dashed p-4 text-sm text-gray-500">
            Analyst review workspace is connected at database level and will be surfaced here next.
          </div>
        </section>
      </div>
    </main>
  );
}
