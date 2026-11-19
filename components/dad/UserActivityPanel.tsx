"use client";

export type DadActivityDay = {
  activity_date: string;
  login_count: number | string;
  active_users: number | string;
};

type ActivityRecord = {
  day: string;
  logins: number;
  active: number;
};

function sastDate(now = Date.now()) {
  // South Africa observes a fixed UTC+02:00 offset.
  return new Date(now + 2 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function dayBefore(day: string) {
  return new Date(Date.parse(day + "T00:00:00Z") - 86_400_000)
    .toISOString()
    .slice(0, 10);
}

function shortLabel(day: string) {
  const [, month, date] = day.split("-");
  return date + "/" + month;
}

export function UserActivityPanel({
  rows,
  error,
  loading,
}: {
  rows: DadActivityDay[];
  error: string | null;
  loading: boolean;
}) {
  const data: ActivityRecord[] = rows
    .map((row) => ({
      day: row.activity_date,
      logins: Number(row.login_count) || 0,
      active: Number(row.active_users) || 0,
    }))
    .sort((a, b) => a.day.localeCompare(b.day));

  const today = sastDate();
  const todayRecord = data.find((row) => row.day === today);
  const yesterdayRecord = data.find((row) => row.day === dayBefore(today));
  const maxValue = Math.max(1, ...data.flatMap((row) => [row.logins, row.active]));

  return (
    <section className="min-w-0 rounded-2xl border bg-white p-4 shadow-sm sm:p-6 lg:col-span-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold sm:text-lg">User activity</h2>
          <p className="mt-1 text-xs text-gray-600 sm:text-sm">
            Daily login events and distinct active members · South Africa time (SAST)
          </p>
        </div>
        <span className="rounded-full border px-2.5 py-1 text-xs text-gray-600">Last 30 days</span>
      </div>

      {error ? (
        <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      ) : (
        <>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:gap-4">
            <div className="rounded-xl border bg-gray-50 p-3 sm:p-4">
              <p className="text-xs font-medium text-gray-600 sm:text-sm">Daily logins</p>
              <p className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
                {loading ? "…" : (todayRecord?.logins ?? 0).toLocaleString()}
              </p>
              <p className="mt-1 text-xs text-gray-500">
                Today · Yesterday: {yesterdayRecord ? yesterdayRecord.logins.toLocaleString() : "—"}
              </p>
            </div>
            <div className="rounded-xl border bg-gray-50 p-3 sm:p-4">
              <p className="text-xs font-medium text-gray-600 sm:text-sm">Daily active users</p>
              <p className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
                {loading ? "…" : (todayRecord?.active ?? 0).toLocaleString()}
              </p>
              <p className="mt-1 text-xs text-gray-500">
                Unique today · Yesterday: {yesterdayRecord ? yesterdayRecord.active.toLocaleString() : "—"}
              </p>
            </div>
          </div>

          <div className="mt-6">
            <h3 className="font-semibold">Activity trend</h3>
            <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-gray-600">
              <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm bg-gray-900" /> Daily logins</span>
              <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm bg-blue-700" /> Active users</span>
            </div>

            {loading ? (
              <p className="mt-4 text-sm text-gray-500">Loading daily activity…</p>
            ) : data.length === 0 ? (
              <p className="mt-4 text-sm text-gray-500">
                No user activity has been recorded yet. Tracking starts with this release.
              </p>
            ) : (
              <div
                className="mt-4 overflow-x-auto overscroll-auto rounded-xl border bg-gray-50 px-3 py-4"
                aria-label="Daily logins and active users chart, last 30 days"
                tabIndex={0}
              >
                <div className="flex min-w-max items-end gap-1.5">
                  {data.map((row, index) => (
                    <div
                      key={row.day}
                      className="flex w-8 shrink-0 flex-col items-center gap-1"
                      role="img"
                      aria-label={`${row.day}: ${row.logins} logins and ${row.active} active users`}
                      title={`${row.day}: ${row.logins} logins, ${row.active} active users`}
                    >
                      <div className="flex h-32 items-end justify-center gap-0.5">
                        <span
                          aria-hidden="true"
                          className="w-3 rounded-t-sm bg-gray-900"
                          style={{ height: `${(row.logins / maxValue) * 128}px` }}
                        />
                        <span
                          aria-hidden="true"
                          className="w-3 rounded-t-sm bg-blue-700"
                          style={{ height: `${(row.active / maxValue) * 128}px` }}
                        />
                      </div>
                      <span aria-hidden="true" className="h-4 text-[10px] text-gray-500">
                        {index % 4 === 0 || index === data.length - 1 ? shortLabel(row.day) : ""}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <p className="mt-3 text-xs leading-5 text-gray-500">
            Logins count newly authenticated password sessions, not app refreshes. Active users count each signed-in person once per SAST day. Data prior to the tracking launch is not reconstructed.
          </p>
        </>
      )}
    </section>
  );
}
