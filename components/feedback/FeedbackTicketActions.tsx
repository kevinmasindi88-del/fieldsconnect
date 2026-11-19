"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getSupabaseBrowserClient,
  isSupabaseConfigured,
} from "@/lib/supabase/browser";

type FeedbackTicket = {
  id: string;
  ticket_number: string | null;
  status: string;
  assigned_to: string | null;
  resolution_summary: string | null;
  fc_news_required: boolean;
};

type TicketActivity = {
  id: string;
  performed_by: string;
  activity_type: string;
  notes: string | null;
  created_at: string;
};

type Profile = {
  id: string;
  display_name: string;
};

type FeedbackTicketActionsProps = {
  ticket: FeedbackTicket;
  profiles: Profile[];
  onUpdated: () => Promise<void> | void;
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

export function FeedbackTicketActions({
  ticket,
  profiles,
  onUpdated,
}: FeedbackTicketActionsProps) {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [activities, setActivities] = useState<TicketActivity[]>([]);

  const [status, setStatus] = useState(ticket.status);
  const [actionNotes, setActionNotes] = useState("");
  const [resolutionSummary, setResolutionSummary] = useState(
    ticket.resolution_summary ?? ""
  );
  const [fcNewsRequired, setFcNewsRequired] = useState(
    ticket.fc_news_required
  );

  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isWorking, setIsWorking] = useState(false);

  const profileById = useMemo(
    () => new Map(profiles.map((profile) => [profile.id, profile])),
    [profiles]
  );

  const canAction =
    isAdmin ||
    (currentUserId !== null && ticket.assigned_to === currentUserId);

  const isCompleted = ["closed", "cancelled"].includes(ticket.status);

  async function loadActivity() {
    if (!isSupabaseConfigured()) return;

    const supabase = getSupabaseBrowserClient();

    const { data, error } = await supabase
      .from("fc_feedback_ticket_activity")
      .select(
        "id, performed_by, activity_type, notes, created_at"
      )
      .eq("ticket_id", ticket.id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    setActivities((data ?? []) as TicketActivity[]);
  }

  useEffect(() => {
    async function loadAccessAndActivity() {
      if (!isSupabaseConfigured()) {
        setMessage("FieldsConnect feedback is currently unavailable.");
        setIsLoading(false);
        return;
      }

      try {
        const supabase = getSupabaseBrowserClient();

        const [sessionResult, roleResult] = await Promise.all([
          supabase.auth.getSession(),
          supabase.rpc("current_platform_role"),
        ]);

        if (sessionResult.error) throw sessionResult.error;
        if (roleResult.error) throw roleResult.error;

        setCurrentUserId(
          sessionResult.data.session?.user.id ?? null
        );

        setIsAdmin(roleResult.data === "admin");

        await loadActivity();
      } catch (error) {
        setMessage(
          getErrorMessage(
            error,
            "Unable to load ticket activity."
          )
        );
      } finally {
        setIsLoading(false);
      }
    }

    void loadAccessAndActivity();
  }, [ticket.id]);

  useEffect(() => {
    setStatus(ticket.status);
    setResolutionSummary(ticket.resolution_summary ?? "");
    setFcNewsRequired(ticket.fc_news_required);
    setActionNotes("");
  }, [
    ticket.id,
    ticket.status,
    ticket.resolution_summary,
    ticket.fc_news_required,
  ]);

  async function updateTicket(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!canAction) {
      setMessage(
        "This ticket is not assigned to you."
      );
      return;
    }

    if (
      status === "unassigned" &&
      actionNotes.trim().length < 3
    ) {
      setMessage(
        "Provide a reason for unassigning the ticket."
      );
      return;
    }

    if (
      status === "resolved" &&
      resolutionSummary.trim().length < 10
    ) {
      setMessage(
        "Add a resolution summary of at least 10 characters."
      );
      return;
    }

    setIsWorking(true);
    setMessage(null);

    try {
      const supabase = getSupabaseBrowserClient();

      if (status === "unassigned") {
        const { error } = await supabase.rpc(
          "unassign_fc_feedback_ticket",
          {
            ticket: ticket.id,
            unassignment_reason: actionNotes.trim(),
          }
        );

        if (error) throw error;
      } else {
        const { error } = await supabase.rpc(
          "update_fc_feedback_ticket",
          {
            ticket: ticket.id,
            new_status: status,
            action_notes: actionNotes.trim() || null,
            resolution_text:
              status === "resolved"
                ? resolutionSummary.trim()
                : null,
            publish_fc_news:
              status === "resolved"
                ? fcNewsRequired
                : false,
          }
        );

        if (error) throw error;
      }

      setActionNotes("");
      setMessage(
        status === "unassigned"
          ? "The ticket has been returned to the unassigned queue."
          : "Ticket updated successfully."
      );

      await loadActivity();
      await onUpdated();
    } catch (error) {
      setMessage(
        getErrorMessage(
          error,
          "Unable to update the feedback ticket."
        )
      );
    } finally {
      setIsWorking(false);
    }
  }

  if (isLoading) {
    return (
      <section className="rounded-2xl border bg-white p-4 text-sm text-gray-600 sm:p-5">
        Loading ticket actions...
      </section>
    );
  }

  return (
    <section className="grid gap-4 sm:gap-5">
      {canAction && !isCompleted ? (
        <form
          className="grid gap-4 rounded-2xl border bg-white p-4 sm:gap-5 sm:p-6"
          onSubmit={updateTicket}
        >
          <div>
            <h2 className="text-lg font-semibold sm:text-xl">
              Action ticket
            </h2>

            <p className="mt-1 text-sm text-gray-600">
              Update the work status and record progress or resolution.
            </p>
          </div>

          <label className="grid gap-2 text-sm font-medium">
            Status

            <select
              className="rounded-xl border px-4 py-3 font-normal"
              disabled={isWorking}
              onChange={(event) => setStatus(event.target.value)}
              value={status}
            >
              <option value="assigned">Assigned</option>
              <option value="in_progress">In progress</option>
              <option value="blocked">Blocked</option>
              <option value="resolved">Resolved</option>

              {isAdmin && (
                <>
                  {ticket.assigned_to && (
                    <option value="unassigned">
                      Unassigned
                    </option>
                  )}

                  <option value="closed">Closed</option>
                  <option value="cancelled">Cancelled</option>
                </>
              )}
            </select>
          </label>

          <label className="grid gap-2 text-sm font-medium">
            Action notes

            <textarea
              className="min-h-28 resize-y rounded-xl border px-4 py-3 font-normal leading-6 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              disabled={isWorking}
              maxLength={5000}
              onChange={(event) =>
                setActionNotes(event.target.value)
              }
              placeholder={
                status === "unassigned"
                  ? "Explain why this ticket is being unassigned."
                  : "Record progress, decisions, obstacles or actions taken."
              }
              value={actionNotes}
            />
          </label>

          {status === "resolved" && (
            <>
              <label className="grid gap-2 text-sm font-medium">
                Resolution summary

                <textarea
                  className="min-h-32 resize-y rounded-xl border px-4 py-3 font-normal leading-6 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                  disabled={isWorking}
                  maxLength={5000}
                  minLength={10}
                  onChange={(event) =>
                    setResolutionSummary(event.target.value)
                  }
                  placeholder="Describe what was implemented or how the matter was resolved."
                  required
                  value={resolutionSummary}
                />
              </label>

              <label className="flex items-start gap-3 rounded-xl border bg-gray-50 p-3 text-sm sm:p-4">
                <input
                  checked={fcNewsRequired}
                  className="mt-1"
                  disabled={isWorking}
                  onChange={(event) =>
                    setFcNewsRequired(event.target.checked)
                  }
                  type="checkbox"
                />

                <span>
                  <span className="block font-medium">
                    Recommend an FC News announcement
                  </span>

                  <span className="mt-1 block text-gray-600">
                    Flag this resolution for a possible community timeline update.
                  </span>
                </span>
              </label>
            </>
          )}

          <button
            className="min-h-11 w-full rounded-xl bg-gray-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50 sm:w-fit"
            disabled={
              isWorking ||
              (
                status === "unassigned" &&
                actionNotes.trim().length < 3
              )
            }
            type="submit"
          >
            {isWorking ? "Saving update..." : "Save ticket update"}
          </button>

          {message && (
            <p
              aria-live="polite"
              className="rounded-xl border bg-gray-50 p-3 text-sm text-gray-700 sm:p-4"
            >
              {message}
            </p>
          )}
        </form>
      ) : (
        <div className="rounded-2xl border border-dashed bg-white p-4 text-sm text-gray-600 sm:p-5">
          {isCompleted
            ? "This ticket has been completed."
            : ticket.assigned_to
              ? `This ticket is assigned to ${
                  profileById.get(ticket.assigned_to)?.display_name ??
                  "another FC Team member"
                }.`
              : "This ticket must be assigned before it can be actioned."}
        </div>
      )}

      <section className="rounded-2xl border bg-white p-4 sm:p-6">
        <div>
          <h2 className="text-lg font-semibold sm:text-xl">
            Ticket activity
          </h2>

          <p className="mt-1 text-sm text-gray-600">
            Recorded actions for{" "}
            {ticket.ticket_number ?? "this ticket"}.
          </p>
        </div>

        {activities.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed p-3 text-sm text-gray-600 sm:mt-5 sm:p-4">
            No ticket activity has been recorded.
          </p>
        ) : (
          <div className="mt-5 grid gap-3">
            {activities.map((activity) => (
              <article
                className="rounded-xl border bg-gray-50 p-3 sm:p-4"
                key={activity.id}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">
                      {formatLabel(activity.activity_type)}
                    </p>

                    <p className="mt-1 text-xs text-gray-500">
                      By{" "}
                      {profileById.get(activity.performed_by)
                        ?.display_name ?? "FC Team member"}
                    </p>
                  </div>

                  <time className="text-xs text-gray-500">
                    {new Date(activity.created_at).toLocaleString()}
                  </time>
                </div>

                {activity.notes && (
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-snug text-gray-700 sm:leading-6">
                    {activity.notes}
                  </p>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}