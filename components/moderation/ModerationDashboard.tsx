"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

type PlatformRole = "user" | "moderator" | "senior_moderator" | "admin";

type Profile = {
  id: string;
  display_name: string;
};

type ModerationMember = {
  user_id: string;
  role: PlatformRole;
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

  return "Unable to complete the moderation action.";
}

export function ModerationDashboard() {
  const [role, setRole] = useState<PlatformRole>("user");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [moderationMembers, setModerationMembers] = useState<ModerationMember[]>([]);
  const [tickets, setTickets] = useState<ReportTicket[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [selectedAssigneeId, setSelectedAssigneeId] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isWorking, setIsWorking] = useState(false);

  const profileById = useMemo(
    () => new Map(profiles.map((profile) => [profile.id, profile])),
    [profiles]
  );

  const selectedTicket =
    tickets.find((ticket) => ticket.id === selectedTicketId) ?? null;

  const hasAccess = ["moderator", "senior_moderator", "admin"].includes(role);

  const assignableMembers = useMemo(() => {
    return moderationMembers
      .filter((member) =>
        ["moderator", "senior_moderator", "admin"].includes(member.role)
      )
      .map((member) => ({
        ...member,
        displayName:
          profileById.get(member.user_id)?.display_name ?? "Unknown profile",
      }))
      .sort((left, right) =>
        left.displayName.localeCompare(right.displayName)
      );
  }, [moderationMembers, profileById]);

  useEffect(() => {
    async function loadDashboard() {
      try {
        const supabase = getSupabaseBrowserClient();

        const [{ data: userData, error: userError }, roleResult] =
          await Promise.all([
            supabase.auth.getUser(),
            supabase.rpc("current_platform_role"),
          ]);

        if (userError) throw userError;
        if (roleResult.error) throw roleResult.error;

        const userId = userData.user?.id ?? null;
        const currentRole = (roleResult.data ?? "user") as PlatformRole;

        setCurrentUserId(userId);
        setRole(currentRole);

        if (!["moderator", "senior_moderator", "admin"].includes(currentRole)) {
          return;
        }

        const requests = [
          supabase
            .from("profiles")
            .select("id, display_name")
            .is("deleted_at", null),
          supabase
            .from("reports")
            .select(
              "id, ticket_number, reporter_id, reported_user_id, target_type, target_id, reason, details, status, assigned_to, created_at"
            )
            .order("created_at", { ascending: false }),
        ];

        const [profileResult, ticketResult] = await Promise.all(requests);

        if (profileResult.error) throw profileResult.error;
        if (ticketResult.error) throw ticketResult.error;

        setProfiles((profileResult.data ?? []) as Profile[]);
        setTickets((ticketResult.data ?? []) as ReportTicket[]);

        if (currentRole === "admin") {
          const memberResult = await supabase
            .from("platform_roles")
            .select("user_id, role")
            .is("revoked_at", null);

          if (memberResult.error) throw memberResult.error;

          setModerationMembers(
            (memberResult.data ?? []) as ModerationMember[]
          );
        }
      } catch (error) {
        setMessage(getErrorMessage(error));
      } finally {
        setIsLoading(false);
      }
    }

    void loadDashboard();
  }, []);

  async function assignToMe(ticketId: string) {
    if (!currentUserId) return;

    setIsWorking(true);
    setMessage(null);

    try {
      const supabase = getSupabaseBrowserClient();

      const { error } = await supabase.rpc(
        "assign_moderation_ticket_to_me",
        {
          report_id: ticketId,
        }
      );

      if (error) throw error;

      setTickets((currentTickets) =>
        currentTickets.map((ticket) =>
          ticket.id === ticketId
            ? { ...ticket, assigned_to: currentUserId }
            : ticket
        )
      );

      setMessage("Ticket assigned to you.");
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setIsWorking(false);
    }
  }

  async function assignTicket(ticketId: string) {
    if (!selectedAssigneeId) {
      setMessage("Select a moderation team member first.");
      return;
    }

    setIsWorking(true);
    setMessage(null);

    try {
      const supabase = getSupabaseBrowserClient();

      const { error } = await supabase.rpc("assign_moderation_ticket", {
        report_id: ticketId,
        assignee_id: selectedAssigneeId,
      });

      if (error) throw error;

      setTickets((currentTickets) =>
        currentTickets.map((ticket) =>
          ticket.id === ticketId
            ? { ...ticket, assigned_to: selectedAssigneeId }
            : ticket
        )
      );

      setMessage("Ticket assignment updated.");
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setIsWorking(false);
    }
  }

  if (isLoading) {
    return (
      <p className="p-8 text-sm text-gray-600">
        Loading moderation dashboard...
      </p>
    );
  }

  if (!hasAccess) {
    return (
      <section className="mx-auto max-w-3xl p-8">
        <h1 className="text-3xl font-semibold">Moderation dashboard</h1>

        <p className="mt-4 rounded-xl border p-4 text-sm text-gray-700">
          This dashboard is available only to active FieldsConnect moderators
          and administrators.
        </p>
      </section>
    );
  }

  return (
    <section className="mx-auto grid w-full max-w-7xl gap-6 p-8 lg:grid-cols-[360px_1fr]">
      <div className="space-y-4">
        <div>
          <p className="text-sm font-medium text-blue-700">
            Role: {role.replaceAll("_", " ")}
          </p>

          <h1 className="text-3xl font-semibold">Moderation dashboard</h1>

          <p className="mt-2 text-sm text-gray-600">
            Incoming reports and traceable moderation tickets.
          </p>
        </div>

        {message && (
          <p className="rounded-xl border p-4 text-sm text-gray-700">
            {message}
          </p>
        )}

        <div className="grid gap-3">
          {tickets.length === 0 ? (
            <p className="rounded-xl border border-dashed p-4 text-sm text-gray-600">
              No reports are currently visible.
            </p>
          ) : (
            tickets.map((ticket) => (
              <button
                key={ticket.id}
                className={`rounded-xl border p-4 text-left ${
                  selectedTicketId === ticket.id
                    ? "bg-gray-100"
                    : "bg-white"
                }`}
                onClick={() => {
                  setSelectedTicketId(ticket.id);
                  setSelectedAssigneeId(ticket.assigned_to ?? "");
                  setMessage(null);
                }}
                type="button"
              >
                <p className="font-semibold">
                  {ticket.ticket_number ?? "Legacy report"}
                </p>

                <p className="mt-1 text-sm text-gray-700">
                  {ticket.target_type.replaceAll("_", " ")} · {ticket.reason}
                </p>

                <p className="mt-2 text-xs text-gray-500">
                  {new Date(ticket.created_at).toLocaleString()}
                </p>
              </button>
            ))
          )}
        </div>
      </div>

      <div className="rounded-2xl border bg-white p-6">
        {!selectedTicket ? (
          <p className="text-sm text-gray-600">
            Select a ticket to review its details.
          </p>
        ) : (
          <div className="space-y-5">
            <div>
              <Link
                className="text-sm font-medium text-blue-700 underline"
                href={`/moderation/review/${selectedTicket.id}`}
              >
                {selectedTicket.ticket_number ?? "Legacy report"}
              </Link>

              <h2 className="mt-1 text-2xl font-semibold">
                {selectedTicket.reason}
              </h2>

              <p className="mt-2 text-sm text-gray-600">
                Status: {selectedTicket.status}
              </p>
            </div>

            <dl className="grid gap-4 text-sm md:grid-cols-2">
              <div>
                <dt className="font-medium">Target</dt>
                <dd className="mt-1 text-gray-700">
                  {selectedTicket.target_type.replaceAll("_", " ")}
                </dd>
              </div>

              <div>
                <dt className="font-medium">Reported user</dt>
                <dd className="mt-1 text-gray-700">
                  {selectedTicket.reported_user_id
                    ? profileById.get(selectedTicket.reported_user_id)
                        ?.display_name ?? "Unknown profile"
                    : "Not recorded"}
                </dd>
              </div>

              <div>
                <dt className="font-medium">Reporter</dt>
                <dd className="mt-1 text-gray-700">
                  {profileById.get(selectedTicket.reporter_id)?.display_name ??
                    "Unknown profile"}
                </dd>
              </div>

              <div>
                <dt className="font-medium">Assigned to</dt>
                <dd className="mt-1 text-gray-700">
                  {selectedTicket.assigned_to
                    ? profileById.get(selectedTicket.assigned_to)
                        ?.display_name ?? "Unknown moderation member"
                    : "Unassigned"}
                </dd>
              </div>

              <div>
                <dt className="font-medium">Target ID</dt>
                <dd className="mt-1 break-all text-gray-700">
                  {selectedTicket.target_id}
                </dd>
              </div>
            </dl>

            {role === "admin" ? (
              <div className="flex flex-wrap items-end gap-3 rounded-xl border p-4">
                <label className="flex min-w-64 flex-col gap-2 text-sm font-medium">
                  Assign to
                  <select
                    className="rounded-lg border px-3 py-2"
                    value={selectedAssigneeId}
                    onChange={(event) =>
                      setSelectedAssigneeId(event.target.value)
                    }
                  >
                    <option value="">Select moderator or admin</option>

                    {assignableMembers.map((member) => (
                      <option key={member.user_id} value={member.user_id}>
                        {member.displayName} —{" "}
                        {member.role.replaceAll("_", " ")}
                      </option>
                    ))}
                  </select>
                </label>

                <button
                  className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                  disabled={isWorking || !selectedAssigneeId}
                  onClick={() => assignTicket(selectedTicket.id)}
                  type="button"
                >
                  {isWorking ? "Assigning..." : "Assign to"}
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <button
                  className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                  disabled={
                    isWorking ||
                    selectedTicket.assigned_to === currentUserId
                  }
                  onClick={() => assignToMe(selectedTicket.id)}
                  type="button"
                >
                  {selectedTicket.assigned_to === currentUserId
                    ? "Assigned to me"
                    : isWorking
                      ? "Assigning..."
                      : "Assign to me"}
                </button>
              </div>
            )}

            <div>
              <h3 className="font-medium">Reporter details</h3>

              <p className="mt-2 whitespace-pre-wrap rounded-xl bg-gray-50 p-4 text-sm text-gray-700">
                {selectedTicket.details ||
                  "No additional details supplied."}
              </p>
            </div>

            <p className="rounded-xl border border-dashed p-4 text-sm text-gray-600">
              Evidence preview, redaction, warnings and suspension actions will
              be connected in the next dashboard step.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}