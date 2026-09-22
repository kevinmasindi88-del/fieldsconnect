"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/browser";

type MetricRow = {
  metric_date: string;
  metric_key: string;
  metric_value: number | string;
  calculated_at: string;
};

type MetricGovernanceRow = {
  metric_key: string;
  display_name: string;
  definition: string;
  calculation_definition: string;
  measurement_type: "snapshot" | "daily_flow";
  time_basis: string;
  time_rule: string;
  calculation_cadence: string;
  review_cadence: string;
  baseline_status: string;
  benchmark_status: string;
  threshold_status: string;
};

type SignupTrendRow = {
  month_start: string;
  signup_count: number | string;
  is_current_month: boolean;
};

const fallbackMetricLabels: Record<string, string> = {
  users_total: "Total users",
  users_new: "New users",
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
  analytics_events_today: "Tracked events",
};

const overviewKeys = [
  "users_total",
  "connections_accepted",
  "mentorships_active",
  "library_documents_published",
];

const growthActivationKeys = ["users_total", "users_new"];

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
    <div className="rounded-xl border bg-white p-4 shadow-sm sm:rounded-2xl sm:p-5">
      <p className="text-xs font-medium text-gray-500 sm:text-sm">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{value.toLocaleString()}</p>
    </div>
  );
}

function MetricBars({
  title,
  keys,
  metrics,
  labels,
}: {
  title: string;
  keys: string[];
  metrics: Map<string, number>;
  labels: Map<string, string>;
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
                <span className="text-gray-700">{labels.get(key) ?? fallbackMetricLabels[key] ?? key}</span>
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

function SignupTrend({
  rows,
  error,
}: {
  rows: SignupTrendRow[];
  error: string | null;
}) {
  const monthLabels = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  const normalizedRows = rows.map((row, index) => ({
    ...row,
    signup_count: Number(row.signup_count),
    index,
  }));

  const max = Math.max(
    1,
    ...normalizedRows.map((row) => row.signup_count)
  );

  const yearGroups: Array<{
    year: string;
    rows: (typeof normalizedRows)[number][];
  }> = [];

  for (const row of normalizedRows) {
    const year = row.month_start.slice(0, 4);
    const currentGroup = yearGroups.at(-1);

    if (currentGroup?.year === year) {
      currentGroup.rows.push(row);
    } else {
      yearGroups.push({
        year,
        rows: [row],
      });
    }
  }

  return (
    <div className="mt-5 min-w-0 border-t pt-5 sm:mt-6 sm:pt-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="font-semibold">12-month signup trend</h3>
          <p className="mt-1 text-sm text-gray-500">
            Gross profile signups by UTC calendar month. The current month is provisional.
          </p>
        </div>
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
          Rolling 12 months
        </p>
      </div>

      {error ? (
        <div className="mt-4 rounded-xl border border-dashed p-4 text-sm text-gray-500">
          {error}
        </div>
      ) : normalizedRows.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed p-4 text-sm text-gray-500">
          No signup trend data is available.
        </div>
      ) : (
        <div className="mt-4 min-w-0 overflow-x-auto overscroll-x-contain pb-2">
          <div className="flex min-w-[900px] gap-3">
            {yearGroups.map((group) => (
              <div
                key={group.year}
                className="rounded-xl border bg-gray-50/50 p-3"
                style={{ flex: `${group.rows.length} 1 0%` }}
              >
                <div className="border-b pb-2 text-center text-xs font-semibold uppercase tracking-[0.16em] text-gray-600">
                  {group.year}
                </div>

                <div
                  className="mt-3 grid gap-2"
                  style={{
                    gridTemplateColumns: `repeat(${group.rows.length}, minmax(0, 1fr))`,
                  }}
                >
                  {group.rows.map((row) => {
                    const previous =
                      row.index > 0
                        ? normalizedRows[row.index - 1].signup_count
                        : null;

                    const delta =
                      previous === null
                        ? null
                        : row.signup_count - previous;

                    const percentChange =
                      previous !== null && previous > 0 && delta !== null
                        ? Math.round((delta / previous) * 100)
                        : null;

                    const monthNumber = Number(
                      row.month_start.slice(5, 7)
                    );

                    const monthLabel =
                      monthLabels[monthNumber - 1] ??
                      row.month_start.slice(5, 7);

                    const barHeight =
                      row.signup_count === 0
                        ? 0
                        : Math.max(
                            10,
                            (row.signup_count / max) * 100
                          );

                    const movementLabel =
                      delta === null
                        ? "12m start"
                        : `${delta > 0 ? "+" : ""}${delta.toLocaleString()} MoM${
                            percentChange !== null
                              ? ` (${percentChange > 0 ? "+" : ""}${percentChange}%)`
                              : ""
                          }`;

                    return (
                      <div
                        key={row.month_start}
                        className={`rounded-lg border bg-white p-2 ${
                          row.is_current_month
                            ? "ring-1 ring-black"
                            : ""
                        }`}
                      >
                        <p className="text-center text-xs font-semibold text-gray-700">
                          {monthLabel}
                        </p>

                        <p className="mt-1 text-center text-xl font-semibold">
                          {row.signup_count.toLocaleString()}
                        </p>

                        <div className="mt-2 flex h-28 items-end justify-center rounded-md bg-gray-100 px-2">
                          {row.signup_count > 0 && (
                            <div
                              className="w-full max-w-8 rounded-t bg-black transition-all"
                              style={{
                                height: `${barHeight}%`,
                              }}
                            />
                          )}
                        </div>

                        <p className="mt-2 text-center text-[10px] font-medium text-gray-500">
                          {movementLabel}
                        </p>

                        {row.is_current_month && (
                          <p className="mt-1 text-center text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                            Provisional
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function DadDashboard() {
  const [metrics, setMetrics] = useState<MetricRow[]>([]);
  const [governance, setGovernance] = useState<MetricGovernanceRow[]>([]);
  const [signupTrend, setSignupTrend] = useState<SignupTrendRow[]>([]);
  const [signupTrendError, setSignupTrendError] = useState<string | null>(null);
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

    const [metricsResult, governanceResult, signupTrendResult] = await Promise.all([
      supabase
        .from("dad_daily_metrics")
        .select("metric_date, metric_key, metric_value, calculated_at")
        .eq("dimension_type", "global")
        .eq("dimension_value", "all")
        .order("metric_date", { ascending: false })
        .limit(100),
      supabase
        .from("dad_metric_governance")
        .select(
          "metric_key, display_name, definition, calculation_definition, measurement_type, time_basis, time_rule, calculation_cadence, review_cadence, baseline_status, benchmark_status, threshold_status"
        )
        .eq("is_active", true)
        .order("metric_key", { ascending: true }),
      supabase.rpc("get_dad_signup_monthly_12m", {
        p_as_of: new Date().toISOString().slice(0, 10),
      }),
    ]);

    if (metricsResult.error) {
      setMessage(metricsResult.error.message);
      setIsLoading(false);
      return;
    }

    if (governanceResult.error) {
      setGovernance([]);
      setMessage("Metrics loaded, but governance metadata is unavailable.");
    } else {
      setGovernance((governanceResult.data ?? []) as MetricGovernanceRow[]);
    }

    if (signupTrendResult.error) {
      setSignupTrend([]);
      setSignupTrendError("The 12-month signup trend is unavailable.");
    } else {
      setSignupTrend(
        (signupTrendResult.data ?? []) as SignupTrendRow[]
      );
      setSignupTrendError(null);
    }

    const newestDate = metricsResult.data?.[0]?.metric_date;
    setMetrics(
      (metricsResult.data ?? []).filter((row) => row.metric_date === newestDate)
    );
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void loadMetrics();
  }, [loadMetrics]);

  const metricMap = useMemo(() => {
    return new Map(metrics.map((row) => [row.metric_key, Number(row.metric_value)]));
  }, [metrics]);

  const metricLabelMap = useMemo(() => {
    return new Map(governance.map((row) => [row.metric_key, row.display_name]));
  }, [governance]);

  const metricGovernanceMap = useMemo(() => {
    return new Map(governance.map((row) => [row.metric_key, row]));
  }, [governance]);

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
      <main className="mx-auto w-full min-w-0 max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
        <p className="text-sm text-gray-500">Loading DAD…</p>
      </main>
    );
  }

  if (!hasAccess) {
    return (
      <main className="mx-auto w-full min-w-0 max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
        <div className="rounded-2xl border p-6">
          <h1 className="text-2xl font-semibold">Data Analytics Dashboard</h1>
          <p className="mt-2 text-gray-600">You do not currently have access to DAD.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full min-w-0 max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500 sm:text-sm sm:tracking-[0.18em]">
            FieldsConnect intelligence
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Data Analytics Dashboard</h1>
          <p className="mt-2 max-w-2xl text-sm text-gray-600 sm:text-base">
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

      <section className="mt-6 grid grid-cols-2 gap-3 sm:mt-8 sm:gap-4 lg:grid-cols-4">
        {overviewKeys.map((key) => (
          <MetricCard
            key={key}
            label={metricLabelMap.get(key) ?? fallbackMetricLabels[key] ?? key}
            value={metricMap.get(key) ?? 0}
          />
        ))}
      </section>

      <div className="mt-8 grid items-start gap-6 lg:grid-cols-2">
        <section className="min-w-0 rounded-2xl border bg-white p-4 shadow-sm sm:p-6 lg:col-span-2">
          <h2 className="text-base font-semibold sm:text-lg">Growth &amp; Activation</h2>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:mt-5 sm:gap-4">
            {growthActivationKeys.map((key) => {
              const governanceRow = metricGovernanceMap.get(key);

              return (
                <div key={key} className="min-w-0 rounded-xl border bg-gray-50 p-3 sm:p-4">
                  <p className="text-xs font-medium text-gray-500 sm:text-sm">
                    {metricLabelMap.get(key) ?? fallbackMetricLabels[key] ?? key}
                  </p>
                  <p className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
                    {(metricMap.get(key) ?? 0).toLocaleString()}
                  </p>
                  {governanceRow && (
                    <p className="mt-2 text-[11px] text-gray-500 sm:text-xs">
                      {governanceRow.measurement_type === "daily_flow"
                        ? "Daily flow"
                        : "Snapshot"}
                      {" · "}
                      {governanceRow.time_basis}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          <SignupTrend
            rows={signupTrend}
            error={signupTrendError}
          />
        </section>

        <MetricBars
          title="Mentorship"
          keys={mentorshipKeys}
          metrics={metricMap}
          labels={metricLabelMap}
        />
        <MetricBars
          title="Engagement"
          keys={engagementKeys}
          metrics={metricMap}
          labels={metricLabelMap}
        />
        <MetricBars
          title="Library"
          keys={libraryKeys}
          metrics={metricMap}
          labels={metricLabelMap}
        />

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
