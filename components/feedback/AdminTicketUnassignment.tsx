"use client";

import { useState } from "react";
import {
  getSupabaseBrowserClient,
} from "@/lib/supabase/browser";

type AdminTicketUnassignmentProps = {
  ticket: {
    id: string;
    status: string;
    assigned_to: string | null;
  };
  isAdmin: boolean;
  onUpdated: () => Promise<void>;
};

function getErrorMessage(
  error: unknown,
  fallback: string
) {
  if (error instanceof Error) return error.message;

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message?: unknown }).message ===
      "string"
  ) {
    return (error as { message: string }).message;
  }

  return fallback;
}

export function AdminTicketUnassignment({
  ticket,
  isAdmin,
  onUpdated,
}: AdminTicketUnassignmentProps) {
  const [reason, setReason] = useState("");
  const [message, setMessage] =
    useState<string | null>(null);

  const [isWorking, setIsWorking] = useState(false);

  const canUnassign =
    isAdmin &&
    ticket.assigned_to !== null &&
    !["resolved", "closed", "cancelled"].includes(
      ticket.status
    );

  if (!canUnassign) {
    return null;
  }

  async function unassignTicket(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const trimmedReason = reason.trim();

    if (trimmedReason.length < 3) {
      setMessage(
        "Provide a reason for unassigning the ticket."
      );
      return;
    }

    setIsWorking(true);
    setMessage(null);

    try {
      const supabase = getSupabaseBrowserClient();

      const { error } = await supabase.rpc(
        "unassign_fc_feedback_ticket",
        {
          ticket: ticket.id,
          unassignment_reason: trimmedReason,
        }
      );

      if (error) throw error;

      setReason("");
      setMessage(
        "The ticket has been returned to the unassigned queue."
      );

      await onUpdated();
    } catch (error) {
      setMessage(
        getErrorMessage(
          error,
          "Unable to unassign the feedback ticket."
        )
      );
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <form
      className="grid gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-5"
      onSubmit={unassignTicket}
    >
      <div>
        <h3 className="font-semibold text-amber-950">
          Unassign ticket
        </h3>

        <p className="mt-1 text-sm leading-6 text-amber-900">
          Return this unresolved ticket to the unassigned
          queue so it can be reassigned or released before an
          FC Team member leaves.
        </p>
      </div>

      <label className="grid gap-2 text-sm font-medium text-amber-950">
        Unassignment reason

        <textarea
          className="min-h-24 resize-y rounded-xl border border-amber-300 bg-white px-4 py-3 font-normal leading-6 outline-none focus:border-amber-600"
          disabled={isWorking}
          maxLength={2000}
          onChange={(event) =>
            setReason(event.target.value)
          }
          placeholder="Explain why this ticket is being unassigned."
          required
          value={reason}
        />
      </label>

      {message && (
        <p
          aria-live="polite"
          className="text-sm text-amber-950"
        >
          {message}
        </p>
      )}

      <button
        className="w-full rounded-xl border border-amber-500 bg-white px-4 py-2 text-sm font-semibold text-amber-950 transition hover:bg-amber-100 disabled:opacity-50 sm:w-fit"
        disabled={
          isWorking || reason.trim().length < 3
        }
        type="submit"
      >
        {isWorking
          ? "Unassigning ticket..."
          : "Unassign ticket"}
      </button>
    </form>
  );
}