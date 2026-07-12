"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/browser";

type Profile = {
  id: string;
  display_name: string;
  role_type: string;
  field: string | null;
};

type Report = {
  id: string;
  reporter_id: string;
  target_type: "profile";
  target_id: string;
  reason: string;
  details: string | null;
  status: string;
  created_at: string;
};

const reasonOptions = [
  "Harassment or bullying",
  "Spam or scam",
  "False or misleading content",
  "Inappropriate content",
  "Impersonation",
  "Privacy concern",
  "Other",
];

export function ModerationReportingWorkflow() {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState("");
  const [reason, setReason] = useState(reasonOptions[0]);
  const [details, setDetails] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isWorking, setIsWorking] = useState(false);

  const profileById = useMemo(
    () => new Map(profiles.map((profile) => [profile.id, profile])),
    [profiles]
  );

  const reportableProfiles = useMemo(
    () =>
      profiles
        .filter((profile) => profile.id !== currentUserId)
        .sort((left, right) => left.display_name.localeCompare(right.display_name)),
    [currentUserId, profiles]
  );

  async function loadData() {
    setMessage(null);

    if (!isSupabaseConfigured()) {
      setMessage("Supabase is not configured yet. Reporting will work once environment variables are set.");
      setIsLoading(false);
      return;
    }

    try {
      const supabase = getSupabaseBrowserClient();
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

      if (sessionError) throw sessionError;

      const userId = sessionData.session?.user.id;

      if (!userId) {
        setMessage("Please log in before submitting or viewing reports.");
        setIsLoading(false);
        return;
      }

      setCurrentUserId(userId);

      const [
        { data: profileData, error: profileError },
        { data: reportData, error: reportError },
      ] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, display_name, role_type, field")
          .is("deleted_at", null),
        supabase
          .from("reports")
          .select("id, reporter_id, target_type, target_id, reason, details, status, created_at")
          .eq("reporter_id", userId)
          .eq("target_type", "profile")
          .order("created_at", { ascending: false }),
      ]);

      if (profileError) throw profileError;
      if (reportError) throw reportError;

      setProfiles((profileData ?? []) as Profile[]);
      setReports((reportData ?? []) as Report[]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load reports.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  async function submitReport(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!currentUserId || !selectedProfileId || !reason.trim() || !isSupabaseConfigured()) return;

    setIsWorking(true);
    setMessage(null);

    try {
      const supabase = getSupabaseBrowserClient();

      const { error } = await supabase.from("reports").insert({
        reporter_id: currentUserId,
        target_type: "profile",
        target_id: selectedProfileId,
        reason,
        details: details.trim() || null,
        status: "submitted",
      });

      if (error) throw error;

      setSelectedProfileId("");
      setReason(reasonOptions[0]);
      setDetails("");
      setMessage("Report submitted.");
      await loadData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to submit report.");
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-8 p-8">
      <div>
        <h1 className="text-3xl font-semibold">Moderation</h1>
        <p className="mt-2 text-sm text-gray-600">
          Report a profile for behaviour or content that needs review.
        </p>
      </div>

      {message && <p className="rounded-lg border p-3 text-sm text-gray-700">{message}</p>}

      <form onSubmit={submitReport} className="flex flex-col gap-4 rounded-xl border p-4">
        <h2 className="text-xl font-semibold">Submit report</h2>

        <label className="flex flex-col gap-2 text-sm font-medium">
          Profile name
          <select
            className="rounded-lg border px-3 py-2"
            value={selectedProfileId}
            onChange={(event) => setSelectedProfileId(event.target.value)}
            required
          >
            <option value="">Select a profile</option>
            {reportableProfiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.display_name}
                {profile.field ? ` — ${profile.field}` : ""}
              </option>
            ))}
          </select>
          <span className="text-xs text-gray-500">
            FieldsConnect keeps the profile ID internal. For a specific post, comment, message, skill, or document, contextual Report buttons will identify the exact item automatically.
          </span>
        </label>

        <label className="flex flex-col gap-2 text-sm font-medium">
          Reason
          <select
            className="rounded-lg border px-3 py-2"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          >
            {reasonOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-2 text-sm font-medium">
          Details
          <textarea
            className="min-h-28 rounded-lg border px-3 py-2"
            value={details}
            onChange={(event) => setDetails(event.target.value)}
            placeholder="Describe what happened and mention the relevant post or content."
          />
        </label>

        <button
          className="w-fit rounded-lg bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          disabled={!selectedProfileId || !reason.trim() || isWorking}
          type="submit"
        >
          {isWorking ? "Submitting..." : "Submit report"}
        </button>
      </form>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">My submitted reports</h2>

        {isLoading ? (
          <p className="text-sm text-gray-600">Loading reports...</p>
        ) : reports.length === 0 ? (
          <p className="rounded-xl border border-dashed p-4 text-sm text-gray-600">
            You have not submitted any reports yet.
          </p>
        ) : (
          <div className="grid gap-3">
            {reports.map((report) => {
              const targetProfile = profileById.get(report.target_id);

              return (
                <article key={report.id} className="rounded-xl border p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold">{targetProfile?.display_name ?? "Reported profile"}</h3>
                    <span className="rounded-full border px-2 py-1 text-xs">{report.status}</span>
                  </div>

                  <p className="mt-2 text-sm text-gray-600">Reason: {report.reason}</p>
                  {targetProfile?.field && <p className="mt-1 text-xs text-gray-500">Field: {targetProfile.field}</p>}
                  {report.details && <p className="mt-3 whitespace-pre-wrap text-sm text-gray-700">{report.details}</p>}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </section>
  );
}
