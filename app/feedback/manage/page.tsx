"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FeedbackTicketActions } from "@/components/feedback/FeedbackTicketActions";
import {
  getSupabaseBrowserClient,
  isSupabaseConfigured,
} from "@/lib/supabase/browser";

type PlatformRole =
  | "user"
  | "moderator"
  | "senior_moderator"
  | "admin";

type FeedbackSubmission = {
  id: string;
  submitted_by: string;
  title: string;
  description: string;
  review_status: string;
  created_at: string;
};

type Profile = {
  id: string;
  display_name: string;
};

type FcTeamMember = {
  user_id: string;
  revoked_at: string | null;
};

type FeedbackTicket = {
  id: string;
  ticket_number: string | null;
  source_submission_id: string | null;
  title: string;
  description: string;
  internal_classification: string | null;
  priority: string;
  status: string;
  assigned_to: string | null;
  resolution_summary: string | null;
  fc_news_required: boolean;
  created_at: string;
};

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }

  return fallback;
}

function formatLabel(value: string) {
  return value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export default function ManageFeedbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedSubmissionId = searchParams.get("submission");
  const requestedTicketId = searchParams.get("ticket");

  const [currentRole, setCurrentRole] =
    useState<PlatformRole>("user");

  const [feedbackItems, setFeedbackItems] =
    useState<FeedbackSubmission[]>([]);

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [teamMembers, setTeamMembers] =
    useState<FcTeamMember[]>([]);

  const [tickets, setTickets] =
    useState<FeedbackTicket[]>([]);

  const [selectedSubmissionId, setSelectedSubmissionId] =
    useState<string | null>(requestedSubmissionId);

  const [ticketTitle, setTicketTitle] = useState("");
  const [ticketDescription, setTicketDescription] =
    useState("");

  const [classification, setClassification] =
    useState("");

  const [priority, setPriority] = useState("medium");
  const [selectedAssigneeId, setSelectedAssigneeId] =
    useState("");

  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isWorking, setIsWorking] = useState(false);
  const [hasAccess, setHasAccess] =
    useState<boolean | null>(null);

  const profileById = useMemo(
    () =>
      new Map(
        profiles.map((profile) => [profile.id, profile])
      ),
    [profiles]
  );

  const selectedFeedback = useMemo(
    () =>
      feedbackItems.find(
        (feedback) =>
          feedback.id === selectedSubmissionId
      ) ?? null,
    [feedbackItems, selectedSubmissionId]
  );

  const selectedTicket = useMemo(
    () =>
      tickets.find(
        (ticket) =>
          ticket.source_submission_id ===
          selectedSubmissionId
      ) ?? null,
    [selectedSubmissionId, tickets]
  );

  const assignableMembers = useMemo(
    () =>
      teamMembers
        .filter((member) => member.revoked_at === null)
        .map((member) => ({
          ...member,
          displayName:
            profileById.get(member.user_id)?.display_name ??
            "Unknown profile",
        }))
        .sort((left, right) =>
          left.displayName.localeCompare(
            right.displayName
          )
        ),
    [profileById, teamMembers]
  );

  const isAdmin = currentRole === "admin";

  const ticketReady =
    ticketTitle.trim().length >= 3 &&
    ticketDescription.trim().length >= 10;

  async function loadFeedback() {
    if (!isSupabaseConfigured()) {
      setMessage(
        "FieldsConnect feedback is currently unavailable."
      );
      setHasAccess(false);
      setIsLoading(false);
      return;
    }

    try {
      const supabase = getSupabaseBrowserClient();

      const [
        accessResult,
        roleResult,
      ] = await Promise.all([
        supabase.rpc("can_manage_fc_feedback"),
        supabase.rpc("current_platform_role"),
      ]);

      if (accessResult.error) throw accessResult.error;
      if (roleResult.error) throw roleResult.error;

      if (!accessResult.data) {
        setHasAccess(false);
        setMessage(
          "Access denied. This page is available only to FieldsConnect administrators and active FC Team members."
        );
        return;
      }

      setHasAccess(true);
      setCurrentRole(
        (roleResult.data ?? "user") as PlatformRole
      );

      const [
        feedbackResult,
        profileResult,
        teamResult,
        ticketResult,
      ] = await Promise.all([
        supabase
          .from("fc_feedback_submissions")
          .select(
            "id, submitted_by, title, description, review_status, created_at"
          )
          .order("created_at", { ascending: false }),

        supabase
          .from("profiles")
          .select("id, display_name")
          .is("deleted_at", null),

        supabase
          .from("fc_team_members")
          .select("user_id, revoked_at"),

        supabase
          .from("fc_feedback_tickets")
          .select(
            "id, ticket_number, source_submission_id, title, description, internal_classification, priority, status, assigned_to, resolution_summary, fc_news_required, created_at"
          )
          .order("created_at", { ascending: false }),
      ]);

      if (feedbackResult.error) {
        throw feedbackResult.error;
      }

      if (profileResult.error) {
        throw profileResult.error;
      }

      if (teamResult.error) {
        throw teamResult.error;
      }

      if (ticketResult.error) {
        throw ticketResult.error;
      }

      const submissions =
        (feedbackResult.data ??
          []) as FeedbackSubmission[];

      setFeedbackItems(submissions);
      setProfiles(
        (profileResult.data ?? []) as Profile[]
      );

      setTeamMembers(
        (teamResult.data ?? []) as FcTeamMember[]
      );

      setTickets(
        (ticketResult.data ??
          []) as FeedbackTicket[]
      );

      setSelectedSubmissionId((currentId) => {
        if (
          currentId &&
          submissions.some(
            (submission) =>
              submission.id === currentId
          )
        ) {
          return currentId;
        }

        if (requestedTicketId) {
          const linkedTicket = (
            ticketResult.data ?? []
          ).find(
            (ticket) =>
              ticket.id === requestedTicketId
          ) as FeedbackTicket | undefined;

          if (
            linkedTicket?.source_submission_id &&
            submissions.some(
              (submission) =>
                submission.id ===
                linkedTicket.source_submission_id
            )
          ) {
            return linkedTicket.source_submission_id;
          }
        }

        return submissions[0]?.id ?? null;
      });
    } catch (error) {
      setHasAccess(false);
      setMessage(
        getErrorMessage(
          error,
          "Unable to verify access to feedback management."
        )
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadFeedback();
  }, []);

  useEffect(() => {
    if (!requestedSubmissionId) return;

    setSelectedSubmissionId(requestedSubmissionId);
  }, [requestedSubmissionId]);

  useEffect(() => {
    if (!requestedTicketId || tickets.length === 0) {
      return;
    }

    const requestedTicket = tickets.find(
      (ticket) => ticket.id === requestedTicketId
    );

    if (!requestedTicket) {
      setMessage(
        "The assigned feedback ticket could not be found."
      );
      return;
    }

    if (!requestedTicket.source_submission_id) {
      setMessage(
        "This ticket is not linked to a feedback submission."
      );
      return;
    }

    setSelectedSubmissionId(
      requestedTicket.source_submission_id
    );
    setMessage(null);
  }, [requestedTicketId, tickets]);

  useEffect(() => {
    if (!selectedFeedback || selectedTicket) {
      return;
    }

    setTicketTitle(selectedFeedback.title);
    setTicketDescription(
      selectedFeedback.description
    );
    setClassification("");
    setPriority("medium");
    setSelectedAssigneeId("");
    setMessage(null);
  }, [selectedFeedback, selectedTicket]);

  function selectFeedback(submissionId: string) {
    setSelectedSubmissionId(submissionId);
    setMessage(null);

    router.replace(
      `/feedback/manage?submission=${encodeURIComponent(
        submissionId
      )}`
    );
  }

  async function createTicket(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!selectedFeedback) {
      setMessage(
        "Select a feedback submission first."
      );
      return;
    }

    if (!isAdmin) {
      setMessage(
        "Only an administrator may create feedback tickets."
      );
      return;
    }

    if (!ticketReady) {
      setMessage(
        "Add a ticket title and a sufficiently detailed description."
      );
      return;
    }

    setIsWorking(true);
    setMessage(null);

    try {
      const supabase =
        getSupabaseBrowserClient();

      const { error } = await supabase.rpc(
        "create_fc_feedback_ticket",
        {
          submission: selectedFeedback.id,
          ticket_title: ticketTitle.trim(),
          ticket_description:
            ticketDescription.trim(),
          ticket_priority: priority,
          classification_text:
            classification.trim() || null,
          assignee:
            selectedAssigneeId || null,
        }
      );

      if (error) throw error;

      setMessage(
        selectedAssigneeId
          ? "Feedback ticket created and assigned successfully."
          : "Feedback ticket created successfully."
      );

      await loadFeedback();
    } catch (error) {
      setMessage(
        getErrorMessage(
          error,
          "Unable to create the feedback ticket."
        )
      );
    } finally {
      setIsWorking(false);
    }
  }

  if (isLoading) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <p className="text-sm text-gray-600">
          Loading feedback...
        </p>
      </main>
    );
  }

  if (hasAccess === false) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <section className="rounded-2xl border border-red-200 bg-red-50 p-6">
          <h1 className="text-2xl font-semibold text-red-900">
            Access denied
          </h1>

          <p className="mt-2 text-sm leading-6 text-red-800">
            This page is available only to
            FieldsConnect administrators and active
            FC Team members.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Feedback review
          </h1>

          <p className="mt-2 text-sm text-gray-600">
            {feedbackItems.length}{" "}
            {feedbackItems.length === 1
              ? "submission"
              : "submissions"}
          </p>
        </div>

        {isAdmin && (
          <a
            className="rounded-xl border bg-white px-4 py-2 text-sm font-semibold text-gray-900 transition hover:bg-gray-50"
            href="/feedback/team"
          >
            Manage FC Team
          </a>
        )}
      </header>

      {message && (
        <p
          aria-live="polite"
          className="rounded-xl border bg-white p-4 text-sm text-gray-700"
        >
          {message}
        </p>
      )}

      {feedbackItems.length === 0 ? (
        <p className="rounded-2xl border border-dashed bg-white p-6 text-sm text-gray-600">
          No feedback has been submitted.
        </p>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
          <section className="overflow-hidden rounded-2xl border bg-white">
            <div className="border-b px-4 py-3">
              <h2 className="font-semibold">
                Feedback inbox
              </h2>
            </div>

            <div className="max-h-[75vh] overflow-y-auto">
              {feedbackItems.map((feedback) => {
                const isSelected =
                  feedback.id ===
                  selectedSubmissionId;

                const submittedBy =
                  profileById.get(
                    feedback.submitted_by
                  )?.display_name ??
                  "Unknown user";

                const ticket = tickets.find(
                  (item) =>
                    item.source_submission_id ===
                    feedback.id
                );

                return (
                  <button
                    className={[
                      "block w-full border-b px-4 py-4 text-left transition last:border-b-0",
                      isSelected
                        ? "bg-blue-50"
                        : "bg-white hover:bg-gray-50",
                    ].join(" ")}
                    key={feedback.id}
                    onClick={() =>
                      selectFeedback(feedback.id)
                    }
                    type="button"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="line-clamp-2 text-sm font-semibold text-gray-950">
                        {feedback.title}
                      </h3>

                      <span className="shrink-0 rounded-full border px-2 py-1 text-[11px] text-gray-600">
                        {ticket
                          ? formatLabel(ticket.status)
                          : formatLabel(
                              feedback.review_status
                            )}
                      </span>
                    </div>

                    <p className="mt-2 text-xs font-medium text-gray-700">
                      Submitted by {submittedBy}
                    </p>

                    <p className="mt-2 line-clamp-2 text-xs leading-5 text-gray-600">
                      {feedback.description}
                    </p>

                    {ticket?.ticket_number && (
                      <p className="mt-2 text-[11px] font-medium text-blue-700">
                        {ticket.ticket_number}
                      </p>
                    )}

                    <p className="mt-2 text-[11px] text-gray-500">
                      {new Date(
                        feedback.created_at
                      ).toLocaleString()}
                    </p>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="grid gap-5">
            {selectedFeedback ? (
              <>
                <article className="rounded-2xl border bg-white p-5 sm:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="text-xl font-semibold">
                        {selectedFeedback.title}
                      </h2>

                      <p className="mt-1 text-sm font-medium text-gray-700">
                        Submitted by{" "}
                        {profileById.get(
                          selectedFeedback.submitted_by
                        )?.display_name ??
                          "Unknown user"}
                      </p>

                      <p className="mt-1 text-xs text-gray-500">
                        Submitted{" "}
                        {new Date(
                          selectedFeedback.created_at
                        ).toLocaleString()}
                      </p>
                    </div>

                    <span className="rounded-full border px-3 py-1 text-xs font-medium">
                      {formatLabel(
                        selectedFeedback.review_status
                      )}
                    </span>
                  </div>

                  <p className="mt-5 whitespace-pre-wrap text-sm leading-6 text-gray-800">
                    {selectedFeedback.description}
                  </p>
                </article>

                {selectedTicket ? (
                  <>
                  <article className="rounded-2xl border bg-white p-5 sm:p-6">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-blue-700">
                          {selectedTicket.ticket_number ??
                            "FC feedback ticket"}
                        </p>

                        <h2 className="mt-1 text-xl font-semibold">
                          {selectedTicket.title}
                        </h2>
                      </div>

                      <span className="rounded-full border px-3 py-1 text-xs font-medium">
                        {formatLabel(
                          selectedTicket.status
                        )}
                      </span>
                    </div>

                    <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
                      <div>
                        <dt className="text-gray-500">
                          Priority
                        </dt>

                        <dd className="mt-1 font-medium">
                          {formatLabel(
                            selectedTicket.priority
                          )}
                        </dd>
                      </div>

                      <div>
                        <dt className="text-gray-500">
                          Assigned to
                        </dt>

                        <dd className="mt-1 font-medium">
                          {selectedTicket.assigned_to
                            ? profileById.get(
                                selectedTicket.assigned_to
                              )?.display_name ??
                              "Unknown FC Team member"
                            : "Unassigned"}
                        </dd>
                      </div>

                      {selectedTicket.internal_classification && (
                        <div className="sm:col-span-2">
                          <dt className="text-gray-500">
                            Internal classification
                          </dt>

                          <dd className="mt-1 font-medium">
                            {
                              selectedTicket.internal_classification
                            }
                          </dd>
                        </div>
                      )}
                    </dl>

                    <p className="mt-5 whitespace-pre-wrap text-sm leading-6 text-gray-800">
                      {selectedTicket.description}
                    </p>
                  </article>

                  <FeedbackTicketActions
                    ticket={selectedTicket}
                    profiles={profiles}
                    onUpdated={loadFeedback}
                  />
                  </>
                ) : isAdmin ? (
                  <form
                    className="grid gap-5 rounded-2xl border bg-white p-5 sm:p-6"
                    onSubmit={createTicket}
                  >
                    <div>
                      <h2 className="text-xl font-semibold">
                        Create internal ticket
                      </h2>

                      <p className="mt-1 text-sm text-gray-600">
                        Review and convert this feedback
                        into an actionable FC Team ticket.
                      </p>
                    </div>

                    <label className="grid gap-2 text-sm font-medium">
                      Ticket title

                      <input
                        className="rounded-xl border px-4 py-3 font-normal outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                        disabled={isWorking}
                        maxLength={160}
                        minLength={3}
                        onChange={(event) =>
                          setTicketTitle(
                            event.target.value
                          )
                        }
                        required
                        value={ticketTitle}
                      />
                    </label>

                    <label className="grid gap-2 text-sm font-medium">
                      Ticket description

                      <textarea
                        className="min-h-40 resize-y rounded-xl border px-4 py-3 font-normal leading-6 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                        disabled={isWorking}
                        maxLength={5000}
                        minLength={10}
                        onChange={(event) =>
                          setTicketDescription(
                            event.target.value
                          )
                        }
                        required
                        value={ticketDescription}
                      />
                    </label>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="grid gap-2 text-sm font-medium">
                        Priority

                        <select
                          className="rounded-xl border px-4 py-3 font-normal"
                          disabled={isWorking}
                          onChange={(event) =>
                            setPriority(
                              event.target.value
                            )
                          }
                          value={priority}
                        >
                          <option value="low">Low</option>
                          <option value="medium">
                            Medium
                          </option>
                          <option value="high">High</option>
                          <option value="urgent">
                            Urgent
                          </option>
                        </select>
                      </label>

                      <label className="grid gap-2 text-sm font-medium">
                        Assign to

                        <select
                          className="rounded-xl border px-4 py-3 font-normal"
                          disabled={isWorking}
                          onChange={(event) =>
                            setSelectedAssigneeId(
                              event.target.value
                            )
                          }
                          value={selectedAssigneeId}
                        >
                          <option value="">
                            Leave unassigned
                          </option>

                          {assignableMembers.map(
                            (member) => (
                              <option
                                key={member.user_id}
                                value={member.user_id}
                              >
                                {member.displayName}
                              </option>
                            )
                          )}
                        </select>
                      </label>
                    </div>

                    <label className="grid gap-2 text-sm font-medium">
                      Internal classification

                      <input
                        className="rounded-xl border px-4 py-3 font-normal outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                        disabled={isWorking}
                        maxLength={200}
                        onChange={(event) =>
                          setClassification(
                            event.target.value
                          )
                        }
                        placeholder="Optional internal grouping"
                        value={classification}
                      />
                    </label>

                    <button
                      className="min-h-11 w-full rounded-xl bg-gray-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50 sm:w-fit"
                      disabled={
                        isWorking || !ticketReady
                      }
                      type="submit"
                    >
                      {isWorking
                        ? "Creating ticket..."
                        : selectedAssigneeId
                          ? "Create and assign ticket"
                          : "Create ticket"}
                    </button>
                  </form>
                ) : (
                  <p className="rounded-2xl border border-dashed bg-white p-5 text-sm text-gray-600">
                    This feedback has not yet been
                    converted into a ticket. Only an
                    administrator may create and assign
                    FC Team tickets.
                  </p>
                )}
              </>
            ) : (
              <p className="rounded-2xl border border-dashed bg-white p-6 text-sm text-gray-600">
                Select a feedback submission to review it.
              </p>
            )}
          </section>
        </div>
      )}
    </main>
  );
}