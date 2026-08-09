"use client";

import { useEffect, useMemo, useState } from "react";
import { FcTeamOffboarding } from "@/components/feedback/FcTeamOffboarding";
import {
  getSupabaseBrowserClient,
  isSupabaseConfigured,
} from "@/lib/supabase/browser";

type PlatformRole =
  | "user"
  | "moderator"
  | "senior_moderator"
  | "admin";

type Profile = {
  id: string;
  display_name: string;
  field: string | null;
};

type RecruitmentRequest = {
  id: string;
  candidate_id: string;
  recruited_by: string;
  invitation_message: string | null;
  status: string;
  responsibilities_acknowledged: boolean;
  confidentiality_acknowledged: boolean;
  appropriate_use_acknowledged: boolean;
  expires_at: string;
  created_at: string;
};

type TeamMember = {
  user_id: string;
  activated_by: string | null;
  activated_at: string;
  revoked_at: string | null;
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

export function FcTeamWorkflow() {
  const [currentUserId, setCurrentUserId] =
    useState<string | null>(null);

  const [currentRole, setCurrentRole] =
    useState<PlatformRole>("user");

  const [isActiveFcTeamMember, setIsActiveFcTeamMember] =
    useState(false);

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [requests, setRequests] =
    useState<RecruitmentRequest[]>([]);

  const [teamMembers, setTeamMembers] =
    useState<TeamMember[]>([]);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCandidateId, setSelectedCandidateId] =
    useState("");

  const [invitationMessage, setInvitationMessage] =
    useState("");

  const [acknowledgements, setAcknowledgements] = useState({
    responsibilities: false,
    confidentiality: false,
    appropriateUse: false,
  });

  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isWorking, setIsWorking] = useState(false);

  const isAdmin = currentRole === "admin";

  const profileById = useMemo(
    () =>
      new Map(
        profiles.map((profile) => [profile.id, profile])
      ),
    [profiles]
  );

  const activeMemberIds = useMemo(
    () =>
      new Set(
        teamMembers
          .filter((member) => member.revoked_at === null)
          .map((member) => member.user_id)
      ),
    [teamMembers]
  );

  const visibleCandidates = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();

    return profiles
      .filter((profile) => profile.id !== currentUserId)
      .filter((profile) => !activeMemberIds.has(profile.id))
      .filter((profile) => {
        if (!normalizedSearch) return true;

        return [
          profile.display_name,
          profile.field ?? "",
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalizedSearch);
      })
      .sort((left, right) =>
        left.display_name.localeCompare(right.display_name)
      );
  }, [
    activeMemberIds,
    currentUserId,
    profiles,
    searchQuery,
  ]);

  const myPendingRequests = requests.filter(
    (request) =>
      request.candidate_id === currentUserId &&
      request.status === "awaiting_response"
  );

  const awaitingFinalApproval = requests.filter(
    (request) =>
      request.status === "awaiting_final_approval"
  );

  const activeMembers = teamMembers
    .filter((member) => member.revoked_at === null)
    .sort((left, right) => {
      const leftName =
        profileById.get(left.user_id)?.display_name ?? "";

      const rightName =
        profileById.get(right.user_id)?.display_name ?? "";

      return leftName.localeCompare(rightName);
    });

  async function loadData() {
    if (!isSupabaseConfigured()) {
      setMessage("FieldsConnect team management is unavailable.");
      setIsLoading(false);
      return;
    }

    try {
      const supabase = getSupabaseBrowserClient();

      const [
        sessionResult,
        roleResult,
        teamAccessResult,
      ] = await Promise.all([
        supabase.auth.getSession(),
        supabase.rpc("current_platform_role"),
        supabase.rpc("is_fc_team_member"),
      ]);

      if (sessionResult.error) throw sessionResult.error;
      if (roleResult.error) throw roleResult.error;
      if (teamAccessResult.error) throw teamAccessResult.error;

      const userId =
        sessionResult.data.session?.user.id ?? null;

      if (!userId) {
        setMessage("Please log in to continue.");
        return;
      }

      const role =
        (roleResult.data ?? "user") as PlatformRole;

      const hasActiveFcTeamAccess =
        Boolean(teamAccessResult.data);

      setCurrentUserId(userId);
      setCurrentRole(role);
      setIsActiveFcTeamMember(hasActiveFcTeamAccess);

      const requestResult = await supabase
        .from("fc_team_recruitment_requests")
        .select(
          "id, candidate_id, recruited_by, invitation_message, status, responsibilities_acknowledged, confidentiality_acknowledged, appropriate_use_acknowledged, expires_at, created_at"
        )
        .order("created_at", { ascending: false });

      if (requestResult.error) throw requestResult.error;

      setRequests(
        (requestResult.data ?? []) as RecruitmentRequest[]
      );

      if (role === "admin") {
        const [profileResult, memberResult] =
          await Promise.all([
            supabase
              .from("profiles")
              .select("id, display_name, field")
              .is("deleted_at", null),

            supabase
              .from("fc_team_members")
              .select(
                "user_id, activated_by, activated_at, revoked_at"
              ),
          ]);

        if (profileResult.error) throw profileResult.error;
        if (memberResult.error) throw memberResult.error;

        setProfiles(
          (profileResult.data ?? []) as Profile[]
        );

        setTeamMembers(
          (memberResult.data ?? []) as TeamMember[]
        );
      } else if (hasActiveFcTeamAccess) {
        const memberResult = await supabase
          .from("fc_team_members")
          .select(
            "user_id, activated_by, activated_at, revoked_at"
          )
          .is("revoked_at", null);

        if (memberResult.error) throw memberResult.error;

        const members =
          (memberResult.data ?? []) as TeamMember[];

        setTeamMembers(members);

        const memberProfileIds = members.map(
          (member) => member.user_id
        );

        if (memberProfileIds.length > 0) {
          const profileResult = await supabase
            .from("profiles")
            .select("id, display_name, field")
            .in("id", memberProfileIds)
            .is("deleted_at", null);

          if (profileResult.error) throw profileResult.error;

          setProfiles(
            (profileResult.data ?? []) as Profile[]
          );
        } else {
          setProfiles([]);
        }
      } else {
        const relevantProfileIds = Array.from(
          new Set(
            (requestResult.data ?? []).flatMap((request) => [
              request.candidate_id,
              request.recruited_by,
            ])
          )
        );

        if (relevantProfileIds.length > 0) {
          const profileResult = await supabase
            .from("profiles")
            .select("id, display_name, field")
            .in("id", relevantProfileIds)
            .is("deleted_at", null);

          if (profileResult.error) throw profileResult.error;

          setProfiles(
            (profileResult.data ?? []) as Profile[]
          );
        }
      }
    } catch (error) {
      setMessage(
        getErrorMessage(
          error,
          "Unable to load FC Team recruitment."
        )
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    if (
      currentRole !== "admin" ||
      !currentUserId ||
      !isSupabaseConfigured()
    ) {
      return;
    }

    const supabase = getSupabaseBrowserClient();

    const channel = supabase
      .channel(
        `fc-team-admin-recruitment-realtime-${currentUserId}`
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "fc_team_recruitment_requests",
        },
        () => {
          void loadData();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "fc_team_members",
        },
        () => {
          void loadData();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [currentRole, currentUserId]);

  async function sendRecruitment(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!selectedCandidateId) {
      setMessage("Select a candidate first.");
      return;
    }

    setIsWorking(true);
    setMessage(null);

    try {
      const supabase = getSupabaseBrowserClient();

      const { error } = await supabase.rpc(
        "recruit_fc_team_member",
        {
          candidate: selectedCandidateId,
          invitation_text:
            invitationMessage.trim() || null,
        }
      );

      if (error) throw error;

      setSelectedCandidateId("");
      setInvitationMessage("");
      setSearchQuery("");

      setMessage(
        "FC Team invitation sent successfully."
      );

      await loadData();
    } catch (error) {
      setMessage(
        getErrorMessage(
          error,
          "Unable to send the FC Team invitation."
        )
      );
    } finally {
      setIsWorking(false);
    }
  }

  async function respondToRecruitment(
    requestId: string,
    accept: boolean
  ) {
    if (
      accept &&
      !(
        acknowledgements.responsibilities &&
        acknowledgements.confidentiality &&
        acknowledgements.appropriateUse
      )
    ) {
      setMessage(
        "Accept all three FC Team responsibilities before continuing."
      );
      return;
    }

    setIsWorking(true);
    setMessage(null);

    try {
      const supabase = getSupabaseBrowserClient();

      const { error } = await supabase.rpc(
        "respond_to_fc_team_recruitment",
        {
          recruitment: requestId,
          accept_recruitment: accept,
          acknowledge_responsibilities:
            accept
              ? acknowledgements.responsibilities
              : false,
          acknowledge_confidentiality:
            accept
              ? acknowledgements.confidentiality
              : false,
          acknowledge_appropriate_use:
            accept
              ? acknowledgements.appropriateUse
              : false,
        }
      );

      if (error) throw error;

      setAcknowledgements({
        responsibilities: false,
        confidentiality: false,
        appropriateUse: false,
      });

      setMessage(
        accept
          ? "Invitation accepted and returned to the administrator for final approval."
          : "FC Team invitation declined."
      );

      await loadData();
    } catch (error) {
      setMessage(
        getErrorMessage(
          error,
          "Unable to respond to the invitation."
        )
      );
    } finally {
      setIsWorking(false);
    }
  }

  async function activateRecruitment(requestId: string) {
    setIsWorking(true);
    setMessage(null);

    try {
      const supabase = getSupabaseBrowserClient();

      const { error } = await supabase.rpc(
        "activate_fc_team_recruitment",
        {
          recruitment: requestId,
        }
      );

      if (error) throw error;

      setMessage(
        "FC Team membership activated successfully."
      );

      await loadData();
    } catch (error) {
      setMessage(
        getErrorMessage(
          error,
          "Unable to activate FC Team membership."
        )
      );
    } finally {
      setIsWorking(false);
    }
  }

  if (isLoading) {
    return (
      <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <p className="text-sm text-gray-600">
          Loading FC Team...
        </p>
      </section>
    );
  }

  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-3 py-4 sm:gap-6 sm:px-6 sm:py-8">
      <header>
        <h1 className="text-xl font-semibold tracking-tight sm:text-3xl">
          FC Team
        </h1>

        <p className="mt-2 max-w-3xl text-sm leading-snug text-gray-600 sm:leading-6">
          Recruit and activate FieldsConnect team members who
          can receive and action internal feedback tickets.
        </p>
      </header>

      {message && (
        <p
          aria-live="polite"
          className="rounded-xl border bg-white p-4 text-sm text-gray-700"
        >
          {message}
        </p>
      )}

      {isAdmin && (
        <>
          <form
            className="grid gap-4 rounded-2xl border bg-white p-4 sm:gap-5 sm:p-6"
            onSubmit={sendRecruitment}
          >
            <div>
              <h2 className="text-lg font-semibold sm:text-xl">
                Recruit FC Team member
              </h2>

              <p className="mt-1 text-sm text-gray-600">
                Search FieldsConnect profiles and send a
                private invitation.
              </p>
            </div>

            <label className="grid gap-2 text-sm font-medium">
              Search profiles

              <input
                className="rounded-xl border px-4 py-3 font-normal outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                disabled={isWorking}
                onChange={(event) =>
                  setSearchQuery(event.target.value)
                }
                placeholder="Search by name or field"
                type="search"
                value={searchQuery}
              />
            </label>

            <label className="grid gap-2 text-sm font-medium">
              Candidate

              <select
                className="rounded-xl border px-4 py-3 font-normal"
                disabled={isWorking}
                onChange={(event) =>
                  setSelectedCandidateId(event.target.value)
                }
                required
                value={selectedCandidateId}
              >
                <option value="">
                  Select a profile
                </option>

                {visibleCandidates.map((profile) => (
                  <option
                    key={profile.id}
                    value={profile.id}
                  >
                    {profile.display_name}
                    {profile.field
                      ? ` — ${profile.field}`
                      : ""}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-2 text-sm font-medium">
              Invitation message

              <textarea
                className="min-h-28 resize-y rounded-xl border px-4 py-3 font-normal leading-6 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                disabled={isWorking}
                maxLength={2000}
                onChange={(event) =>
                  setInvitationMessage(event.target.value)
                }
                placeholder="Optional note explaining why the person is being invited."
                value={invitationMessage}
              />
            </label>

            <button
              className="min-h-11 w-full rounded-xl bg-gray-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50 sm:w-fit"
              disabled={
                isWorking || !selectedCandidateId
              }
              type="submit"
            >
              {isWorking
                ? "Sending invitation..."
                : "Send FC Team invitation"}
            </button>
          </form>

          <section className="grid gap-3">
            <div>
              <h2 className="text-lg font-semibold sm:text-xl">
                Awaiting final approval
              </h2>

              <p className="mt-1 text-sm text-gray-600">
                Accepted invitations remain inactive until
                administrative approval.
              </p>
            </div>

            {awaitingFinalApproval.length === 0 ? (
              <p className="rounded-xl border border-dashed bg-white p-4 text-sm text-gray-600">
                No invitations are awaiting final approval.
              </p>
            ) : (
              awaitingFinalApproval.map((request) => {
                const candidate =
                  profileById.get(request.candidate_id);

                return (
                  <article
                    className="rounded-xl border bg-white p-4"
                    key={request.id}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <h3 className="font-semibold">
                          {candidate?.display_name ??
                            "Candidate"}
                        </h3>

                        {candidate?.field && (
                          <p className="text-sm text-gray-600">
                            {candidate.field}
                          </p>
                        )}

                        <p className="mt-2 text-xs text-gray-500">
                          Accepted{" "}
                          {new Date(
                            request.created_at
                          ).toLocaleDateString()}
                        </p>
                      </div>

                      <button
                        className="rounded-xl bg-gray-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                        disabled={isWorking}
                        onClick={() =>
                          void activateRecruitment(
                            request.id
                          )
                        }
                        type="button"
                      >
                        Approve and activate
                      </button>
                    </div>
                  </article>
                );
              })
            )}
          </section>

          <section className="grid gap-3">
            <div>
              <h2 className="text-xl font-semibold">
                Active FC Team members
              </h2>

              <p className="mt-1 text-sm text-gray-600">
                These members can be assigned feedback
                tickets.
              </p>
            </div>

            {activeMembers.length === 0 ? (
              <p className="rounded-xl border border-dashed bg-white p-4 text-sm text-gray-600">
                No active FC Team members.
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {activeMembers.map((member) => {
                  const profile =
                    profileById.get(member.user_id);

                  return (
                    <article
                      className="rounded-xl border bg-white p-4"
                      key={member.user_id}
                    >
                      <h3 className="font-semibold">
                        {profile?.display_name ??
                          "FC Team member"}
                      </h3>

                      {profile?.field && (
                        <p className="mt-1 text-sm text-gray-600">
                          {profile.field}
                        </p>
                      )}

                      <p className="mt-2 text-xs text-gray-500">
                        Active since{" "}
                        {new Date(
                          member.activated_at
                        ).toLocaleDateString()}
                      </p>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}

      {isActiveFcTeamMember && !isAdmin && (
        <section className="grid gap-3">
          <div>
            <h2 className="text-xl font-semibold">
              Active FC Team members
            </h2>

            <p className="mt-1 text-sm text-gray-600">
              Current active members of the FieldsConnect team.
            </p>
          </div>

          {activeMembers.length === 0 ? (
            <p className="rounded-xl border border-dashed bg-white p-4 text-sm text-gray-600">
              No active FC Team members are available.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {activeMembers.map((member) => {
                const profile =
                  profileById.get(member.user_id);

                return (
                  <article
                    className="rounded-xl border bg-white p-4"
                    key={member.user_id}
                  >
                    <h3 className="font-semibold">
                      {profile?.display_name ??
                        "FC Team member"}
                    </h3>

                    {profile?.field && (
                      <p className="mt-1 text-sm text-gray-600">
                        {profile.field}
                      </p>
                    )}

                    <p className="mt-2 text-xs text-gray-500">
                      Active since{" "}
                      {new Date(
                        member.activated_at
                      ).toLocaleDateString()}
                    </p>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}
      {!isActiveFcTeamMember && myPendingRequests.map((request) => {
        const recruiter =
          profileById.get(request.recruited_by);

        return (
          <article
            className="rounded-2xl border bg-white p-4 sm:p-6"
            key={request.id}
          >
            <p className="text-sm font-semibold text-blue-700">
              Private FieldsConnect invitation
            </p>

            <h2 className="mt-1 text-lg font-semibold leading-snug sm:text-xl">
              You have been invited to join the FC Team
            </h2>

            <p className="mt-2 text-sm leading-6 text-gray-600">
              FC Team members may receive internal feedback
              tickets, record progress and submit resolution
              summaries.
            </p>

            {request.invitation_message && (
              <div className="mt-3 rounded-xl bg-gray-50 p-3 text-sm leading-snug text-gray-700 sm:mt-4 sm:p-4 sm:leading-6">
                {request.invitation_message}
              </div>
            )}

            <p className="mt-3 text-xs text-gray-500">
              Invited by{" "}
              {recruiter?.display_name ??
                "a FieldsConnect administrator"}.
              Invitation expires{" "}
              {new Date(
                request.expires_at
              ).toLocaleDateString()}.
            </p>

            <div className="mt-4 grid gap-3 text-sm sm:mt-5">
              <label className="flex items-start gap-3">
                <input
                  checked={
                    acknowledgements.responsibilities
                  }
                  className="mt-1"
                  onChange={(event) =>
                    setAcknowledgements((current) => ({
                      ...current,
                      responsibilities:
                        event.target.checked,
                    }))
                  }
                  type="checkbox"
                />

                <span>
                  I understand and accept the responsibilities
                  of an FC Team member.
                </span>
              </label>

              <label className="flex items-start gap-3">
                <input
                  checked={
                    acknowledgements.confidentiality
                  }
                  className="mt-1"
                  onChange={(event) =>
                    setAcknowledgements((current) => ({
                      ...current,
                      confidentiality:
                        event.target.checked,
                    }))
                  }
                  type="checkbox"
                />

                <span>
                  I will keep internal feedback, discussions and
                  development information confidential.
                </span>
              </label>

              <label className="flex items-start gap-3">
                <input
                  checked={
                    acknowledgements.appropriateUse
                  }
                  className="mt-1"
                  onChange={(event) =>
                    setAcknowledgements((current) => ({
                      ...current,
                      appropriateUse:
                        event.target.checked,
                    }))
                  }
                  type="checkbox"
                />

                <span>
                  I will use access and assigned information only
                  for authorised FieldsConnect work.
                </span>
              </label>
            </div>

            <div className="mt-4 grid gap-2 sm:mt-5 sm:flex sm:flex-wrap sm:gap-3">
              <button
                className="w-full rounded-xl bg-gray-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 sm:w-auto"
                disabled={isWorking}
                onClick={() =>
                  void respondToRecruitment(
                    request.id,
                    true
                  )
                }
                type="button"
              >
                Accept invitation
              </button>

              <button
                className="w-full rounded-xl border px-4 py-2 text-sm font-semibold disabled:opacity-50 sm:w-auto"
                disabled={isWorking}
                onClick={() =>
                  void respondToRecruitment(
                    request.id,
                    false
                  )
                }
                type="button"
              >
                Decline
              </button>
            </div>
          </article>
        );
      })}

      {!isAdmin &&
        !isActiveFcTeamMember &&
        myPendingRequests.length === 0 && (
        <p className="rounded-2xl border border-dashed bg-white p-4 text-sm text-gray-600 sm:p-6">
          There are no FC Team invitations requiring your
          response.
        </p>
      )}

      {(isAdmin || isActiveFcTeamMember) && (
        <FcTeamOffboarding />
      )}

      {isAdmin && (
        <section className="grid gap-3">
          <h2 className="text-lg font-semibold sm:text-xl">
            Recruitment history
          </h2>

          {requests.length === 0 ? (
            <p className="rounded-xl border border-dashed bg-white p-4 text-sm text-gray-600">
              No FC Team recruitment requests have been sent.
            </p>
          ) : (
            requests.map((request) => {
              const candidate =
                profileById.get(request.candidate_id);

              return (
                <article
                  className="rounded-xl border bg-white p-4"
                  key={request.id}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold">
                        {candidate?.display_name ??
                          "Candidate"}
                      </p>

                      <p className="text-xs text-gray-500">
                        Sent{" "}
                        {new Date(
                          request.created_at
                        ).toLocaleString()}
                      </p>
                    </div>

                    <span className="rounded-full border px-3 py-1 text-xs">
                      {formatLabel(request.status)}
                    </span>
                  </div>
                </article>
              );
            })
          )}
        </section>
      )}
    </section>
  );
}