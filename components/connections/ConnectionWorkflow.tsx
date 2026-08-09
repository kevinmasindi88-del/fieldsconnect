"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/browser";
import { ProfileAvatar } from "@/components/profile/ProfileAvatar";
import {
  getActionErrorMessage,
  getMessageAlertClass,
} from "@/lib/action-errors";

type Profile = {
  id: string;
  display_name: string;
  username: string | null;
  role_type: string;
  field: string | null;
  bio: string | null;
  mentor_available: boolean;
  avatar_url: string | null;
};

type Connection = {
  id: string;
  requester_id: string;
  recipient_id: string;
  status: "pending" | "accepted" | "declined" | "cancelled";
  created_at: string;
};

type MentorshipRequest = {
  id: string;
  mentee_id: string;
  mentor_id: string;
  mentorship_field: string;
  objective: string;
  motivation: string;
  requested_duration:
    | "3_months"
    | "6_months"
    | "1_year"
    | "ongoing";
  requested_frequency:
    | "weekly"
    | "fortnightly"
    | "monthly"
    | "flexible";
  proposed_duration:
    | "3_months"
    | "6_months"
    | "1_year"
    | "ongoing"
    | null;
  proposed_frequency:
    | "weekly"
    | "fortnightly"
    | "monthly"
    | "flexible"
    | null;
  proposal_message: string | null;
  status:
    | "pending"
    | "change_proposed"
    | "accepted"
    | "declined"
    | "cancelled"
    | "expired";
  requested_at: string;
  expires_at: string | null;
};

type Mentorship = {
  id: string;
  request_id: string;
  mentor_id: string;
  mentee_id: string;
  mentorship_field: string;
  agreed_duration:
    | "3_months"
    | "6_months"
    | "1_year"
    | "ongoing";
  agreed_frequency:
    | "weekly"
    | "fortnightly"
    | "monthly"
    | "flexible";
  objective: string;
  status:
    | "active"
    | "paused"
    | "completion_requested"
    | "completed"
    | "cancelled"
    | "ended_early";
  start_date: string;
  expected_end_date: string | null;
  created_at: string;
  updated_at: string;
};

type Skill = {
  profile_id: string;
  name: string;
};

export function ConnectionWorkflow() {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [mentorshipRequests, setMentorshipRequests] =
    useState<MentorshipRequest[]>([]);
  const [mentorships, setMentorships] =
    useState<Mentorship[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [mentorFilter, setMentorFilter] = useState("all");
  const [skills, setSkills] = useState<Skill[]>([]);
  const [connectionSearch, setConnectionSearch] = useState("");
  const [connectionSort, setConnectionSort] =
    useState<"newest" | "oldest">("newest");
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isWorking, setIsWorking] = useState(false);
  const [counterproposalRequestId, setCounterproposalRequestId] =
    useState<string | null>(null);
  const [counterproposalDuration, setCounterproposalDuration] =
    useState<"3_months" | "6_months" | "1_year" | "ongoing">(
      "6_months"
    );
  const [counterproposalFrequency, setCounterproposalFrequency] =
    useState<"weekly" | "fortnightly" | "monthly" | "flexible">(
      "monthly"
    );
  const [counterproposalMessage, setCounterproposalMessage] =
    useState("");

  const profileById = useMemo(() => {
    return new Map(profiles.map((profile) => [profile.id, profile]));
  }, [profiles]);

  const skillsByProfileId = useMemo(() => {
    const skillMap = new Map<string, string[]>();

    skills.forEach((skill) => {
      const profileSkills = skillMap.get(skill.profile_id) ?? [];
      profileSkills.push(skill.name);
      skillMap.set(skill.profile_id, profileSkills);
    });

    return skillMap;
  }, [skills]);

  const discoverableProfiles = useMemo(() => {
    return profiles.filter((profile) => {
      if (!currentUserId || profile.id === currentUserId) return false;

      return !connections.some(
        (connection) =>
          (connection.status === "pending" || connection.status === "accepted") &&
          ((connection.requester_id === currentUserId && connection.recipient_id === profile.id) ||
            (connection.requester_id === profile.id && connection.recipient_id === currentUserId))
      );
    });
  }, [profiles, connections, currentUserId]);

  const filteredDiscoverableProfiles = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return discoverableProfiles.filter((profile) => {
      const matchesSearch =
        !normalizedSearch ||
        [profile.display_name, profile.username, profile.field, profile.role_type]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(normalizedSearch));

      const matchesRole =
        roleFilter === "all" || profile.role_type.trim().toLowerCase() === roleFilter;
      const matchesMentor =
        mentorFilter === "all" ||
        (mentorFilter === "mentors" && profile.mentor_available) ||
        (mentorFilter === "non-mentors" && !profile.mentor_available);

      return matchesSearch && matchesRole && matchesMentor;
    });
  }, [discoverableProfiles, searchTerm, roleFilter, mentorFilter]);

  const participantMentorships = mentorships.filter(
    (mentorship) =>
      mentorship.mentor_id === currentUserId ||
      mentorship.mentee_id === currentUserId
  );

  const activeMentorships = participantMentorships.filter(
    (mentorship) =>
      [
        "active",
        "ending",
        "extension_pending",
        "paused",
        "completion_requested",
      ].includes(mentorship.status)
  );

  const historicalMentorships = participantMentorships.filter(
    (mentorship) =>
      [
        "completed",
        "cancelled",
        "ended_early",
      ].includes(mentorship.status)
  );

  const incomingMentorshipRequests =
    mentorshipRequests.filter(
      (request) =>
        request.mentor_id === currentUserId &&
        request.status === "pending"
    );

  const outgoingMentorshipRequests =
    mentorshipRequests.filter(
      (request) =>
        request.mentee_id === currentUserId &&
        (
          request.status === "pending" ||
          request.status === "change_proposed"
        )
    );

  const incomingRequests = connections.filter(
    (connection) => connection.recipient_id === currentUserId && connection.status === "pending"
  );

  const outgoingRequests = connections.filter(
    (connection) => connection.requester_id === currentUserId && connection.status === "pending"
  );

  const acceptedConnections = connections.filter(
    (connection) =>
      connection.status === "accepted" &&
      (connection.requester_id === currentUserId ||
        connection.recipient_id === currentUserId)
  );

  const visibleAcceptedConnections = useMemo(() => {
    const normalizedSearch = connectionSearch.trim().toLowerCase();

    return acceptedConnections
      .filter((connection) => {
        const otherProfileId =
          connection.requester_id === currentUserId
            ? connection.recipient_id
            : connection.requester_id;

        const profile = profileById.get(otherProfileId);
        const profileSkills =
          skillsByProfileId.get(otherProfileId) ?? [];

        if (!normalizedSearch) return true;

        return [
          profile?.display_name,
          profile?.username,
          profile?.field,
          ...profileSkills,
        ]
          .filter((value): value is string => Boolean(value))
          .some((value) =>
            value.toLowerCase().includes(normalizedSearch)
          );
      })
      .sort((left, right) => {
        const leftDate = new Date(left.created_at).getTime();
        const rightDate = new Date(right.created_at).getTime();

        return connectionSort === "newest"
          ? rightDate - leftDate
          : leftDate - rightDate;
      });
  }, [
    acceptedConnections,
    connectionSearch,
    connectionSort,
    currentUserId,
    profileById,
    skillsByProfileId,
  ]);

  async function loadConnections(userId: string) {
    if (!isSupabaseConfigured()) return;

    const supabase = getSupabaseBrowserClient();

    const { data, error } = await supabase
      .from("connections")
      .select("id, requester_id, recipient_id, status, created_at")
      .or(`requester_id.eq.${userId},recipient_id.eq.${userId}`)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Unable to refresh connections:", error);
      return;
    }

    setConnections((data ?? []) as Connection[]);
  }

  async function loadMentorships(userId: string) {
    if (!isSupabaseConfigured()) return;

    const supabase = getSupabaseBrowserClient();

    const { data, error } = await supabase
      .from("mentorships")
      .select(
        "id, request_id, mentor_id, mentee_id, mentorship_field, agreed_duration, agreed_frequency, objective, status, start_date, expected_end_date, created_at, updated_at"
      )
      .or(`mentor_id.eq.${userId},mentee_id.eq.${userId}`)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(
        "Unable to refresh mentorships:",
        error
      );
      return;
    }

    setMentorships((data ?? []) as Mentorship[]);
  }

  async function loadMentorshipRequests(userId: string) {
    if (!isSupabaseConfigured()) return;

    const supabase = getSupabaseBrowserClient();

    const { data, error } = await supabase
      .from("mentorship_requests")
      .select(
        "id, mentee_id, mentor_id, mentorship_field, objective, motivation, requested_duration, requested_frequency, proposed_duration, proposed_frequency, proposal_message, status, requested_at, expires_at"
      )
      .or(`mentee_id.eq.${userId},mentor_id.eq.${userId}`)
      .order("requested_at", { ascending: false });

    if (error) {
      console.error(
        "Unable to refresh mentorship requests:",
        error
      );
      return;
    }

    setMentorshipRequests(
      (data ?? []) as MentorshipRequest[]
    );
  }

  async function loadData() {
    setMessage(null);

    if (!isSupabaseConfigured()) {
      setMessage("Supabase is not configured yet. Connection workflow will work once environment variables are set.");
      setIsLoading(false);
      return;
    }

    try {
      const supabase = getSupabaseBrowserClient();
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

      if (sessionError) throw sessionError;

      const userId = sessionData.session?.user.id;

      if (!userId) {
        setMessage("Please log in before managing connections.");
        setIsLoading(false);
        return;
      }

      setCurrentUserId(userId);

      const [
        { data: profilesData, error: profilesError },
        { data: connectionsData, error: connectionsError },
        {
          data: mentorshipRequestData,
          error: mentorshipRequestError,
        },
        {
          data: mentorshipData,
          error: mentorshipError,
        },
        { data: skillsData, error: skillsError },
      ] = await Promise.all([
        supabase
          .from("profiles")
          .select(
            "id, display_name, username, role_type, field, bio, mentor_available, avatar_url"
          )
          .is("deleted_at", null)
          .order("display_name", { ascending: true }),
        supabase
          .from("connections")
          .select(
            "id, requester_id, recipient_id, status, created_at"
          )
          .or(
            `requester_id.eq.${userId},recipient_id.eq.${userId}`
          )
          .order("created_at", { ascending: false }),
        supabase
          .from("mentorship_requests")
          .select(
            "id, mentee_id, mentor_id, mentorship_field, objective, motivation, requested_duration, requested_frequency, proposed_duration, proposed_frequency, proposal_message, status, requested_at, expires_at"
          )
          .or(
            `mentee_id.eq.${userId},mentor_id.eq.${userId}`
          )
          .order("requested_at", {
            ascending: false,
          }),
        supabase
          .from("mentorships")
          .select(
            "id, request_id, mentor_id, mentee_id, mentorship_field, agreed_duration, agreed_frequency, objective, status, start_date, expected_end_date, created_at, updated_at"
          )
          .or(
            `mentor_id.eq.${userId},mentee_id.eq.${userId}`
          )
          .order("created_at", {
            ascending: false,
          }),
        supabase
          .from("skills")
          .select("profile_id, name")
          .eq("is_published", true)
          .is("deleted_at", null),
      ]);

      if (profilesError) throw profilesError;
      if (connectionsError) throw connectionsError;
      if (mentorshipRequestError) {
        throw mentorshipRequestError;
      }
      if (mentorshipError) {
        throw mentorshipError;
      }
      if (skillsError) throw skillsError;

      setProfiles((profilesData ?? []) as Profile[]);
      setConnections((connectionsData ?? []) as Connection[]);
      setMentorshipRequests(
        (mentorshipRequestData ?? []) as MentorshipRequest[]
      );
      setMentorships(
        (mentorshipData ?? []) as Mentorship[]
      );
      setSkills((skillsData ?? []) as Skill[]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load connection data.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    if (!currentUserId || !isSupabaseConfigured()) return;

    const supabase = getSupabaseBrowserClient();

    const channel = supabase
      .channel(`connections-live:${currentUserId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "connections",
        },
        () => {
          void loadConnections(currentUserId);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "mentorship_requests",
        },
        () => {
          void loadMentorshipRequests(currentUserId);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "mentorships",
        },
        () => {
          void loadMentorships(currentUserId);
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [currentUserId]);

  async function respondToMentorshipRequest(
    requestId: string,
    action: "accept" | "decline" | "counterpropose"
  ) {
    if (!isSupabaseConfigured()) return;

    const normalizedCounterproposalMessage =
      counterproposalMessage.trim();

    if (
      action === "counterpropose" &&
      normalizedCounterproposalMessage.length === 0
    ) {
      setMessage("Add a short message explaining the proposed changes.");
      return;
    }

    setIsWorking(true);
    setMessage(null);

    try {
      const supabase = getSupabaseBrowserClient();

      const { error } = await supabase.rpc(
        "respond_to_mentorship_request",
        {
          target_request_id: requestId,
          response_action: action,
          counterproposal_duration:
            action === "counterpropose"
              ? counterproposalDuration
              : null,
          counterproposal_frequency:
            action === "counterpropose"
              ? counterproposalFrequency
              : null,
          response_message:
            action === "counterpropose"
              ? normalizedCounterproposalMessage
              : null,
        }
      );

      if (error) throw error;

      setMessage(
        action === "accept"
          ? "Mentorship request accepted."
          : action === "decline"
            ? "Mentorship request declined."
            : "Mentorship counterproposal sent."
      );

      if (action === "counterpropose") {
        setCounterproposalRequestId(null);
        setCounterproposalDuration("6_months");
        setCounterproposalFrequency("monthly");
        setCounterproposalMessage("");
      }

      if (currentUserId) {
        await Promise.all([
          loadMentorshipRequests(currentUserId),
          loadMentorships(currentUserId),
        ]);
      }
    } catch (error) {
      setMessage(
        getActionErrorMessage(
          error,
          `${action} mentorship request`
        )
      );
    } finally {
      setIsWorking(false);
    }
  }

  async function sendRequest(profileId: string) {
    if (!currentUserId || !isSupabaseConfigured()) return;

    setIsWorking(true);
    setMessage(null);

    try {
      const supabase = getSupabaseBrowserClient();

      const existingConnection = connections.find(
        (connection) =>
          (connection.requester_id === currentUserId && connection.recipient_id === profileId) ||
          (connection.requester_id === profileId && connection.recipient_id === currentUserId)
      );

      let connectionId: string;

      if (
        existingConnection &&
        (existingConnection.status === "cancelled" || existingConnection.status === "declined")
      ) {
        const { data: connection, error } = await supabase
          .from("connections")
          .update({
            requester_id: currentUserId,
            recipient_id: profileId,
            status: "pending",
            responded_at: null,
            created_at: new Date().toISOString(),
          })
          .eq("id", existingConnection.id)
          .select("id")
          .single();

        if (error) throw error;
        connectionId = connection.id;
      } else {
        const { data: connection, error } = await supabase
          .from("connections")
          .insert({
            requester_id: currentUserId,
            recipient_id: profileId,
            status: "pending",
          })
          .select("id")
          .single();

        if (error) throw error;
        connectionId = connection.id;
      }

      const actor = profileById.get(currentUserId);

      const { error: notificationError } = await supabase.from("notifications").insert({
        recipient_id: profileId,
        actor_id: currentUserId,
        notification_type: "connection_request",
        entity_type: "connection",
        entity_id: connectionId,
        title: "New connection request",
        body: `${actor?.display_name ?? "Someone"} sent you a connection request.`,
      });

      if (notificationError) {
        console.error("Unable to create connection request notification:", notificationError);
      }

      setMessage("Connection request sent.");
      await loadData();
    } catch (error) {
      setMessage(getActionErrorMessage(error, "send connection request"));
    } finally {
      setIsWorking(false);
    }
  }

  async function updateRequest(connectionId: string, status: "accepted" | "declined") {
    setIsWorking(true);
    setMessage(null);

    try {
      const supabase = getSupabaseBrowserClient();
      const connection = connections.find((item) => item.id === connectionId);

      const { error } = await supabase
        .from("connections")
        .update({
          status,
          responded_at: new Date().toISOString(),
        })
        .eq("id", connectionId);

      if (error) throw error;

      if (status === "accepted" && connection && currentUserId) {
        const actor = profileById.get(currentUserId);

        const { error: notificationError } = await supabase.from("notifications").insert({
          recipient_id: connection.requester_id,
          actor_id: currentUserId,
          notification_type: "connection_accepted",
          entity_type: "connection",
          entity_id: connection.id,
          title: "Connection request accepted",
          body: `${actor?.display_name ?? "Someone"} accepted your connection request.`,
        });

        if (notificationError) {
          console.error("Unable to create connection accepted notification:", notificationError);
        }
      }

      setMessage(status === "accepted" ? "Connection accepted." : "Connection declined.");
      await loadData();
    } catch (error) {
      setMessage(getActionErrorMessage(error, "update connection request"));
    } finally {
      setIsWorking(false);
    }
  }

  async function disconnectConnection(connectionId: string) {
    const confirmed = window.confirm(
      "Disconnect from this person? Your previous conversation history will be preserved."
    );

    if (!confirmed || !isSupabaseConfigured()) return;

    setIsWorking(true);
    setMessage(null);

    try {
      const supabase = getSupabaseBrowserClient();

      const { error } = await supabase
        .from("connections")
        .update({
          status: "cancelled",
          responded_at: new Date().toISOString(),
        })
        .eq("id", connectionId);

      if (error) throw error;

      setMessage("Connection removed.");
      await loadData();
    } catch (error) {
      setMessage(getActionErrorMessage(error, "remove connection"));
    } finally {
      setIsWorking(false);
    }
  }

  function getOtherProfile(connection: Connection) {
    const otherId = connection.requester_id === currentUserId ? connection.recipient_id : connection.requester_id;
    return profileById.get(otherId);
  }

  function renderMentorshipCard(
    mentorship: Mentorship
  ) {
    const isMentor =
      mentorship.mentor_id === currentUserId;

    const otherProfileId = isMentor
      ? mentorship.mentee_id
      : mentorship.mentor_id;

    const otherProfile =
      profileById.get(otherProfileId);

    const isHistorical =
      mentorship.status === "completed" ||
      mentorship.status === "cancelled" ||
      mentorship.status === "ended_early";

    return (
      <article
        key={mentorship.id}
        className="flex flex-col gap-3 rounded-xl border bg-white p-3 sm:gap-4 sm:p-4"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <ProfileAvatar
              avatarPath={otherProfile?.avatar_url}
              displayName={otherProfile?.display_name}
              size={40}
            />

            <div className="min-w-0">
              <Link
                className="font-semibold hover:underline"
                href={`/profile/${otherProfileId}`}
              >
                {otherProfile?.display_name ??
                  "Unknown profile"}
              </Link>

              <p className="mt-1 text-sm text-gray-600">
                {mentorship.mentorship_field}
              </p>

              <p className="mt-1 text-xs font-medium text-gray-500">
                You are the{" "}
                {isMentor ? "mentor" : "mentee"}
              </p>
            </div>
          </div>

          <span className="shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-medium capitalize sm:px-3 sm:text-xs">
            {mentorship.status.replace("_", " ")}
          </span>
        </div>

        <div className="rounded-lg bg-gray-50 px-3 py-2 sm:bg-transparent sm:px-0 sm:py-0">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 sm:text-sm sm:normal-case sm:tracking-normal sm:text-gray-950">
            Objective
          </h3>

          <p className="mt-1 whitespace-pre-wrap text-sm leading-snug text-gray-700">
            {mentorship.objective}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs sm:flex sm:flex-wrap">
          <span className="min-w-0 rounded-lg border px-2.5 py-2 text-center sm:rounded-full sm:px-3 sm:py-1">
            {formatMentorshipDuration(
              mentorship.agreed_duration
            )}
          </span>

          <span className="min-w-0 rounded-lg border px-2.5 py-2 text-center sm:rounded-full sm:px-3 sm:py-1">
            {formatMentorshipFrequency(
              mentorship.agreed_frequency
            )}
          </span>

          <span className="min-w-0 rounded-lg border px-2.5 py-2 text-center sm:rounded-full sm:px-3 sm:py-1">
            Started{" "}
            {formatMentorshipDate(
              mentorship.start_date
            )}
          </span>

          <span className="min-w-0 rounded-lg border px-2.5 py-2 text-center sm:rounded-full sm:px-3 sm:py-1">
            {mentorship.expected_end_date
              ? `Expected end ${formatMentorshipDate(
                  mentorship.expected_end_date
                )}`
              : "Ongoing"}
          </span>
        </div>

        <Link
          className="inline-flex min-h-10 w-full items-center justify-center rounded-xl bg-gray-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800 sm:w-fit"
          href={`/mentorships/${mentorship.id}`}
        >
          {isHistorical
            ? "View mentorship"
            : "Open mentorship"}
        </Link>
      </article>
    );
  }

  function clearSearchFilters() {
    setSearchTerm("");
    setRoleFilter("all");
    setMentorFilter("all");
  }

  const hasActiveSearch = searchTerm.trim() || roleFilter !== "all" || mentorFilter !== "all";

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:gap-8 sm:px-6 sm:py-8">
      {message && <p className={getMessageAlertClass(message)}>{message}</p>}

      {isLoading ? (
        <p className="text-sm text-gray-600">Loading connections...</p>
      ) : (
        <>
          <ConnectionSection
            title={`Active mentorships · ${activeMentorships.length}`}
          >
            {activeMentorships.length === 0 ? (
              <EmptyState text="No active mentorships yet." />
            ) : (
              activeMentorships.map(
                renderMentorshipCard
              )
            )}
          </ConnectionSection>

          <ConnectionSection
            title={`Mentorship history · ${historicalMentorships.length}`}
          >
            {historicalMentorships.length === 0 ? (
              <EmptyState text="No completed or closed mentorships yet." />
            ) : (
              historicalMentorships.map(
                renderMentorshipCard
              )
            )}
          </ConnectionSection>
          <ConnectionSection title="Mentorship requests">
            {incomingMentorshipRequests.length === 0 ? (
              <EmptyState text="No incoming mentorship requests yet." />
            ) : (
              incomingMentorshipRequests.map((request) => {
                const mentee =
                  profileById.get(request.mentee_id);

                return (
                  <article
                    key={request.id}
                    className="flex flex-col gap-4 rounded-xl border bg-white p-4"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row">
                      <ProfileAvatar
                        avatarPath={mentee?.avatar_url}
                        displayName={mentee?.display_name}
                        size={40}
                      />

                      <div className="min-w-0">
                        <Link
                          className="font-semibold hover:underline"
                          href={`/profile/${request.mentee_id}`}
                        >
                          {mentee?.display_name ??
                            "Unknown profile"}
                        </Link>

                        <p className="mt-1 text-sm text-gray-600">
                          {request.mentorship_field}
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-3 text-sm sm:grid-cols-2">
                      <div>
                        <h3 className="font-semibold">
                          Objective
                        </h3>
                        <p className="mt-1 whitespace-pre-wrap text-gray-700">
                          {request.objective}
                        </p>
                      </div>

                      <div>
                        <h3 className="font-semibold">
                          Motivation
                        </h3>
                        <p className="mt-1 whitespace-pre-wrap text-gray-700">
                          {request.motivation}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full border px-3 py-1">
                        {formatMentorshipDuration(
                          request.requested_duration
                        )}
                      </span>

                      <span className="rounded-full border px-3 py-1">
                        {formatMentorshipFrequency(
                          request.requested_frequency
                        )}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        className="min-h-10 rounded-xl bg-gray-950 px-3 py-2 text-sm font-medium text-white transition hover:bg-gray-800 disabled:opacity-50"
                        disabled={isWorking}
                        onClick={() =>
                          respondToMentorshipRequest(
                            request.id,
                            "accept"
                          )
                        }
                        type="button"
                      >
                        Accept
                      </button>

                      <button
                        className="rounded-lg border px-3 py-2 text-sm font-medium disabled:opacity-50"
                        disabled={isWorking}
                        onClick={() =>
                          respondToMentorshipRequest(
                            request.id,
                            "decline"
                          )
                        }
                        type="button"
                      >
                        Decline
                      </button>

                      <button
                        className="rounded-lg border px-3 py-2 text-sm font-medium disabled:opacity-50"
                        disabled={isWorking}
                        onClick={() => {
                          setCounterproposalRequestId(
                            counterproposalRequestId === request.id
                              ? null
                              : request.id
                          );
                          setCounterproposalDuration(
                            request.requested_duration
                          );
                          setCounterproposalFrequency(
                            request.requested_frequency
                          );
                          setCounterproposalMessage("");
                          setMessage(null);
                        }}
                        type="button"
                      >
                        {counterproposalRequestId === request.id
                          ? "Cancel changes"
                          : "Propose changes"}
                      </button>
                    </div>

                    {counterproposalRequestId === request.id && (
                      <div className="grid gap-3 rounded-xl border bg-gray-50 p-4">
                        <h3 className="font-semibold">
                          Counterproposal
                        </h3>

                        <div className="grid gap-3 sm:grid-cols-2">
                          <label className="flex flex-col gap-2 text-sm font-medium">
                            Duration
                            <select
                              className="rounded-lg border bg-white px-3 py-2 font-normal"
                              disabled={isWorking}
                              onChange={(event) =>
                                setCounterproposalDuration(
                                  event.target.value as
                                    | "3_months"
                                    | "6_months"
                                    | "1_year"
                                    | "ongoing"
                                )
                              }
                              value={counterproposalDuration}
                            >
                              <option value="3_months">
                                3 months
                              </option>
                              <option value="6_months">
                                6 months
                              </option>
                              <option value="1_year">
                                1 year
                              </option>
                              <option value="ongoing">
                                Ongoing
                              </option>
                            </select>
                          </label>

                          <label className="flex flex-col gap-2 text-sm font-medium">
                            Frequency
                            <select
                              className="rounded-lg border bg-white px-3 py-2 font-normal"
                              disabled={isWorking}
                              onChange={(event) =>
                                setCounterproposalFrequency(
                                  event.target.value as
                                    | "weekly"
                                    | "fortnightly"
                                    | "monthly"
                                    | "flexible"
                                )
                              }
                              value={counterproposalFrequency}
                            >
                              <option value="weekly">
                                Weekly
                              </option>
                              <option value="fortnightly">
                                Fortnightly
                              </option>
                              <option value="monthly">
                                Monthly
                              </option>
                              <option value="flexible">
                                Flexible
                              </option>
                            </select>
                          </label>
                        </div>

                        <label className="flex flex-col gap-2 text-sm font-medium">
                          Message
                          <textarea
                            className="min-h-24 rounded-lg border bg-white px-3 py-2 font-normal"
                            disabled={isWorking}
                            maxLength={1000}
                            onChange={(event) =>
                              setCounterproposalMessage(
                                event.target.value
                              )
                            }
                            placeholder="Explain the proposed duration or meeting frequency."
                            value={counterproposalMessage}
                          />
                        </label>

                        <div>
                          <button
                            className="min-h-10 rounded-xl bg-gray-950 px-3 py-2 text-sm font-medium text-white transition hover:bg-gray-800 disabled:opacity-50"
                            disabled={
                              isWorking ||
                              counterproposalMessage.trim().length === 0
                            }
                            onClick={() =>
                              respondToMentorshipRequest(
                                request.id,
                                "counterpropose"
                              )
                            }
                            type="button"
                          >
                            Send counterproposal
                          </button>
                        </div>
                      </div>
                    )}
                  </article>
                );
              })
            )}
          </ConnectionSection>

          <ConnectionSection title="Outgoing mentorship requests">
            {outgoingMentorshipRequests.length === 0 ? (
              <EmptyState text="No outgoing mentorship requests pending." />
            ) : (
              outgoingMentorshipRequests.map((request) => {
                const mentor =
                  profileById.get(request.mentor_id);

                return (
                  <article
                    key={request.id}
                    className="flex flex-col gap-3 rounded-xl border bg-white p-4"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row">
                      <ProfileAvatar
                        avatarPath={mentor?.avatar_url}
                        displayName={mentor?.display_name}
                        size={40}
                      />

                      <div>
                        <Link
                          className="font-semibold hover:underline"
                          href={`/profile/${request.mentor_id}`}
                        >
                          {mentor?.display_name ??
                            "Unknown profile"}
                        </Link>

                        <p className="mt-1 text-sm text-gray-600">
                          {request.mentorship_field}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full border px-3 py-1">
                        {formatMentorshipDuration(
                          request.proposed_duration ??
                            request.requested_duration
                        )}
                      </span>

                      <span className="rounded-full border px-3 py-1">
                        {formatMentorshipFrequency(
                          request.proposed_frequency ??
                            request.requested_frequency
                        )}
                      </span>

                      <span className="rounded-full border px-3 py-1 capitalize">
                        {request.status.replace("_", " ")}
                      </span>
                    </div>

                    {request.proposal_message && (
                      <div className="rounded-xl border bg-gray-50 p-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                          Mentor proposal
                        </p>
                        <p className="mt-1 whitespace-pre-wrap text-sm text-gray-700">
                          {request.proposal_message}
                        </p>
                      </div>
                    )}

                    {request.status === "change_proposed" && (
                      <div className="flex flex-wrap gap-2">
                        <button
                          className="min-h-10 rounded-xl bg-gray-950 px-3 py-2 text-sm font-medium text-white transition hover:bg-gray-800 disabled:opacity-50"
                          disabled={isWorking}
                          onClick={() =>
                            respondToMentorshipRequest(
                              request.id,
                              "accept"
                            )
                          }
                          type="button"
                        >
                          Accept proposal
                        </button>

                        <button
                          className="rounded-lg border px-3 py-2 text-sm font-medium disabled:opacity-50"
                          disabled={isWorking}
                          onClick={() =>
                            respondToMentorshipRequest(
                              request.id,
                              "decline"
                            )
                          }
                          type="button"
                        >
                          Decline proposal
                        </button>
                      </div>
                    )}
                  </article>
                );
              })
            )}
          </ConnectionSection>

          <ConnectionSection title="Incoming requests">
            {incomingRequests.length === 0 ? (
              <EmptyState text="No incoming requests yet." />
            ) : (
              incomingRequests.map((connection) => {
                const profile = profileById.get(connection.requester_id);
                return (
                  <ConnectionCard key={connection.id} profile={profile}>
                    <div className="flex flex-wrap gap-2">
                      <button
                        className="min-h-10 rounded-xl bg-gray-950 px-3 py-2 text-sm font-medium text-white transition hover:bg-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:opacity-50"
                        disabled={isWorking}
                        onClick={() => updateRequest(connection.id, "accepted")}
                      >
                        Accept
                      </button>
                      <button
                        className="rounded-lg border px-3 py-2 text-sm font-medium disabled:opacity-50"
                        disabled={isWorking}
                        onClick={() => updateRequest(connection.id, "declined")}
                      >
                        Decline
                      </button>
                    </div>
                  </ConnectionCard>
                );
              })
            )}
          </ConnectionSection>

          <ConnectionSection
            title={`Your connections · ${acceptedConnections.length}`}
          >
            {acceptedConnections.length === 0 ? (
              <EmptyState text="No connections yet." />
            ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_150px]">
                  <label className="flex flex-col gap-2 text-sm font-medium">
                    Search
                    <input
                      className="rounded-lg border px-3 py-2 font-normal"
                      onChange={(event) =>
                        setConnectionSearch(event.target.value)
                      }
                      placeholder="Name, field, or skill"
                      type="search"
                      value={connectionSearch}
                    />
                  </label>

                  <label className="flex flex-col gap-2 text-sm font-medium">
                    Sort
                    <select
                      className="rounded-lg border px-3 py-2 font-normal"
                      onChange={(event) =>
                        setConnectionSort(
                          event.target.value as "newest" | "oldest"
                        )
                      }
                      value={connectionSort}
                    >
                      <option value="newest">Newest</option>
                      <option value="oldest">Oldest</option>
                    </select>
                  </label>
                </div>

                <p className="text-xs text-gray-500">
                  {visibleAcceptedConnections.length}{" "}
                  {visibleAcceptedConnections.length === 1
                    ? "connection"
                    : "connections"}{" "}
                  shown
                </p>

                {visibleAcceptedConnections.length === 0 ? (
                  <EmptyState text="No connections match your search." />
                ) : (
                  <div className="max-h-48 space-y-3 overflow-y-auto pr-1">
                    {visibleAcceptedConnections.map((connection) => {
                      const profile = getOtherProfile(connection);
                      const profileSkills = profile
                        ? skillsByProfileId.get(profile.id) ?? []
                        : [];

                      return (
                        <ConnectionCard
                          key={connection.id}
                          profile={profile}
                          skills={profileSkills}
                        >
                          <button
                            className="rounded-lg border px-3 py-2 text-sm font-medium text-red-700 disabled:opacity-50"
                            disabled={isWorking}
                            onClick={() =>
                              disconnectConnection(connection.id)
                            }
                            type="button"
                          >
                            Disconnect
                          </button>
                        </ConnectionCard>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </ConnectionSection>

          <ConnectionSection title="Outgoing requests">
            {outgoingRequests.length === 0 ? (
              <EmptyState text="No outgoing requests pending." />
            ) : (
              outgoingRequests.map((connection) => (
                <ConnectionCard key={connection.id} profile={profileById.get(connection.recipient_id)}>
                  <span className="text-sm font-medium text-gray-700">Pending</span>
                </ConnectionCard>
              ))
            )}
          </ConnectionSection>

          <ConnectionSection title="Find people">
            <div className="rounded-xl border bg-white p-4">
              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_180px_auto] md:items-end">
                <label className="flex flex-col gap-2 text-sm font-medium">
                  Search people
                  <input
                    className="rounded-lg border px-3 py-2 font-normal"
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Search by name, field, or role..."
                    type="search"
                    value={searchTerm}
                  />
                </label>

                <label className="flex flex-col gap-2 text-sm font-medium">
                  Role type
                  <select
                    className="rounded-lg border px-3 py-2 font-normal"
                    onChange={(event) => setRoleFilter(event.target.value)}
                    value={roleFilter}
                  >
                    <option value="all">All role types</option>
                    <option value="student">Student</option>
                    <option value="professional">Professional</option>
                    <option value="institution">Institution</option>
                  </select>
                </label>

                <label className="flex flex-col gap-2 text-sm font-medium">
                  Mentor status
                  <select
                    className="rounded-lg border px-3 py-2 font-normal"
                    onChange={(event) => setMentorFilter(event.target.value)}
                    value={mentorFilter}
                  >
                    <option value="all">Everyone</option>
                    <option value="mentors">Available mentors</option>
                    <option value="non-mentors">Not mentoring</option>
                  </select>
                </label>

                <button
                  className="rounded-lg border px-3 py-2 text-sm font-medium disabled:opacity-50"
                  disabled={!hasActiveSearch}
                  onClick={clearSearchFilters}
                  type="button"
                >
                  Clear
                </button>
              </div>

              <p className="mt-3 text-xs text-gray-500">
                {filteredDiscoverableProfiles.length} of {discoverableProfiles.length} people shown
              </p>
            </div>

            {filteredDiscoverableProfiles.length === 0 ? (
              <EmptyState text="No results available." />
            ) : (
              filteredDiscoverableProfiles.map((profile) => (
                <ConnectionCard key={profile.id} profile={profile}>
                  <button
                    className="min-h-10 rounded-xl bg-gray-950 px-3 py-2 text-sm font-medium text-white transition hover:bg-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:opacity-50"
                    disabled={isWorking}
                    onClick={() => sendRequest(profile.id)}
                  >
                    Connect
                  </button>
                </ConnectionCard>
              ))
            )}
          </ConnectionSection>
        </>
      )}
    </section>
  );
}

function ConnectionSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xl font-semibold">{title}</h2>
      <div className="grid gap-3">{children}</div>
    </section>
  );
}

function ConnectionCard({
  profile,
  skills = [],
  children,
}: {
  profile?: Profile;
  skills?: string[];
  children: React.ReactNode;
}) {
  const identity = (
    <>
      <ProfileAvatar avatarPath={profile?.avatar_url} displayName={profile?.display_name} size={40} />
      <div>
        <h3 className="font-semibold">{profile?.display_name ?? "Unknown profile"}</h3>
        <p className="text-sm text-gray-600">
          {[profile?.role_type, profile?.field].filter(Boolean).join(" - ") || "No field added yet"}
        </p>
        {profile?.bio && (
          <p className="mt-2 max-w-2xl text-sm text-gray-700">
            {profile.bio}
          </p>
        )}

        {skills.length > 0 && (
          <p className="mt-2 text-xs text-gray-500">
            {skills.slice(0, 4).join(" · ")}
          </p>
        )}

        {profile?.mentor_available && (
          <p className="mt-2 text-sm font-medium">
            Available as mentor
          </p>
        )}
      </div>
    </>
  );

  return (
    <article className="flex min-w-0 flex-col justify-between gap-4 rounded-xl border bg-white p-4 md:flex-row md:items-center">
      {profile ? (
        <Link className="flex min-w-0 gap-3 rounded-lg hover:bg-gray-50" href={`/profile/${profile.id}`}>
          {identity}
        </Link>
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row">{identity}</div>
      )}
      <div>{children}</div>
    </article>
  );
}

function formatMentorshipDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
  }).format(new Date(`${value}T00:00:00`));
}

function formatMentorshipDuration(
  duration:
    | "3_months"
    | "6_months"
    | "1_year"
    | "ongoing"
) {
  const labels = {
    "3_months": "3 months",
    "6_months": "6 months",
    "1_year": "1 year",
    ongoing: "Full-time / ongoing",
  };

  return labels[duration];
}

function formatMentorshipFrequency(
  frequency:
    | "weekly"
    | "fortnightly"
    | "monthly"
    | "flexible"
) {
  const labels = {
    weekly: "Weekly",
    fortnightly: "Every two weeks",
    monthly: "Monthly",
    flexible: "Flexible",
  };

  return labels[frequency];
}

function EmptyState({ text }: { text: string }) {
  return <p className="rounded-xl border border-dashed p-4 text-sm text-gray-600">{text}</p>;
}
