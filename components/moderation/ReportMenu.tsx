"use client";

import { useEffect, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

type ReportTargetType =
  | "profile"
  | "post"
  | "comment"
  | "message"
  | "skill"
  | "library_document"
  | "profile_picture";

type ReportMenuProps = {
  targetType: ReportTargetType;
  targetId: string;
  reportedUserId: string;
  label: string;
  disabled?: boolean;
};

const reasons = [
  "Harassment or bullying",
  "Spam or scam",
  "False or misleading content",
  "Inappropriate content",
  "Impersonation",
  "Privacy concern",
  "Other",
];

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }
  return "Unable to submit report.";
}

export function ReportMenu({
  targetType,
  targetId,
  reportedUserId,
  label,
  disabled = false,
}: ReportMenuProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [reason, setReason] = useState(reasons[0]);
  const [details, setDetails] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isWorking, setIsWorking] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  async function submitReport(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsWorking(true);
    setMessage(null);

    try {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase.rpc("submit_moderation_report", {
        report_target_type: targetType,
        report_target_id: targetId,
        reported_user: reportedUserId,
        report_reason: reason,
        report_details: details.trim() || null,
      });

      if (error) throw error;

      setMessage(`Report submitted. Ticket: ${String(data)}`);
      setDetails("");
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        aria-label={`More options for ${label}`}
        className="rounded-full px-3 py-1 text-xl leading-none hover:bg-gray-100 disabled:opacity-50"
        disabled={disabled}
        onClick={() => setMenuOpen((current) => !current)}
        type="button"
      >
        ⋯
      </button>

      {menuOpen && (
        <div className="absolute right-0 top-10 z-20 min-w-44 rounded-xl border bg-white p-2 shadow-lg">
          <button
            className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-gray-50"
            onClick={() => {
              setMenuOpen(false);
              setDialogOpen(true);
              setMessage(null);
            }}
            type="button"
          >
            Report {label}
          </button>
        </div>
      )}

      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold">Report {label}</h2>
                <p className="mt-1 text-sm text-gray-600">
                  The exact item and account will be linked automatically to the moderation ticket.
                </p>
              </div>
              <button
                aria-label="Close report dialog"
                className="rounded-lg border px-3 py-1"
                onClick={() => setDialogOpen(false)}
                type="button"
              >
                ×
              </button>
            </div>

            <form className="mt-5 grid gap-4" onSubmit={submitReport}>
              <label className="grid gap-2 text-sm font-medium">
                Why are you reporting this?
                <select
                  className="rounded-lg border px-3 py-2"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                >
                  {reasons.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2 text-sm font-medium">
                Additional details
                <textarea
                  className="min-h-28 rounded-lg border px-3 py-2"
                  value={details}
                  onChange={(event) => setDetails(event.target.value)}
                  placeholder="Optional explanation for the moderation team"
                />
              </label>

              {message && <p className="rounded-lg border p-3 text-sm text-gray-700">{message}</p>}

              <div className="flex justify-end gap-3">
                <button
                  className="rounded-lg border px-4 py-2 text-sm font-medium"
                  onClick={() => setDialogOpen(false)}
                  type="button"
                >
                  Cancel
                </button>
                <button
                  className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                  disabled={isWorking}
                  type="submit"
                >
                  {isWorking ? "Submitting..." : "Submit report"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
