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

        setTicket(ticketResult.data as ReportTicket);
      } catch (error) {
        setMessage(getErrorMessage(error));
      } finally {
        setIsLoading(false);
      }
    }

    void loadReview();
  }, [ticketId]);

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
          <PostDetailWorkflow postId={ticket.target_id} />
        ) : (
          <p className="rounded-xl border border-dashed p-4 text-sm text-gray-600">
            Review support for {ticket.target_type.replaceAll("_", " ")} will
            be added next.
          </p>
        )}
      </div>
    </section>
  );
}