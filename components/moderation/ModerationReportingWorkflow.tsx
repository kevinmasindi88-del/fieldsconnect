"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/browser";

type ReportTargetType = "profile" | "post" | "comment" | "message" | "skill" | "library_document";

type Report = {
  id: string;
  reporter_id: string;
  target_type: ReportTargetType;
  target_id: string;
  reason: string;
  details: string | null;
  status: string;
  created_at: string;
};

const targetTypeOptions: { value: ReportTargetType; label: string }[] = [
  { value: "profile", label: "Profile" },
  { value: "post", label: "Post" },
  { value: "comment", label: "Comment" },
  { value: "message", label: "Message" },
  { value: "skill", label: "Skill" },
  { value: "library_document", label: "Library document" },
];

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
  const [reports, setReports] = useState<Report[]>([]);
  const [targetType, setTargetType] = useState<ReportTargetType>("profile");
  const [targetId, setTargetId] = useState("");
  const [reason, setReason] = useState(reasonOptions[0]);
  const [details, setDetails] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isWorking, setIsWorking] = useState(false);

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

      const { data: reportData, error: reportError } = await supabase
        .from("reports")
        .select("id, reporter_id, target_type, target_id, reason, details, status, created_at")
        .eq("reporter_id", userId)
        .order("created_at", { ascending: false });

      if (reportError) throw reportError;

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

    if (!currentUserId || !targetId.trim() || !reason.trim() || !isSupabaseConfigured()) return;

    setIsWorking(true);
    setMessage(null);

    try {
      const supabase = getSupabaseBrowserClient();

      const { error } = await supabase.from("reports").insert({
        reporter_id: currentUserId,
        target_type: targetType,
        target_id: targetId.trim(),
        reason,
        details: details.trim() || null,
        status: "submitted",
      });

      if (error) throw error;

      setTargetType("profile");
      setTargetId("");
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
          Submit a report for content or behaviour that needs review. Admin review actions are out of scope for this baseline.
        </p>
      </div>

      {message && <p className="rounded-lg border p-3 text-sm text-gray-700">{message}</p>}

      <form onSubmit={submitReport} className="flex flex-col gap-4 rounded-xl border p-4">
        <h2 className="text-xl font-semibold">Submit report</h2>

        <label className="flex flex-col gap-2 text-sm font-medium">
          Target type
          <select
            className="w-fit rounded-lg border px-3 py-2"
            value={targetType}
            onChange={(event) => setTargetType(event.target.value as ReportTargetType)}
          >
            {targetTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-2 text-sm font-medium">
          Target ID
          <input
            className="rounded-lg border px-3 py-2"
            value={targetId}
            onChange={(event) => setTargetId(event.target.value)}
            placeholder="Paste the ID of the profile, post, comment, message, skill, or document."
            required
          />
          <span className="text-xs text-gray-500">
            Baseline version uses manual IDs. Contextual report buttons will be added later.
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
            placeholder="Add a brief explanation for the moderation team."
          />
        </label>

        <button
          className="w-fit rounded-lg bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          disabled={!targetId.trim() || !reason.trim() || isWorking}
          type="submit"
        >
          Submit report
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
            {reports.map((report) => (
              <article key={report.id} className="rounded-xl border p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold">{formatTargetType(report.target_type)}</h3>
                  <span className="rounded-full border px-2 py-1 text-xs">{report.status}</span>
                </div>

                <p className="mt-2 text-sm text-gray-600">Reason: {report.reason}</p>
                <p className="mt-1 break-all text-xs text-gray-500">Target ID: {report.target_id}</p>

                {report.details && <p className="mt-3 whitespace-pre-wrap text-sm text-gray-700">{report.details}</p>}
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}

function formatTargetType(targetType: ReportTargetType) {
  return targetType
    .split("_")
    .map((word) => word[0]?.toUpperCase() + word.slice(1))
    .join(" ");
}
