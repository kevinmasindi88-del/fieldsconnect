"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

type PlatformRole = "user" | "moderator" | "senior_moderator" | "admin";

type Profile = {
  id: string;
  display_name: string;
};

type ReportTicket = {
  id: string;
  ticket_number: string | null;
  reporter_id: string;
  reported_user_id: string | null;
  target_type: string;
  target_id: string;
  reason: string;
  details: string | null;
  status: string;
  assigned_to: string | null;
  created_at: string;
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
  return "Unable to load moderation dashboard.";
}

export function ModerationDashboard() {
  const [role, setRole] = useState<PlatformRole>("user");
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [tickets, setTickets] = useState<ReportTicket[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const profileById = useMemo(
    () => new Map(profiles.map((profile) => [profile.id, profile])),
    [profiles]
  );

  const selectedTicket = tickets.find((ticket) => ticket.id === selectedTicketId) ?? null;
  const hasAccess = ["moderator", "senior_moderator", "admin"].includes(role);

  useEffect(() => {
    async function loadDashboard() {
      try {
        const supabase = getSupabaseBrowserClient();
        const roleResult = await supabase.rpc("current_platform_role");
        if (roleResult.error) throw roleResult.error;

        const currentRole = (roleResult.data ?? "user") as PlatformRole;
        setRole(currentRole);

        if (!["moderator", "senior_moderator", "admin"].includes(currentRole)) {
          setIsLoading(false);
          return;
        }

        const [profileResult, ticketResult] = await Promise.all([
          supabase.from("profiles").select("id, display_name").is("deleted_at", null),
          supabase
            .from("reports")
            .select(
              "id, ticket_number, reporter_id, reported_user_id, target_type, target_id, reason, details, status, assigned_to, created_at"
            )
            .order("created_at", { ascending: false }),
        ]);

        if (profileResult.error) throw profileResult.error;
        if (ticketResult.error) throw ticketResult.error;

        setProfiles((profileResult.data ?? []) as Profile[]);
        setTickets((ticketResult.data ?? []) as ReportTicket[]);
      } catch (error) {
        setMessage(getErrorMessage(error));
      } finally {
        setIsLoading(false);
      }
    }

    void loadDashboard();
  }, []);

  if (isLoading) {
    return <p className="p-8 text-sm text-gray-600">Loading moderation dashboard...</p>;
  }

  if (!hasAccess) {
    return (
      <section className="mx-auto max-w-3xl p-8">
        <h1 className="text-3xl font-semibold">Moderation dashboard</h1>
        <p className="mt-4 rounded-xl border p-4 text-sm text-gray-700">
          This dashboard is available only to active FieldsConnect moderators and administrators.
        </p>
      </section>
    );
  }

  return (
    <section className="mx-auto grid w-full max-w-7xl gap-6 p-8 lg:grid-cols-[360px_1fr]">
      <div className="space-y-4">
        <div>
          <p className="text-sm font-medium text-blue-700">Role: {role.replaceAll("_", " ")}</p>
          <h1 className="text-3xl font-semibold">Moderation dashboard</h1>
          <p className="mt-2 text-sm text-gray-600">Incoming reports and traceable moderation tickets.</p>
        </div>

        {message && <p className="rounded-xl border p-4 text-sm text-gray-700">{message}</p>}

        <div className="grid gap-3">
          {tickets.length === 0 ? (
            <p className="rounded-xl border border-dashed p-4 text-sm text-gray-600">No reports are currently visible.</p>
          ) : (
            tickets.map((ticket) => (
              <button
                key={ticket.id}
                className={`rounded-xl border p-4 text-left ${selectedTicketId === ticket.id ? "bg-gray-100" : "bg-white"}`}
                onClick={() => setSelectedTicketId(ticket.id)}
                type="button"
              >
                <p className="font-semibold">{ticket.ticket_number ?? "Legacy report"}</p>
                <p className="mt-1 text-sm text-gray-700">{ticket.target_type.replaceAll("_", " ")} · {ticket.reason}</p>
                <p className="mt-2 text-xs text-gray-500">{new Date(ticket.created_at).toLocaleString()}</p>
              </button>
            ))
          )}
        </div>
      </div>

      <div className="rounded-2xl border bg-white p-6">
        {!selectedTicket ? (
          <p className="text-sm text-gray-600">Select a ticket to review its details.</p>
        ) : (
          <div className="space-y-5">
            <div>
              <p className="text-sm font-medium text-blue-700">{selectedTicket.ticket_number ?? "Legacy report"}</p>
              <h2 className="mt-1 text-2xl font-semibold">{selectedTicket.reason}</h2>
              <p className="mt-2 text-sm text-gray-600">Status: {selectedTicket.status}</p>
            </div>

            <dl className="grid gap-4 text-sm md:grid-cols-2">
              <div>
                <dt className="font-medium">Target</dt>
                <dd className="mt-1 text-gray-700">{selectedTicket.target_type.replaceAll("_", " ")}</dd>
              </div>
              <div>
                <dt className="font-medium">Reported user</dt>
                <dd className="mt-1 text-gray-700">
                  {selectedTicket.reported_user_id
                    ? profileById.get(selectedTicket.reported_user_id)?.display_name ?? "Unknown profile"
                    : "Not recorded"}
                </dd>
              </div>
              <div>
                <dt className="font-medium">Reporter</dt>
                <dd className="mt-1 text-gray-700">
                  {profileById.get(selectedTicket.reporter_id)?.display_name ?? "Unknown profile"}
                </dd>
              </div>
              <div>
                <dt className="font-medium">Target ID</dt>
                <dd className="mt-1 break-all text-gray-700">{selectedTicket.target_id}</dd>
              </div>
            </dl>

            <div>
              <h3 className="font-medium">Reporter details</h3>
              <p className="mt-2 whitespace-pre-wrap rounded-xl bg-gray-50 p-4 text-sm text-gray-700">
                {selectedTicket.details || "No additional details supplied."}
              </p>
            </div>

            <p className="rounded-xl border border-dashed p-4 text-sm text-gray-600">
              Assignment, evidence preview, redaction, warnings and suspension actions will be connected in the next dashboard step.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
