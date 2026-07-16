"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PostDetailWorkflow } from "@/components/timeline/PostDetailWorkflow";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

type PlatformRole = "user" | "moderator" | "senior_moderator" | "admin";

type ReportTicket = {
  id: string;
  ticket_number: string | null;
  target_type: string;
  target_id: string;
  reason: string;
  details: string | null;
  status: string;
  assigned_to: string | null;
};

type ReportedComment = {
  id: string;
  post_id: string;
  author_id: string;
  author_name: string;
  body: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

type AuditEntry = {
  id: string;
  action: string;
  notes: string;
  performed_by: string;
  performed_at: string;
  target_snapshot: {
    body?: string;
    target_type?: string;
    target_id?: string;
  } | null;
  moderator_name: string;
};

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

  return "Unable to load the moderation review.";
}

export function ModerationReview({ ticketId }: { ticketId: string }) {
  const [ticket, setTicket] = useState<ReportTicket | null>(null);
  const [role, setRole] = useState<PlatformRole>("user");
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [moderatorNotes, setModeratorNotes] = useState("");
  const [isWorking, setIsWorking] = useState(false);
  const [contentRevision, setContentRevision] = useState(0);
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [isAuditLoading, setIsAuditLoading] = useState(false);
  const [reportedComment, setReportedComment] =
    useState<ReportedComment | null>(null);
  const [isCommentLoading, setIsCommentLoading] = useState(false);

  async function loadReportedComment(commentId: string) {
    setIsCommentLoading(true);

    try {
      const supabase = getSupabaseBrowserClient();

      const commentResult = await supabase
        .from("comments")
        .select(
          "id, post_id, author_id, body, created_at, updated_at, deleted_at"
        )
        .eq("id", commentId)
        .maybeSingle();

      if (commentResult.error) throw commentResult.error;

      if (!commentResult.data) {
        setReportedComment(null);
        return;
      }

      const profileResult = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", commentResult.data.author_id)
        .maybeSingle();

      if (profileResult.error) throw profileResult.error;

      setReportedComment({
        ...commentResult.data,
        author_name: profileResult.data?.display_name ?? "Unknown user",
      } as ReportedComment);
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setIsCommentLoading(false);
    }
  }

  async function loadAuditHistory(reportId: string) {
    setIsAuditLoading(true);

    try {
      const supabase = getSupabaseBrowserClient();

      const auditResult = await supabase
        .from("moderation_action_log")
        .select(
          "id, action, notes, performed_by, performed_at, target_snapshot"
        )
        .eq("report_id", reportId)
        .order("performed_at", { ascending: true });

      if (auditResult.error) throw auditResult.error;

      const rawEntries = (auditResult.data ?? []) as Omit<
        AuditEntry,
        "moderator_name"
      >[];

      const moderatorIds = [
        ...new Set(rawEntries.map((entry) => entry.performed_by)),
      ];

      let profileById = new Map<string, string>();

      if (moderatorIds.length > 0) {
        const profileResult = await supabase
          .from("profiles")
          .select("id, display_name")
          .in("id", moderatorIds);

        if (profileResult.error) throw profileResult.error;

        profileById = new Map(
          (profileResult.data ?? []).map((profile) => [
            profile.id,
            profile.display_name,
          ])
        );
      }

      setAuditEntries(
        rawEntries.map((entry) => ({
          ...entry,
          moderator_name:
            profileById.get(entry.performed_by) ?? "FC moderator",
        }))
      );
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setIsAuditLoading(false);
    }
  }

  useEffect(() => {
    async function loadReview() {
      try {
        const supabase = getSupabaseBrowserClient();

        const roleResult = await supabase.rpc("current_platform_role");

        if (roleResult.error) throw roleResult.error;

        const currentRole = (roleResult.data ?? "user") as PlatformRole;
        setRole(currentRole);

        if (!["moderator", "senior_moderator", "admin"].includes(currentRole)) {
          return;
        }

        const ticketResult = await supabase
          .from("reports")
          .select(
            "id, ticket_number, target_type, target_id, reason, details, status, assigned_to"
          )
          .eq("id", ticketId)
          .maybeSingle();

        if (ticketResult.error) throw ticketResult.error;

        if (!ticketResult.data) {
          setMessage("Moderation ticket not found.");
          return;
        }

        const loadedTicket = ticketResult.data as ReportTicket;

        setTicket(loadedTicket);

        await Promise.all([
          loadAuditHistory(ticketId),
          loadedTicket.target_type === "comment"
            ? loadReportedComment(loadedTicket.target_id)
            : Promise.resolve(),
        ]);
      } catch (error) {
        setMessage(getErrorMessage(error));
      } finally {
        setIsLoading(false);
      }
    }

    void loadReview();
  }, [ticketId]);

  async function takeAction(
    action: "dismissed" | "warned" | "escalated" | "redacted" | "removed"
  ) {
    if (!ticket) return;

    if (
      action === "removed" &&
      !window.confirm(
        `Remove this ${ticket.target_type} from FieldsConnect? The content will be hidden but retained for moderation records.`
      )
    ) {
      return;
    }

    if (moderatorNotes.trim().length < 10) {
      setMessage("Moderator notes must contain at least 10 characters.");
      return;
    }

    setIsWorking(true);
    setMessage(null);

    try {
      const supabase = getSupabaseBrowserClient();

      const { error } = await supabase.rpc("resolve_moderation_ticket", {
        report_id: ticket.id,
        moderation_action: action,
        action_notes: moderatorNotes.trim(),
      });

      if (error) throw error;

      const nextStatus =
        action === "dismissed"
          ? "dismissed"
          : action === "escalated"
            ? "reviewing"
            : "actioned";

      setTicket({
        ...ticket,
        status: nextStatus,
      });

      if (action === "redacted" || action === "removed") {
        setContentRevision((current) => current + 1);

        if (ticket.target_type === "comment") {
          await loadReportedComment(ticket.target_id);
        }
      }

      await loadAuditHistory(ticket.id);

      setMessage(
        action === "dismissed"
          ? "Report dismissed."
          : action === "warned"
            ? "Warning sent to the user."
            : action === "escalated"
              ? "Ticket escalated."
              : action === "redacted"
                ? `${ticket.target_type === "comment" ? "Comment" : "Post"} redacted and the user notified.`
                : `${ticket.target_type === "comment" ? "Comment" : "Post"} removed and the user notified.`
      );
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setIsWorking(false);
    }
  }

  if (isLoading) {
    return (
      <p className="mx-auto max-w-5xl p-8 text-sm text-gray-600">
        Loading moderation review...
      </p>
    );
  }

  if (!["moderator", "senior_moderator", "admin"].includes(role)) {
    return (
      <section className="mx-auto max-w-3xl p-8">
        <h1 className="text-3xl font-semibold">Moderation review</h1>

        <p className="mt-4 rounded-xl border p-4 text-sm text-gray-700">
          This review is available only to active FieldsConnect moderators and
          administrators.
        </p>
      </section>
    );
  }

  if (!ticket) {
    return (
      <section className="mx-auto max-w-3xl p-8">
        <Link
          className="text-sm font-medium text-blue-700 underline"
          href="/moderation/dashboard"
        >
          Back to moderation dashboard
        </Link>

        <p className="mt-4 rounded-xl border p-4 text-sm text-gray-700">
          {message ?? "Moderation ticket not found."}
        </p>
      </section>
    );
  }

  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-8">
      <div>
        <Link
          className="text-sm font-medium text-blue-700 underline"
          href="/moderation/dashboard"
        >
          Back to moderation dashboard
        </Link>

        <p className="mt-5 text-sm font-medium text-blue-700">
          {ticket.ticket_number ?? "Legacy report"}
        </p>

        <h1 className="mt-1 text-3xl font-semibold">Moderation review</h1>

        <div className="mt-4 grid gap-3 rounded-xl border p-4 text-sm md:grid-cols-2">
          <div>
            <span className="font-medium">Report reason:</span>{" "}
            {ticket.reason}
          </div>

          <div>
            <span className="font-medium">Status:</span> {ticket.status}
          </div>

          <div>
            <span className="font-medium">Content type:</span>{" "}
            {ticket.target_type.replaceAll("_", " ")}
          </div>

          <div>
            <span className="font-medium">Assignment:</span>{" "}
            {ticket.assigned_to ? "Assigned" : "Unassigned"}
          </div>
        </div>

        {ticket.details && (
          <div className="mt-4 rounded-xl bg-gray-50 p-4">
            <h2 className="font-medium">Reporter details</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">
              {ticket.details}
            </p>
          </div>
        )}
      </div>

      <div className="border-t pt-6">
        <h2 className="mb-4 text-xl font-semibold">Reported content</h2>

        {ticket.target_type === "post" ? (
          <PostDetailWorkflow
            key={`${ticket.target_id}-${contentRevision}`}
            postId={ticket.target_id}
          />
        ) : ticket.target_type === "comment" ? (
          isCommentLoading ? (
            <p className="rounded-xl border p-4 text-sm text-gray-600">
              Loading reported comment...
            </p>
          ) : reportedComment ? (
            <article className="rounded-xl border bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{reportedComment.author_name}</p>
                  <p className="mt-1 text-xs text-gray-500">
                    Comment on post {reportedComment.post_id}
                  </p>
                </div>

                <time
                  className="text-sm text-gray-500"
                  dateTime={reportedComment.created_at}
                >
                  {new Date(reportedComment.created_at).toLocaleString("en-ZA", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </time>
              </div>

              {reportedComment.deleted_at ? (
                <p className="mt-4 rounded-lg border border-dashed p-3 text-sm text-gray-600">
                  This comment was removed by FCModerators.
                </p>
              ) : (
                <p className="mt-4 whitespace-pre-wrap text-sm text-gray-800">
                  {reportedComment.body}
                </p>
              )}
            </article>
          ) : (
            <p className="rounded-xl border border-dashed p-4 text-sm text-gray-600">
              The reported comment could not be found.
            </p>
          )
        ) : (
          <p className="rounded-xl border border-dashed p-4 text-sm text-gray-600">
            Review support for {ticket.target_type.replaceAll("_", " ")} will
            be added next.
          </p>
        )}
      </div>
      <div className="rounded-xl border p-4">
        <h2 className="text-xl font-semibold">Moderation decision</h2>

        <label className="mt-4 flex flex-col gap-2 text-sm font-medium">
          Internal moderator notes
          <textarea
            className="min-h-32 rounded-lg border px-3 py-2"
            value={moderatorNotes}
            onChange={(event) => setModeratorNotes(event.target.value)}
            placeholder="Record the review findings and justification. Minimum 10 characters."
            disabled={isWorking || ticket.status === "actioned" || ticket.status === "dismissed"}
          />
        </label>

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            className="rounded-lg border px-4 py-2 text-sm font-medium disabled:opacity-50"
            disabled={isWorking || ticket.status === "actioned" || ticket.status === "dismissed"}
            onClick={() => takeAction("dismissed")}
            type="button"
          >
            {isWorking ? "Working..." : "Dismiss report"}
          </button>

          <button
            className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            disabled={isWorking || ticket.status === "actioned" || ticket.status === "dismissed"}
            onClick={() => takeAction("warned")}
            type="button"
          >
            {isWorking ? "Working..." : "Warn user"}
          </button>

          <button
            className="rounded-lg border px-4 py-2 text-sm font-medium disabled:opacity-50"
            disabled={
              isWorking ||
              ticket.status === "actioned" ||
              ticket.status === "dismissed"
            }
            onClick={() => takeAction("escalated")}
            type="button"
          >
            {isWorking ? "Working..." : "Escalate"}
          </button>

          {["post", "comment"].includes(ticket.target_type) && (
            <>
              <button
                className="rounded-lg border border-amber-600 px-4 py-2 text-sm font-medium text-amber-800 disabled:opacity-50"
                disabled={
                  isWorking ||
                  ticket.status === "actioned" ||
                  ticket.status === "dismissed"
                }
                onClick={() => takeAction("redacted")}
                type="button"
              >
                {isWorking ? "Working..." : `Redact ${ticket.target_type}`}
              </button>

              <button
                className="rounded-lg border border-red-700 px-4 py-2 text-sm font-medium text-red-700 disabled:opacity-50"
                disabled={
                  isWorking ||
                  ticket.status === "actioned" ||
                  ticket.status === "dismissed"
                }
                onClick={() => takeAction("removed")}
                type="button"
              >
                {isWorking ? "Working..." : `Remove ${ticket.target_type}`}
              </button>
            </>
          )}
        </div>

        {message && (
          <p className="mt-4 rounded-lg border p-3 text-sm text-gray-700">
            {message}
          </p>
        )}
      </div>

      <div className="rounded-xl border p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">Audit history</h2>
            <p className="mt-1 text-sm text-gray-600">
              Internal record of moderation decisions for this ticket.
            </p>
          </div>

          <button
            className="rounded-lg border px-3 py-2 text-sm font-medium disabled:opacity-50"
            disabled={isAuditLoading}
            onClick={() => loadAuditHistory(ticket.id)}
            type="button"
          >
            {isAuditLoading ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {isAuditLoading && auditEntries.length === 0 ? (
          <p className="mt-4 text-sm text-gray-600">
            Loading audit history...
          </p>
        ) : auditEntries.length === 0 ? (
          <p className="mt-4 rounded-lg border border-dashed p-4 text-sm text-gray-600">
            No moderation actions have been recorded for this ticket.
          </p>
        ) : (
          <ol className="mt-5 space-y-4">
            {auditEntries.map((entry) => {
              const originalBody =
                entry.target_snapshot &&
                typeof entry.target_snapshot.body === "string"
                  ? entry.target_snapshot.body
                  : null;

              return (
                <li
                  className="rounded-xl border bg-gray-50 p-4"
                  key={entry.id}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold capitalize">
                        {entry.action.replaceAll("_", " ")}
                      </p>

                      <p className="mt-1 text-sm text-gray-600">
                        By {entry.moderator_name}
                      </p>
                    </div>

                    <time
                      className="text-sm text-gray-500"
                      dateTime={entry.performed_at}
                    >
                      {new Date(entry.performed_at).toLocaleString("en-ZA", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </time>
                  </div>

                  <div className="mt-3">
                    <p className="text-sm font-medium">Internal notes</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-gray-700">
                      {entry.notes}
                    </p>
                  </div>

                  {originalBody && (
                    <details className="mt-4 rounded-lg border bg-white p-3">
                      <summary className="cursor-pointer text-sm font-medium">
                        View original content snapshot
                      </summary>

                      <p className="mt-3 whitespace-pre-wrap text-sm text-gray-700">
                        {originalBody}
                      </p>
                    </details>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </div>

    </section>
  );
}