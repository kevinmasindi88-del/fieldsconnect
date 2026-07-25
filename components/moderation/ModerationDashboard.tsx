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
  resolution_action: string | null;
  assigned_to: string | null;
  created_at: string;
};

type TicketFilter =
  | "all"
  | "open"
  | "reviewing"
  | "escalated"
  | "resolved";

type AccountSuspension = {
  id: string;
  user_id: string;
  report_id: string;
  duration_days: number;
  reason: string;
  starts_at: string;
  ends_at: string;
  revoked_at: string | null;
  revocation_reason: string | null;
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
  const [suspensions, setSuspensions] = useState<AccountSuspension[]>([]);
  const [ticketFilter, setTicketFilter] = useState<TicketFilter>("all");
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

  const ticketCounts = useMemo(() => {
    return {
      all: tickets.length,
      open: tickets.filter((ticket) => ticket.status === "open").length,
      reviewing: tickets.filter(
        (ticket) =>
          ticket.status === "reviewing" &&
          ticket.resolution_action !== "escalated"
      ).length,
      escalated: tickets.filter(
        (ticket) =>
          ticket.status === "reviewing" &&
          ticket.resolution_action === "escalated"
      ).length,
      resolved: tickets.filter((ticket) =>
        ["actioned", "dismissed"].includes(ticket.status)
      ).length,
    };
  }, [tickets]);

  const filteredTickets = useMemo(() => {
    switch (ticketFilter) {
      case "open":
        return tickets.filter((ticket) => ticket.status === "open");
      case "reviewing":
        return tickets.filter(
          (ticket) =>
            ticket.status === "reviewing" &&
            ticket.resolution_action !== "escalated"
        );
      case "escalated":
        return tickets.filter(
          (ticket) =>
            ticket.status === "reviewing" &&
            ticket.resolution_action === "escalated"
        );
      case "resolved":
        return tickets.filter((ticket) =>
          ["actioned", "dismissed"].includes(ticket.status)
        );
      default:
        return tickets;
    }
  }, [ticketFilter, tickets]);

  const activeSuspensionCount = suspensions.filter(
    (suspension) =>
      !suspension.revoked_at &&
      new Date(suspension.starts_at).getTime() <= Date.now() &&
      new Date(suspension.ends_at).getTime() > Date.now()
  ).length;

  const recentlyLiftedCount = suspensions.filter((suspension) => {
    if (!suspension.revoked_at) return false;

    const revokedAt = new Date(suspension.revoked_at).getTime();
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    return revokedAt >= sevenDaysAgo;
  }).length;

  const hasAccess = ["moderator", "senior_moderator", "admin"].includes(role);
  const canViewSuspensions = ["senior_moderator", "admin"].includes(role);

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
              "id, ticket_number, reporter_id, reported_user_id, target_type, target_id, reason, details, status, resolution_action, assigned_to, created_at"
            )
            .order("created_at", { ascending: false }),
        ];

        const [profileResult, ticketResult] = await Promise.all(requests);

        if (profileResult.error) throw profileResult.error;
        if (ticketResult.error) throw ticketResult.error;

        setProfiles((profileResult.data ?? []) as Profile[]);
        setTickets((ticketResult.data ?? []) as ReportTicket[]);

        if (["senior_moderator", "admin"].includes(currentRole)) {
          const suspensionResult = await supabase
            .from("account_suspensions")
            .select(
              "id, user_id, report_id, duration_days, reason, starts_at, ends_at, revoked_at, revocation_reason, created_at"
            )
            .order("created_at", { ascending: false });

          if (suspensionResult.error) throw suspensionResult.error;

          setSuspensions(
            (suspensionResult.data ?? []) as AccountSuspension[]
          );
        }

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

        <div className="grid grid-cols-2 gap-3">
          <SummaryCard
            label="Open"
            value={ticketCounts.open}
            active={ticketFilter === "open"}
            onClick={() => setTicketFilter("open")}
          />

          <SummaryCard
            label="Reviewing"
            value={ticketCounts.reviewing}
            active={ticketFilter === "reviewing"}
            onClick={() => setTicketFilter("reviewing")}
          />

          <SummaryCard
            label="Escalated"
            value={ticketCounts.escalated}
            active={ticketFilter === "escalated"}
            onClick={() => setTicketFilter("escalated")}
          />

          <SummaryCard
            label="Resolved"
            value={ticketCounts.resolved}
            active={ticketFilter === "resolved"}
            onClick={() => setTicketFilter("resolved")}
          />

          {canViewSuspensions && (
            <>
              <SummaryCard
                label="Active suspensions"
                value={activeSuspensionCount}
              />

              <SummaryCard
                label="Lifted in 7 days"
                value={recentlyLiftedCount}
              />
            </>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {(
            [
              ["all", "All"],
              ["open", "Open"],
              ["reviewing", "Reviewing"],
              ["escalated", "Escalated"],
              ["resolved", "Resolved"],
            ] as Array<[TicketFilter, string]>
          ).map(([value, label]) => (
            <button
              key={value}
              className={[
                "rounded-full border px-3 py-2 text-sm font-medium",
                ticketFilter === value
                  ? "bg-black text-white"
                  : "bg-white text-gray-700 hover:bg-gray-50",
              ].join(" ")}
              onClick={() => {
                setTicketFilter(value);
                setSelectedTicketId(null);
              }}
              type="button"
            >
              {label}
              <span className="ml-2 text-xs opacity-75">
                {ticketCounts[value]}
              </span>
            </button>
          ))}
        </div>

        <div className="grid max-h-[190px] gap-3 overflow-y-auto pr-2">
          {filteredTickets.length === 0 ? (
            <p className="rounded-xl border border-dashed p-4 text-sm text-gray-600">
              No tickets match this filter.
            </p>
          ) : (
            filteredTickets.map((ticket) => (
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

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <TicketBadge ticket={selectedTicket} />

                {selectedTicket.resolution_action && (
                  <span className="text-sm text-gray-600">
                    Action:{" "}
                    {selectedTicket.resolution_action.replaceAll("_", " ")}
                  </span>
                )}
              </div>
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

            <Link
              className="inline-flex w-fit rounded-lg bg-black px-4 py-2 text-sm font-medium text-white"
              href={`/moderation/review/${selectedTicket.id}`}
            >
              Open full review and evidence
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}

function SummaryCard({
  label,
  value,
  active = false,
  onClick,
}: {
  label: string;
  value: number;
  active?: boolean;
  onClick?: () => void;
}) {
  const className = [
    "rounded-xl border p-4 text-left",
    active ? "border-black bg-black text-white" : "bg-white",
    onClick ? "cursor-pointer hover:bg-gray-50" : "",
    active && onClick ? "hover:bg-black" : "",
  ].join(" ");

  const content = (
    <>
      <p className={active ? "text-xs text-gray-300" : "text-xs text-gray-500"}>
        {label}
      </p>

      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </>
  );

  if (!onClick) {
    return <div className={className}>{content}</div>;
  }

  return (
    <button className={className} onClick={onClick} type="button">
      {content}
    </button>
  );
}

function TicketBadge({ ticket }: { ticket: ReportTicket }) {
  const isEscalated =
    ticket.status === "reviewing" &&
    ticket.resolution_action === "escalated";

  const label = isEscalated
    ? "Escalated"
    : ticket.resolution_action === "suspended"
      ? "Suspended"
      : ticket.status.replaceAll("_", " ");

  const className = isEscalated
    ? "border-amber-300 bg-amber-50 text-amber-900"
    : ticket.resolution_action === "suspended"
      ? "border-red-300 bg-red-50 text-red-800"
      : ticket.status === "open"
        ? "border-blue-300 bg-blue-50 text-blue-800"
        : ticket.status === "reviewing"
          ? "border-purple-300 bg-purple-50 text-purple-800"
          : ticket.status === "dismissed"
            ? "border-gray-300 bg-gray-50 text-gray-700"
            : "border-green-300 bg-green-50 text-green-800";

  return (
    <span
      className={`rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${className}`}
    >
      {label}
    </span>
  );
}