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
  resolution_action: string | null;
  assigned_to: string | null;
};

type AccountSuspension = {
  id: string;
  user_id: string;
  report_id: string;
  duration_days: number;
  reason: string;
  starts_at: string;
  ends_at: string;
  imposed_by: string;
  revoked_at: string | null;
  revoked_by: string | null;
  revocation_reason: string | null;
  created_at: string;
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

type ReportedLibraryDocument = {
  id: string;
  owner_id: string;
  owner_name: string;
  title: string;
  description: string | null;
  file_name: string;
  file_size_bytes: number;
  mime_type: string;
  storage_bucket: string;
  storage_path: string;
  visibility: string;
  is_published: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

type ModerationMessageContext = {
  message_id: string;
  conversation_id: string;
  sender_id: string;
  sender_name: string;
  body: string;
  created_at: string;
  is_reported_message: boolean;
};

type AuditEntry = {
  id: string;
  action: string;
  notes: string;
  performed_by: string;
  performed_at: string;
  target_snapshot: {
    body?: string;
    title?: string;
    description?: string | null;
    file_name?: string;
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
  const [reportedLibraryDocument, setReportedLibraryDocument] =
    useState<ReportedLibraryDocument | null>(null);
  const [isLibraryDocumentLoading, setIsLibraryDocumentLoading] =
    useState(false);
  const [messageContext, setMessageContext] =
    useState<ModerationMessageContext[]>([]);
  const [isMessageContextLoading, setIsMessageContextLoading] =
    useState(false);
  const [isMessageEvidenceUnavailable, setIsMessageEvidenceUnavailable] =
    useState(false);
  const [suspension, setSuspension] =
    useState<AccountSuspension | null>(null);
  const [isSuspensionLoading, setIsSuspensionLoading] = useState(false);
  const [suspensionReason, setSuspensionReason] = useState("");
  const [liftReason, setLiftReason] = useState("");

  async function loadReportedMessageContext(reportId: string) {
    setIsMessageContextLoading(true);
    setIsMessageEvidenceUnavailable(false);

    try {
      const supabase = getSupabaseBrowserClient();

      const contextResult = await supabase.rpc(
        "get_moderation_message_context",
        {
          report_id: reportId,
        }
      );

      if (contextResult.error) {
        const errorMessage = getErrorMessage(contextResult.error);

        if (
          errorMessage.includes("Message evidence is no longer available")
        ) {
          setMessageContext([]);
          setIsMessageEvidenceUnavailable(true);
          return;
        }

        throw contextResult.error;
      }

      setMessageContext(
        (contextResult.data ?? []) as ModerationMessageContext[]
      );
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setIsMessageContextLoading(false);
    }
  }

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

  async function loadReportedLibraryDocument(documentId: string) {
    setIsLibraryDocumentLoading(true);

    try {
      const supabase = getSupabaseBrowserClient();

      const documentResult = await supabase
        .from("library_documents")
        .select(
          "id, owner_id, title, description, file_name, file_size_bytes, mime_type, storage_bucket, storage_path, visibility, is_published, created_at, updated_at, deleted_at"
        )
        .eq("id", documentId)
        .maybeSingle();

      if (documentResult.error) throw documentResult.error;

      if (!documentResult.data) {
        setReportedLibraryDocument(null);
        return;
      }

      const profileResult = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", documentResult.data.owner_id)
        .maybeSingle();

      if (profileResult.error) throw profileResult.error;

      setReportedLibraryDocument({
        ...documentResult.data,
        owner_name: profileResult.data?.display_name ?? "Unknown user",
      } as ReportedLibraryDocument);
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setIsLibraryDocumentLoading(false);
    }
  }

  async function openReportedLibraryDocument() {
    if (!reportedLibraryDocument) return;

    setIsWorking(true);
    setMessage(null);

    try {
      const supabase = getSupabaseBrowserClient();

      const { data, error } = await supabase.storage
        .from(reportedLibraryDocument.storage_bucket)
        .createSignedUrl(reportedLibraryDocument.storage_path, 300);

      if (error) throw error;

      if (!data?.signedUrl) {
        throw new Error("Unable to generate a secure resource link.");
      }

      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setIsWorking(false);
    }
  }

  async function loadSuspension(reportId: string) {
    setIsSuspensionLoading(true);

    try {
      const supabase = getSupabaseBrowserClient();

      const suspensionResult = await supabase
        .from("account_suspensions")
        .select(
          "id, user_id, report_id, duration_days, reason, starts_at, ends_at, imposed_by, revoked_at, revoked_by, revocation_reason, created_at"
        )
        .eq("report_id", reportId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (suspensionResult.error) throw suspensionResult.error;

      setSuspension(
        suspensionResult.data
          ? (suspensionResult.data as AccountSuspension)
          : null
      );
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setIsSuspensionLoading(false);
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
            "id, ticket_number, target_type, target_id, reason, details, status, resolution_action, assigned_to"
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
          ["senior_moderator", "admin"].includes(currentRole)
            ? loadSuspension(ticketId)
            : Promise.resolve(),
          loadedTicket.target_type === "comment"
            ? loadReportedComment(loadedTicket.target_id)
            : loadedTicket.target_type === "library_document"
              ? loadReportedLibraryDocument(loadedTicket.target_id)
              : loadedTicket.target_type === "message"
                ? loadReportedMessageContext(ticketId)
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
        resolution_action: action,
      });

      if (
        ticket.target_type === "message" &&
        nextStatus !== "reviewing"
      ) {
        setMessageContext([]);
        setIsMessageEvidenceUnavailable(true);
      }

      if (action === "redacted" || action === "removed") {
        setContentRevision((current) => current + 1);

        if (ticket.target_type === "comment") {
          await loadReportedComment(ticket.target_id);
        } else if (ticket.target_type === "library_document") {
          await loadReportedLibraryDocument(ticket.target_id);
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
                ? `${ticket.target_type === "comment"
                    ? "Comment"
                    : ticket.target_type === "library_document"
                      ? "Library resource"
                      : ticket.target_type === "message"
                        ? "Message"
                        : "Post"} redacted and the user notified.`
                : `${ticket.target_type === "comment"
                    ? "Comment"
                    : ticket.target_type === "library_document"
                      ? "Library resource"
                      : ticket.target_type === "message"
                        ? "Message"
                        : "Post"} removed and the user notified.`
      );
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setIsWorking(false);
    }
  }

  async function suspendUser(durationDays: 10 | 30) {
    if (!ticket) return;

    if (!["senior_moderator", "admin"].includes(role)) {
      setMessage(
        "Only a senior moderator or administrator may suspend an account."
      );
      return;
    }

    if (ticket.status !== "reviewing" || ticket.resolution_action !== "escalated") {
      setMessage(
        "This ticket must be escalated and under review before a suspension can be imposed."
      );
      return;
    }

    const trimmedReason = suspensionReason.trim();

    if (trimmedReason.length < 10) {
      setMessage(
        "A suspension reason of at least 10 characters is required."
      );
      return;
    }

    const confirmed = window.confirm(
      `Suspend this account for ${durationDays} days? The user will receive the reason entered below.`
    );

    if (!confirmed) return;

    setIsWorking(true);
    setMessage(null);

    try {
      const supabase = getSupabaseBrowserClient();

      const { error } = await supabase.rpc(
        "suspend_account_for_ticket",
        {
          report_id: ticket.id,
          suspension_days: durationDays,
          suspension_reason: trimmedReason,
        }
      );

      if (error) throw error;

      setTicket({
        ...ticket,
        status: "actioned",
        resolution_action: "suspended",
      });

      setSuspensionReason("");
      setMessage(`Account suspended for ${durationDays} days.`);

      if (ticket.target_type === "message") {
        setMessageContext([]);
        setIsMessageEvidenceUnavailable(true);
      }

      await Promise.all([
        loadSuspension(ticket.id),
        loadAuditHistory(ticket.id),
      ]);
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setIsWorking(false);
    }
  }

  async function liftSuspensionEarly() {
    if (!ticket || !suspension) return;

    if (!["senior_moderator", "admin"].includes(role)) {
      setMessage(
        "Only a senior moderator or administrator may lift a suspension."
      );
      return;
    }

    const trimmedReason = liftReason.trim();

    if (trimmedReason.length < 10) {
      setMessage(
        "A reason of at least 10 characters is required to lift this suspension."
      );
      return;
    }

    const confirmed = window.confirm(
      "Lift this suspension early? Access to FieldsConnect activity will be restored immediately."
    );

    if (!confirmed) return;

    setIsWorking(true);
    setMessage(null);

    try {
      const supabase = getSupabaseBrowserClient();

      const { error } = await supabase.rpc(
        "revoke_account_suspension",
        {
          suspension_id: suspension.id,
          revocation_reason: trimmedReason,
        }
      );

      if (error) throw error;

      setLiftReason("");
      setMessage(
        "Suspension lifted early. The reason has been recorded and the user has been notified."
      );

      await Promise.all([
        loadSuspension(ticket.id),
        loadAuditHistory(ticket.id),
      ]);
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setIsWorking(false);
    }
  }

  const suspensionIsActive =
    suspension !== null &&
    suspension.revoked_at === null &&
    new Date(suspension.ends_at).getTime() > Date.now();

  const canApplySuspension =
    ["senior_moderator", "admin"].includes(role) &&
    ticket?.status === "reviewing" &&
    ticket?.resolution_action === "escalated" &&
    !suspensionIsActive;

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

          <div>
            <span className="font-medium">Resolution action:</span>{" "}
            {ticket.resolution_action
              ? ticket.resolution_action.replaceAll("_", " ")
              : "None"}
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
        ) : ticket.target_type === "library_document" ? (
          isLibraryDocumentLoading ? (
            <p className="rounded-xl border p-4 text-sm text-gray-600">
              Loading reported library resource...
            </p>
          ) : reportedLibraryDocument ? (
            <article className="rounded-xl border bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold">
                    {reportedLibraryDocument.title}
                  </h3>
                  <p className="mt-1 text-sm text-gray-600">
                    Uploaded by {reportedLibraryDocument.owner_name}
                  </p>
                </div>

                <time
                  className="text-sm text-gray-500"
                  dateTime={reportedLibraryDocument.created_at}
                >
                  {new Date(
                    reportedLibraryDocument.created_at
                  ).toLocaleString("en-ZA", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </time>
              </div>

              {reportedLibraryDocument.deleted_at ? (
                <p className="mt-4 rounded-lg border border-dashed p-3 text-sm text-gray-600">
                  This library resource was removed by FCModerators.
                </p>
              ) : (
                <>
                  {reportedLibraryDocument.description && (
                    <p className="mt-4 whitespace-pre-wrap text-sm text-gray-700">
                      {reportedLibraryDocument.description}
                    </p>
                  )}

                  <dl className="mt-4 grid gap-3 rounded-lg bg-gray-50 p-3 text-sm md:grid-cols-2">
                    <div>
                      <dt className="font-medium">File name</dt>
                      <dd className="mt-1 break-all">
                        {reportedLibraryDocument.deleted_at ? (
                          <span className="text-gray-500">
                            {reportedLibraryDocument.file_name}
                          </span>
                        ) : (
                          <button
                            className="font-medium text-blue-700 underline underline-offset-2 disabled:opacity-50"
                            disabled={isWorking}
                            onClick={openReportedLibraryDocument}
                            type="button"
                          >
                            {reportedLibraryDocument.file_name}
                          </button>
                        )}
                      </dd>
                    </div>

                    <div>
                      <dt className="font-medium">File size</dt>
                      <dd className="mt-1 text-gray-700">
                        {formatFileSize(
                          reportedLibraryDocument.file_size_bytes
                        )}
                      </dd>
                    </div>

                    <div>
                      <dt className="font-medium">File type</dt>
                      <dd className="mt-1 text-gray-700">
                        {reportedLibraryDocument.mime_type}
                      </dd>
                    </div>

                    <div>
                      <dt className="font-medium">Publication status</dt>
                      <dd className="mt-1 text-gray-700">
                        {reportedLibraryDocument.is_published
                          ? "Published"
                          : "Unpublished"}
                      </dd>
                    </div>

                    <div>
                      <dt className="font-medium">Visibility</dt>
                      <dd className="mt-1 capitalize text-gray-700">
                        {reportedLibraryDocument.visibility}
                      </dd>
                    </div>
                  </dl>
                </>
              )}
            </article>
          ) : (
            <p className="rounded-xl border border-dashed p-4 text-sm text-gray-600">
              The reported library resource could not be found or is no longer
              accessible.
            </p>
          )
        ) : ticket.target_type === "message" ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
              <h3 className="font-semibold text-amber-950">
                Confidential message evidence
              </h3>
              <p className="mt-2 text-sm text-amber-900">
                This view contains only the reported message and up to 10
                messages immediately before it. Do not copy, share, or use this
                content outside this moderation review. Access ends when the
                ticket is resolved.
              </p>
            </div>

            {isMessageContextLoading ? (
              <p className="rounded-xl border p-4 text-sm text-gray-600">
                Loading restricted message evidence...
              </p>
            ) : isMessageEvidenceUnavailable ? (
              <p className="rounded-xl border border-dashed p-4 text-sm text-gray-600">
                Private message evidence is no longer available because this
                ticket has been resolved.
              </p>
            ) : messageContext.length === 0 ? (
              <p className="rounded-xl border border-dashed p-4 text-sm text-gray-600">
                No message evidence is available for this ticket.
              </p>
            ) : (
              <div className="rounded-xl border bg-gray-50 p-4">
                <p className="mb-4 text-sm text-gray-600">
                  Showing {messageContext.length - 1} prior{" "}
                  {messageContext.length - 1 === 1 ? "message" : "messages"} and
                  the reported message. No later messages are displayed.
                </p>

                <ol className="space-y-3">
                  {messageContext.map((contextMessage) => (
                    <li
                      className={
                        contextMessage.is_reported_message
                          ? "rounded-xl border-2 border-red-600 bg-red-50 p-4"
                          : "rounded-xl border bg-white p-4"
                      }
                      key={contextMessage.message_id}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold">
                            {contextMessage.sender_name}
                          </p>

                          {contextMessage.is_reported_message && (
                            <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-red-700">
                              Reported message
                            </p>
                          )}
                        </div>

                        <time
                          className="text-sm text-gray-500"
                          dateTime={contextMessage.created_at}
                        >
                          {new Date(
                            contextMessage.created_at
                          ).toLocaleString("en-ZA", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        </time>
                      </div>

                      <p className="mt-3 whitespace-pre-wrap text-sm text-gray-800">
                        {contextMessage.body}
                      </p>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
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

          {["post", "comment", "library_document", "message"].includes(ticket.target_type) && (
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
                {isWorking
                  ? "Working..."
                  : `Redact ${
                      ticket.target_type === "library_document"
                        ? "library resource"
                        : ticket.target_type
                    }`}
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
                {isWorking
                  ? "Working..."
                  : `Remove ${
                      ticket.target_type === "library_document"
                        ? "library resource"
                        : ticket.target_type
                    }`}
              </button>
            </>
          )}
        </div>

        {["senior_moderator", "admin"].includes(role) && (
          <div className="mt-6 border-t pt-6">
            <h3 className="text-lg font-semibold">
              Account suspension
            </h3>

            {isSuspensionLoading ? (
              <p className="mt-3 text-sm text-gray-600">
                Loading suspension record...
              </p>
            ) : suspension ? (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4">
                <div className="grid gap-3 text-sm md:grid-cols-2">
                  <div>
                    <span className="font-medium">Duration:</span>{" "}
                    {suspension.duration_days} days
                  </div>

                  <div>
                    <span className="font-medium">Current state:</span>{" "}
                    <span
                      className={
                        suspensionIsActive
                          ? "font-semibold text-red-700"
                          : "font-semibold text-green-700"
                      }
                    >
                      {suspensionIsActive
                        ? "Active"
                        : suspension.revoked_at
                          ? "Lifted early"
                          : "Expired"}
                    </span>
                  </div>

                  <div>
                    <span className="font-medium">Started:</span>{" "}
                    {new Date(suspension.starts_at).toLocaleString("en-ZA", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </div>

                  <div>
                    <span className="font-medium">Scheduled end:</span>{" "}
                    {new Date(suspension.ends_at).toLocaleString("en-ZA", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </div>
                </div>

                <div className="mt-4 rounded-lg bg-white p-3">
                  <p className="text-sm font-medium">
                    Suspension reason
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-gray-700">
                    {suspension.reason}
                  </p>
                </div>

                {suspension.revoked_at && (
                  <div className="mt-3 rounded-lg border border-green-200 bg-green-50 p-3">
                    <p className="text-sm font-medium text-green-900">
                      Early-lift record
                    </p>

                    <p className="mt-2 text-sm text-green-900">
                      Lifted on{" "}
                      {new Date(suspension.revoked_at).toLocaleString("en-ZA", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </p>

                    <p className="mt-2 whitespace-pre-wrap text-sm text-green-900">
                      <span className="font-medium">Reason:</span>{" "}
                      {suspension.revocation_reason ??
                        "No revocation reason was recorded."}
                    </p>
                  </div>
                )}

                {suspensionIsActive && (
                  <div className="mt-5">
                    <label className="flex flex-col gap-2 text-sm font-medium">
                      Reason for lifting suspension early
                      <textarea
                        className="min-h-28 rounded-lg border border-red-300 bg-white px-3 py-2"
                        value={liftReason}
                        onChange={(event) =>
                          setLiftReason(event.target.value)
                        }
                        placeholder="Explain the evaluation and why early restoration is justified. Minimum 10 characters."
                        disabled={isWorking}
                      />
                    </label>

                    <p className="mt-2 text-xs text-gray-600">
                      This reason is permanently retained for the moderation
                      record.
                    </p>

                    <button
                      className="mt-3 rounded-lg border border-red-700 bg-white px-4 py-2 text-sm font-medium text-red-700 disabled:opacity-50"
                      disabled={
                        isWorking || liftReason.trim().length < 10
                      }
                      onClick={liftSuspensionEarly}
                      type="button"
                    >
                      {isWorking
                        ? "Working..."
                        : "Lift suspension early"}
                    </button>
                  </div>
                )}
              </div>
            ) : canApplySuspension ? (
              <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4">
                <p className="text-sm text-amber-950">
                  This ticket has been escalated. Record a user-safe reason
                  before imposing an account suspension.
                </p>

                <label className="mt-4 flex flex-col gap-2 text-sm font-medium">
                  Suspension reason
                  <textarea
                    className="min-h-28 rounded-lg border border-amber-400 bg-white px-3 py-2"
                    value={suspensionReason}
                    onChange={(event) =>
                      setSuspensionReason(event.target.value)
                    }
                    placeholder="Explain the confirmed violation and reason for suspension. This text will be shown to the user."
                    disabled={isWorking}
                  />
                </label>

                <p className="mt-2 text-xs text-amber-900">
                  Do not include the reporter’s identity, confidential
                  evidence, or internal moderator notes.
                </p>

                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    className="rounded-lg border border-red-700 bg-white px-4 py-2 text-sm font-medium text-red-700 disabled:opacity-50"
                    disabled={
                      isWorking || suspensionReason.trim().length < 10
                    }
                    onClick={() => suspendUser(10)}
                    type="button"
                  >
                    {isWorking ? "Working..." : "Suspend 10 days"}
                  </button>

                  <button
                    className="rounded-lg bg-red-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                    disabled={
                      isWorking || suspensionReason.trim().length < 10
                    }
                    onClick={() => suspendUser(30)}
                    type="button"
                  >
                    {isWorking ? "Working..." : "Suspend 30 days"}
                  </button>
                </div>
              </div>
            ) : (
              <p className="mt-3 rounded-lg border border-dashed p-3 text-sm text-gray-600">
                Account suspension controls become available after the ticket
                is escalated to a senior moderator or administrator.
              </p>
            )}
          </div>
        )}

        {message && (
          <p
            className={`mt-4 rounded-lg border p-3 text-sm ${
              message.toLowerCase().includes("required") ||
              message.toLowerCase().includes("unable") ||
              message.toLowerCase().includes("only a senior") ||
              message.toLowerCase().includes("must be escalated")
                ? "border-red-300 bg-red-50 font-medium text-red-700"
                : "text-gray-700"
            }`}
          >
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
function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}