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
  consolidated_into_report_id: string | null;
  consolidated_at: string | null;
  consolidated_by: string | null;
  created_at: string;
};

type TicketFilter =
  | "all"
  | "my_queue"
  | "unassigned"
  | "open"
  | "reviewing"
  | "escalated"
  | "resolved";

type TicketSort = "priority" | "newest" | "oldest";

type ModerationActionLog = {
  id: string;
  report_id: string;
  action: string;
  notes: string;
  performed_by: string;
  performed_at: string;
  target_snapshot: Record<string, unknown> | null;
};

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
  const [actionLogs, setActionLogs] = useState<ModerationActionLog[]>([]);
  const [isLoadingActionHistory, setIsLoadingActionHistory] =
    useState(false);
  const [actionHistoryMessage, setActionHistoryMessage] =
    useState<string | null>(null);
  const [ticketFilter, setTicketFilter] = useState<TicketFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [ticketSort, setTicketSort] = useState<TicketSort>("priority");
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [selectedAssigneeId, setSelectedAssigneeId] = useState("");
  const [consolidationPrimaryId, setConsolidationPrimaryId] =
    useState("");
  const [consolidationNotes, setConsolidationNotes] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isWorking, setIsWorking] = useState(false);

  const profileById = useMemo(
    () => new Map(profiles.map((profile) => [profile.id, profile])),
    [profiles]
  );

  const selectedTicket =
    tickets.find((ticket) => ticket.id === selectedTicketId) ?? null;

  const selectedTicketSuspension =
    suspensions.find(
      (suspension) => suspension.report_id === selectedTicketId
    ) ?? null;

  const relatedTickets = useMemo(() => {
    if (!selectedTicket) return [];

    return tickets
      .filter(
        (ticket) =>
          ticket.id !== selectedTicket.id &&
          ticket.target_type === selectedTicket.target_type &&
          ticket.target_id === selectedTicket.target_id
      )
      .sort(
        (left, right) =>
          new Date(left.created_at).getTime() -
          new Date(right.created_at).getTime()
      );
  }, [selectedTicket, tickets]);

  const activeRelatedTickets = relatedTickets.filter(
    (ticket) =>
      !["actioned", "dismissed"].includes(ticket.status) &&
      ticket.consolidated_into_report_id === null
  );

  const canConsolidateTickets = [
    "senior_moderator",
    "admin",
  ].includes(role);

  const ticketCounts = useMemo(() => {
    return {
      all: tickets.length,
      my_queue: tickets.filter(
        (ticket) =>
          ticket.assigned_to === currentUserId &&
          !["actioned", "dismissed"].includes(ticket.status)
      ).length,
      unassigned: tickets.filter(
        (ticket) =>
          ticket.assigned_to === null &&
          !["actioned", "dismissed"].includes(ticket.status)
      ).length,
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
  }, [currentUserId, tickets]);

  const filteredTickets = useMemo(() => {
    switch (ticketFilter) {
      case "my_queue":
        return tickets.filter(
          (ticket) =>
            ticket.assigned_to === currentUserId &&
            !["actioned", "dismissed"].includes(ticket.status)
        );
      case "unassigned":
        return tickets.filter(
          (ticket) =>
            ticket.assigned_to === null &&
            !["actioned", "dismissed"].includes(ticket.status)
        );
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
  }, [currentUserId, ticketFilter, tickets]);

  const visibleTickets = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    const matchingTickets = normalizedQuery
      ? filteredTickets.filter((ticket) => {
          const reporterName =
            profileById.get(ticket.reporter_id)?.display_name ?? "";

          const reportedUserName = ticket.reported_user_id
            ? profileById.get(ticket.reported_user_id)?.display_name ?? ""
            : "";

          const assigneeName = ticket.assigned_to
            ? profileById.get(ticket.assigned_to)?.display_name ?? ""
            : "unassigned";

          const searchableText = [
            ticket.ticket_number ?? "",
            ticket.reason,
            ticket.details ?? "",
            ticket.target_type.replaceAll("_", " "),
            ticket.status,
            ticket.resolution_action ?? "",
            reporterName,
            reportedUserName,
            assigneeName,
          ]
            .join(" ")
            .toLowerCase();

          return searchableText.includes(normalizedQuery);
        })
      : [...filteredTickets];

    return matchingTickets.sort((left, right) => {
      const leftCreatedAt = new Date(left.created_at).getTime();
      const rightCreatedAt = new Date(right.created_at).getTime();

      if (ticketSort === "newest") {
        return rightCreatedAt - leftCreatedAt;
      }

      if (ticketSort === "oldest") {
        return leftCreatedAt - rightCreatedAt;
      }

      const getPriority = (ticket: ReportTicket) => {
        const isResolved = ["actioned", "dismissed"].includes(
          ticket.status
        );

        if (
          ticket.status === "reviewing" &&
          ticket.resolution_action === "escalated"
        ) {
          return 0;
        }

        if (!isResolved && ticket.assigned_to === null) {
          return 1;
        }

        if (!isResolved && ticket.assigned_to === currentUserId) {
          return 2;
        }

        if (!isResolved) {
          return 3;
        }

        return 4;
      };

      const priorityDifference =
        getPriority(left) - getPriority(right);

      return priorityDifference !== 0
        ? priorityDifference
        : rightCreatedAt - leftCreatedAt;
    });
  }, [
    currentUserId,
    filteredTickets,
    profileById,
    searchQuery,
    ticketSort,
  ]);

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
              "id, ticket_number, reporter_id, reported_user_id, target_type, target_id, reason, details, status, resolution_action, assigned_to, consolidated_into_report_id, consolidated_at, consolidated_by, created_at"
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

  useEffect(() => {
    if (!selectedTicketId) {
      setActionLogs([]);
      setActionHistoryMessage(null);
      setIsLoadingActionHistory(false);
      return;
    }

    let isCancelled = false;

    async function loadActionHistory() {
      setIsLoadingActionHistory(true);
      setActionHistoryMessage(null);

      try {
        const supabase = getSupabaseBrowserClient();

        const { data, error } = await supabase
          .from("moderation_action_log")
          .select(
            "id, report_id, action, notes, performed_by, performed_at, target_snapshot"
          )
          .eq("report_id", selectedTicketId)
          .order("performed_at", { ascending: true });

        if (error) throw error;
        if (isCancelled) return;

        setActionLogs((data ?? []) as ModerationActionLog[]);
      } catch (error) {
        if (isCancelled) return;

        setActionLogs([]);
        setActionHistoryMessage(getErrorMessage(error));
      } finally {
        if (!isCancelled) {
          setIsLoadingActionHistory(false);
        }
      }
    }

    void loadActionHistory();

    return () => {
      isCancelled = true;
    };
  }, [selectedTicketId]);

  async function consolidateSelectedTicket() {
    if (!selectedTicket) return;

    if (!consolidationPrimaryId) {
      setMessage("Select the primary moderation ticket.");
      return;
    }

    const notes = consolidationNotes.trim();

    if (notes.length < 5) {
      setMessage(
        "Provide a consolidation reason of at least 5 characters."
      );
      return;
    }

    const primaryTicket = tickets.find(
      (ticket) => ticket.id === consolidationPrimaryId
    );

    if (!primaryTicket) {
      setMessage("The selected primary ticket could not be found.");
      return;
    }

    setIsWorking(true);
    setMessage(null);

    try {
      const supabase = getSupabaseBrowserClient();

      const { error } = await supabase.rpc(
        "consolidate_moderation_ticket",
        {
          secondary_report_id: selectedTicket.id,
          primary_report_id: primaryTicket.id,
          consolidation_notes: notes,
        }
      );

      if (error) throw error;

      const consolidatedAt = new Date().toISOString();

      setTickets((currentTickets) =>
        currentTickets.map((ticket) =>
          ticket.id === selectedTicket.id
            ? {
                ...ticket,
                status: "dismissed",
                resolution_action: "consolidated",
                consolidated_into_report_id: primaryTicket.id,
                consolidated_at: consolidatedAt,
                consolidated_by: currentUserId,
              }
            : ticket
        )
      );

      setActionLogs((currentLogs) => [
        ...currentLogs,
        {
          id: `local-consolidation-${selectedTicket.id}`,
          report_id: selectedTicket.id,
          action: "consolidated",
          notes,
          performed_by: currentUserId ?? "",
          performed_at: consolidatedAt,
          target_snapshot: {
            primary_report_id: primaryTicket.id,
            primary_ticket_number: primaryTicket.ticket_number,
          },
        },
      ]);

      setConsolidationPrimaryId("");
      setConsolidationNotes("");
      setMessage(
        `Ticket consolidated into ${
          primaryTicket.ticket_number ?? "the primary case"
        }.`
      );
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setIsWorking(false);
    }
  }

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
            label="My queue"
            value={ticketCounts.my_queue}
            active={ticketFilter === "my_queue"}
            onClick={() => setTicketFilter("my_queue")}
          />

          <SummaryCard
            label="Unassigned"
            value={ticketCounts.unassigned}
            active={ticketFilter === "unassigned"}
            onClick={() => setTicketFilter("unassigned")}
          />

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
              ["my_queue", "My queue"],
              ["unassigned", "Unassigned"],
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

        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <label className="flex flex-col gap-1 text-sm font-medium">
            Search tickets
            <input
              className="rounded-lg border px-3 py-2 font-normal"
              onChange={(event) => {
                setSearchQuery(event.target.value);
                setSelectedTicketId(null);
              }}
              placeholder="Ticket, user, reason or target"
              type="search"
              value={searchQuery}
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium">
            Sort
            <select
              className="rounded-lg border px-3 py-2 font-normal"
              onChange={(event) =>
                setTicketSort(event.target.value as TicketSort)
              }
              value={ticketSort}
            >
              <option value="priority">Priority</option>
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
          </label>
        </div>

        <p className="text-xs text-gray-500">
          Showing {visibleTickets.length} of {filteredTickets.length} tickets
        </p>

        <div className="grid max-h-[190px] gap-3 overflow-y-auto pr-2">
          {visibleTickets.length === 0 ? (
            <p className="rounded-xl border border-dashed p-4 text-sm text-gray-600">
              No tickets match this filter.
            </p>
          ) : (
            visibleTickets.map((ticket) => (
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
                  setConsolidationPrimaryId("");
                  setConsolidationNotes("");
                  setMessage(null);
                  setActionHistoryMessage(null);
                }}
                type="button"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="font-semibold">
                    {ticket.ticket_number ?? "Legacy report"}
                  </p>

                  <AssignmentBadge
                    assignedTo={ticket.assigned_to}
                    currentUserId={currentUserId}
                    assigneeName={
                      ticket.assigned_to
                        ? profileById.get(ticket.assigned_to)?.display_name ??
                          "Moderation member"
                        : null
                    }
                  />
                </div>

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

            <section className="rounded-xl border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="font-semibold">Related reports</h3>

                  <p className="mt-1 text-sm text-gray-600">
                    Other reports concerning the same platform item.
                  </p>
                </div>

                <span className="text-xs text-gray-500">
                  {relatedTickets.length} related{" "}
                  {relatedTickets.length === 1 ? "report" : "reports"}
                </span>
              </div>

              {relatedTickets.length === 0 ? (
                <p className="mt-4 rounded-lg border border-dashed p-3 text-sm text-gray-600">
                  No other reports have been submitted for this target.
                </p>
              ) : (
                <div className="mt-4 space-y-3">
                  {relatedTickets.map((ticket) => {
                    const reporterName =
                      profileById.get(ticket.reporter_id)?.display_name ??
                      "Unknown reporter";

                    const isPrimaryForSelected =
                      selectedTicket.consolidated_into_report_id ===
                      ticket.id;

                    const isLinkedToSelected =
                      ticket.consolidated_into_report_id ===
                      selectedTicket.id;

                    return (
                      <div
                        key={ticket.id}
                        className="rounded-lg border bg-gray-50 p-4"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <Link
                              className="font-semibold text-blue-700 underline"
                              href={`/moderation/review/${ticket.id}`}
                            >
                              {ticket.ticket_number ?? "Legacy report"}
                            </Link>

                            <p className="mt-1 text-sm text-gray-700">
                              Reporter: {reporterName}
                            </p>
                          </div>

                          <TicketBadge ticket={ticket} />
                        </div>

                        <p className="mt-3 text-sm text-gray-700">
                          {ticket.reason}
                        </p>

                        <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-500">
                          <span>
                            {new Date(ticket.created_at).toLocaleString()}
                          </span>

                          {isPrimaryForSelected && (
                            <span className="font-semibold text-blue-700">
                              Primary case
                            </span>
                          )}

                          {isLinkedToSelected && (
                            <span className="font-semibold text-purple-700">
                              Consolidated into this case
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {canConsolidateTickets &&
                !["actioned", "dismissed"].includes(
                  selectedTicket.status
                ) &&
                activeRelatedTickets.length > 0 && (
                  <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4">
                    <h4 className="font-semibold text-amber-950">
                      Consolidate this ticket
                    </h4>

                    <p className="mt-1 text-sm text-amber-900">
                      Close this ticket as a linked secondary report while
                      preserving its reporter, details and audit history.
                    </p>

                    <label className="mt-4 flex flex-col gap-2 text-sm font-medium text-amber-950">
                      Primary moderation ticket
                      <select
                        className="rounded-lg border bg-white px-3 py-2 font-normal text-gray-900"
                        onChange={(event) =>
                          setConsolidationPrimaryId(event.target.value)
                        }
                        value={consolidationPrimaryId}
                      >
                        <option value="">Select primary ticket</option>

                        {activeRelatedTickets.map((ticket) => (
                          <option key={ticket.id} value={ticket.id}>
                            {ticket.ticket_number ?? "Legacy report"} —{" "}
                            {ticket.reason}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="mt-4 flex flex-col gap-2 text-sm font-medium text-amber-950">
                      Consolidation reason
                      <textarea
                        className="min-h-24 rounded-lg border bg-white px-3 py-2 font-normal text-gray-900"
                        onChange={(event) =>
                          setConsolidationNotes(event.target.value)
                        }
                        placeholder="Explain why these reports should be handled as one case."
                        value={consolidationNotes}
                      />
                    </label>

                    <button
                      className="mt-4 rounded-lg bg-amber-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                      disabled={
                        isWorking ||
                        !consolidationPrimaryId ||
                        consolidationNotes.trim().length < 5
                      }
                      onClick={consolidateSelectedTicket}
                      type="button"
                    >
                      {isWorking
                        ? "Consolidating..."
                        : "Consolidate into primary case"}
                    </button>
                  </div>
                )}
            </section>

            <section className="rounded-xl border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="font-semibold">Case history</h3>

                  <p className="mt-1 text-sm text-gray-600">
                    Chronological moderation actions recorded for this ticket.
                  </p>
                </div>

                {!isLoadingActionHistory && (
                  <span className="text-xs text-gray-500">
                    {actionLogs.length +
                      (selectedTicketSuspension?.revoked_at ? 1 : 0)}{" "}
                    recorded{" "}
                    {actionLogs.length +
                      (selectedTicketSuspension?.revoked_at ? 1 : 0) ===
                    1
                      ? "event"
                      : "events"}
                  </span>
                )}
              </div>

              {actionHistoryMessage && (
                <p className="mt-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">
                  {actionHistoryMessage}
                </p>
              )}

              {isLoadingActionHistory ? (
                <p className="mt-4 text-sm text-gray-600">
                  Loading case history...
                </p>
              ) : actionLogs.length === 0 &&
                !selectedTicketSuspension?.revoked_at ? (
                <p className="mt-4 rounded-lg border border-dashed p-3 text-sm text-gray-600">
                  No moderation actions have been recorded for this ticket yet.
                </p>
              ) : (
                <ol className="mt-4 space-y-3">
                  {actionLogs.map((log) => {
                    const performerName =
                      profileById.get(log.performed_by)?.display_name ??
                      "Moderation team member";

                    return (
                      <li
                        key={log.id}
                        className="rounded-lg border bg-gray-50 p-4"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <ActionBadge action={log.action} />

                            <p className="mt-2 text-sm font-medium text-gray-800">
                              {performerName}
                            </p>
                          </div>

                          <time className="text-xs text-gray-500">
                            {new Date(log.performed_at).toLocaleString()}
                          </time>
                        </div>

                        <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-gray-700">
                          {log.notes}
                        </p>
                      </li>
                    );
                  })}

                  {selectedTicketSuspension?.revoked_at && (
                    <li className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <ActionBadge action="suspension_revoked" />

                          <p className="mt-2 text-sm font-medium text-blue-950">
                            Senior moderation review
                          </p>
                        </div>

                        <time className="text-xs text-blue-700">
                          {new Date(
                            selectedTicketSuspension.revoked_at
                          ).toLocaleString()}
                        </time>
                      </div>

                      <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-blue-900">
                        {selectedTicketSuspension.revocation_reason ||
                          "The account suspension was lifted early."}
                      </p>
                    </li>
                  )}
                </ol>
              )}
            </section>

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

function ActionBadge({ action }: { action: string }) {
  const label =
    action === "suspension_revoked"
      ? "Suspension lifted"
      : action.replaceAll("_", " ");

  const className =
    action === "suspended"
      ? "border-red-300 bg-red-50 text-red-800"
      : action === "suspension_revoked"
        ? "border-blue-300 bg-blue-50 text-blue-800"
        : action === "escalated"
          ? "border-amber-300 bg-amber-50 text-amber-900"
          : action === "dismissed"
            ? "border-gray-300 bg-gray-100 text-gray-700"
            : action === "warned"
              ? "border-orange-300 bg-orange-50 text-orange-800"
              : action === "redacted"
                ? "border-purple-300 bg-purple-50 text-purple-800"
                : action === "removed"
                  ? "border-red-300 bg-red-50 text-red-800"
                  : "border-green-300 bg-green-50 text-green-800";

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${className}`}
    >
      {label}
    </span>
  );
}

function AssignmentBadge({
  assignedTo,
  currentUserId,
  assigneeName,
}: {
  assignedTo: string | null;
  currentUserId: string | null;
  assigneeName: string | null;
}) {
  if (!assignedTo) {
    return (
      <span className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-900">
        Unassigned
      </span>
    );
  }

  if (assignedTo === currentUserId) {
    return (
      <span className="rounded-full border border-blue-300 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-800">
        My ticket
      </span>
    );
  }

  return (
    <span
      className="max-w-40 truncate rounded-full border border-gray-300 bg-gray-50 px-2.5 py-1 text-xs font-semibold text-gray-700"
      title={`Assigned to ${assigneeName ?? "another moderator"}`}
    >
      {assigneeName
        ? `Assigned: ${assigneeName}`
        : "Assigned elsewhere"}
    </span>
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
      : ticket.resolution_action === "consolidated"
        ? "Consolidated"
        : ticket.status.replaceAll("_", " ");

  const className = isEscalated
    ? "border-amber-300 bg-amber-50 text-amber-900"
    : ticket.resolution_action === "suspended"
      ? "border-red-300 bg-red-50 text-red-800"
      : ticket.resolution_action === "consolidated"
        ? "border-purple-300 bg-purple-50 text-purple-800"
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