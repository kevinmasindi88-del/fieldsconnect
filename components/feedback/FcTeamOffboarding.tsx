"use client";

import { useEffect, useMemo, useState } from "react";
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

type TeamMember = {
  user_id: string;
  activated_at: string;
  revoked_at: string | null;
};

type LeaveRequest = {
  id: string;
  member_id: string;
  reason: string;
  status: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  admin_response: string | null;
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
    .map(
      (word) =>
        word.charAt(0).toUpperCase() + word.slice(1)
    )
    .join(" ");
}

export function FcTeamOffboarding() {
  const [currentUserId, setCurrentUserId] =
    useState<string | null>(null);

  const [currentRole, setCurrentRole] =
    useState<PlatformRole>("user");

  const [isActiveMember, setIsActiveMember] =
    useState(false);

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [leaveRequests, setLeaveRequests] =
    useState<LeaveRequest[]>([]);

  const [leaveReason, setLeaveReason] = useState("");
  const [reviewResponses, setReviewResponses] =
    useState<Record<string, string>>({});

  const [removalCategories, setRemovalCategories] =
    useState<Record<string, string>>({});

  const [removalReasons, setRemovalReasons] =
    useState<Record<string, string>>({});

  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [workingKey, setWorkingKey] =
    useState<string | null>(null);

  const isAdmin = currentRole === "admin";

  const profileById = useMemo(
    () =>
      new Map(
        profiles.map((profile) => [profile.id, profile])
      ),
    [profiles]
  );

  const activeMembers = useMemo(
    () =>
      members
        .filter((member) => member.revoked_at === null)
        .sort((left, right) => {
          const leftName =
            profileById.get(left.user_id)?.display_name ?? "";

          const rightName =
            profileById.get(right.user_id)?.display_name ?? "";

          return leftName.localeCompare(rightName);
        }),
    [members, profileById]
  );

  const pendingRequests = useMemo(
    () =>
      leaveRequests.filter(
        (request) => request.status === "pending"
      ),
    [leaveRequests]
  );

  const myRequests = useMemo(
    () =>
      leaveRequests.filter(
        (request) => request.member_id === currentUserId
      ),
    [currentUserId, leaveRequests]
  );

  const hasPendingOwnRequest = myRequests.some(
    (request) => request.status === "pending"
  );

  async function loadData() {
    if (!isSupabaseConfigured()) {
      setMessage("FC Team membership controls are unavailable.");
      setIsLoading(false);
      return;
    }

    try {
      const supabase = getSupabaseBrowserClient();

      const [
        sessionResult,
        roleResult,
        membershipResult,
      ] = await Promise.all([
        supabase.auth.getSession(),
        supabase.rpc("current_platform_role"),
        supabase.rpc("is_fc_team_member"),
      ]);

      if (sessionResult.error) throw sessionResult.error;
      if (roleResult.error) throw roleResult.error;
      if (membershipResult.error) {
        throw membershipResult.error;
      }

      const userId =
        sessionResult.data.session?.user.id ?? null;

      if (!userId) {
        setMessage("Please log in to continue.");
        return;
      }

      const role =
        (roleResult.data ?? "user") as PlatformRole;

      const activeMembership =
        Boolean(membershipResult.data);

      setCurrentUserId(userId);
      setCurrentRole(role);
      setIsActiveMember(activeMembership);

      if (!activeMembership && role !== "admin") {
        setLeaveRequests([]);
        setMembers([]);
        setProfiles([]);
        return;
      }

      const requestResult = await supabase
        .from("fc_team_leave_requests")
        .select(
          "id, member_id, reason, status, reviewed_by, reviewed_at, admin_response, created_at"
        )
        .order("created_at", { ascending: false });

      if (requestResult.error) throw requestResult.error;

      const requests =
        (requestResult.data ?? []) as LeaveRequest[];

      setLeaveRequests(requests);

      if (role === "admin") {
        const memberResult = await supabase
          .from("fc_team_members")
          .select("user_id, activated_at, revoked_at")
          .is("revoked_at", null);

        if (memberResult.error) throw memberResult.error;

        const activeTeamMembers =
          (memberResult.data ?? []) as TeamMember[];

        setMembers(activeTeamMembers);

        const profileIds = Array.from(
          new Set([
            ...activeTeamMembers.map(
              (member) => member.user_id
            ),
            ...requests.map(
              (request) => request.member_id
            ),
          ])
        );

        if (profileIds.length > 0) {
          const profileResult = await supabase
            .from("profiles")
            .select("id, display_name, field")
            .in("id", profileIds)
            .is("deleted_at", null);

          if (profileResult.error) {
            throw profileResult.error;
          }

          setProfiles(
            (profileResult.data ?? []) as Profile[]
          );
        } else {
          setProfiles([]);
        }
      }
    } catch (error) {
      setMessage(
        getErrorMessage(
          error,
          "Unable to load FC Team membership controls."
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
        `fc-team-admin-leave-realtime-${currentUserId}`
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "fc_team_leave_requests",
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

  useEffect(() => {
    if (
      !currentUserId ||
      isAdmin ||
      !isActiveMember ||
      !isSupabaseConfigured()
    ) {
      return;
    }

    const supabase = getSupabaseBrowserClient();

    const channel = supabase
      .channel(
        `fc-team-membership-${currentUserId}`
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "fc_team_members",
          filter: `user_id=eq.${currentUserId}`,
        },
        (payload) => {
          const updatedMember = payload.new as {
            revoked_at?: string | null;
          };

          if (updatedMember.revoked_at) {
            window.location.href = "/";
          }
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [
    currentUserId,
    isActiveMember,
    isAdmin,
  ]);

  async function submitLeaveRequest(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const reason = leaveReason.trim();

    if (reason.length < 3) {
      setMessage(
        "Please provide a reason for requesting to leave."
      );
      return;
    }

    setWorkingKey("leave-request");
    setMessage(null);

    try {
      const supabase = getSupabaseBrowserClient();

      const { error } = await supabase.rpc(
        "request_fc_team_leave",
        {
          leave_reason: reason,
        }
      );

      if (error) throw error;

      setLeaveReason("");
      setMessage(
        "Your request to leave the FC Team has been sent to the administrator. Your membership remains active until a decision is made."
      );

      await loadData();
    } catch (error) {
      setMessage(
        getErrorMessage(
          error,
          "Unable to submit the leave request."
        )
      );
    } finally {
      setWorkingKey(null);
    }
  }

  async function reviewLeaveRequest(
    requestId: string,
    approve: boolean
  ) {
    const response =
      reviewResponses[requestId]?.trim() ?? "";

    if (!approve && response.length < 3) {
      setMessage(
        "Provide a reason when declining a leave request."
      );
      return;
    }

    setWorkingKey(`review-${requestId}`);
    setMessage(null);

    try {
      const supabase = getSupabaseBrowserClient();

      const { error } = await supabase.rpc(
        "respond_to_fc_team_leave_request",
        {
          leave_request: requestId,
          approve_request: approve,
          response_text: response || null,
        }
      );

      if (error) throw error;

      setReviewResponses((current) => {
        const next = { ...current };
        delete next[requestId];
        return next;
      });

      setMessage(
        approve
          ? "The leave request was approved and the member returned to standard access."
          : "The leave request was declined."
      );

      await loadData();
    } catch (error) {
      setMessage(
        getErrorMessage(
          error,
          "Unable to review the leave request."
        )
      );
    } finally {
      setWorkingKey(null);
    }
  }

  async function removeMember(memberId: string) {
    const category =
      removalCategories[memberId]?.trim() ?? "";

    const justification =
      removalReasons[memberId]?.trim() ?? "";

    if (!category) {
      setMessage(
        "Select a reason category before removing the FC Team member."
      );
      return;
    }

    if (justification.length < 10) {
      setMessage(
        "Provide a detailed justification of at least 10 characters."
      );
      return;
    }

    const profile =
      profileById.get(memberId);

    const memberName =
      profile?.display_name ?? "this FC Team member";

    const confirmed = window.confirm(
      `Remove ${memberName} from the FC Team?

Reason category: ${category}

This action will immediately revoke FC Team privileges and return the account to standard-user access.`
    );

    if (!confirmed) {
      return;
    }

    const completeReason =
      `${category}: ${justification}`;

    setWorkingKey(`remove-${memberId}`);
    setMessage(null);

    try {
      const supabase = getSupabaseBrowserClient();

      const { error } = await supabase.rpc(
        "remove_fc_team_member",
        {
          member: memberId,
          removal_reason: completeReason,
        }
      );

      if (error) throw error;

      setRemovalCategories((current) => {
        const next = { ...current };
        delete next[memberId];
        return next;
      });

      setRemovalReasons((current) => {
        const next = { ...current };
        delete next[memberId];
        return next;
      });

      setMessage(
        `${memberName} was removed from the FC Team and returned to standard-user access.`
      );

      await loadData();
    } catch (error) {
      setMessage(
        getErrorMessage(
          error,
          "Unable to remove the FC Team member."
        )
      );
    } finally {
      setWorkingKey(null);
    }
  }

  if (isLoading) {
    return (
      <section className="rounded-2xl border bg-white p-4 sm:p-5">
        <p className="text-sm text-gray-600">
          Loading membership controls...
        </p>
      </section>
    );
  }

  if (!isAdmin && !isActiveMember) {
    return null;
  }

  return (
    <section className="grid gap-4 sm:gap-6">
      {message && (
        <p
          aria-live="polite"
          className="rounded-xl border bg-white p-4 text-sm text-gray-700"
        >
          {message}
        </p>
      )}

      {!isAdmin && isActiveMember && (
        <section className="grid gap-3 rounded-2xl border bg-white p-4 sm:gap-4 sm:p-6">
          <div>
            <h2 className="text-lg font-semibold sm:text-xl">
              FC Team membership
            </h2>

            <p className="mt-1 text-sm leading-snug text-gray-600 sm:leading-6">
              You may request to leave the FC Team. Your
              membership remains active until the administrator
              approves the request.
            </p>
          </div>

          {hasPendingOwnRequest ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 sm:p-4">
              Your leave request is awaiting administrative
              review.
            </p>
          ) : (
            <form
              className="grid gap-4"
              onSubmit={submitLeaveRequest}
            >
              <label className="grid gap-2 text-sm font-medium">
                Reason for leaving

                <textarea
                  className="min-h-28 resize-y rounded-xl border px-4 py-3 font-normal leading-6 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                  disabled={workingKey !== null}
                  maxLength={2000}
                  onChange={(event) =>
                    setLeaveReason(event.target.value)
                  }
                  placeholder="Explain why you would like to leave the FC Team."
                  required
                  value={leaveReason}
                />
              </label>

              <button
                className="min-h-11 w-full rounded-xl border border-red-300 px-5 py-3 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 sm:w-fit"
                disabled={
                  workingKey !== null ||
                  leaveReason.trim().length < 3
                }
                type="submit"
              >
                {workingKey === "leave-request"
                  ? "Sending request..."
                  : "Request to leave FC Team"}
              </button>
            </form>
          )}

          {myRequests.length > 0 && (
            <div className="grid gap-3 border-t pt-5">
              <h3 className="font-semibold">
                Request history
              </h3>

              {myRequests.map((request) => (
                <article
                  className="rounded-xl bg-gray-50 p-3 text-sm sm:p-4"
                  key={request.id}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="font-medium">
                      {formatLabel(request.status)}
                    </span>

                    <span className="text-xs text-gray-500">
                      {new Date(
                        request.created_at
                      ).toLocaleString()}
                    </span>
                  </div>

                  <p className="mt-2 leading-6 text-gray-700">
                    {request.reason}
                  </p>

                  {request.admin_response && (
                    <p className="mt-3 rounded-lg border bg-white p-3 leading-6 text-gray-700">
                      <strong>Administrator response:</strong>{" "}
                      {request.admin_response}
                    </p>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {isAdmin && (
        <>
          <section className="grid gap-4">
            <div>
              <h2 className="text-lg font-semibold sm:text-xl">
                Pending leave requests
              </h2>

              <p className="mt-1 text-sm text-gray-600">
                Review requests from active FC Team members.
              </p>
            </div>

            {pendingRequests.length === 0 ? (
              <p className="rounded-xl border border-dashed bg-white p-4 text-sm text-gray-600">
                No FC Team leave requests are awaiting review.
              </p>
            ) : (
              pendingRequests.map((request) => {
                const profile =
                  profileById.get(request.member_id);

                const isWorking =
                  workingKey === `review-${request.id}`;

                return (
                  <article
                    className="grid gap-3 rounded-2xl border bg-white p-4 sm:gap-4 sm:p-5"
                    key={request.id}
                  >
                    <div>
                      <h3 className="font-semibold">
                        {profile?.display_name ??
                          "FC Team member"}
                      </h3>

                      {profile?.field && (
                        <p className="mt-1 text-sm text-gray-600">
                          {profile.field}
                        </p>
                      )}

                      <p className="mt-3 text-sm leading-snug text-gray-700 sm:leading-6">
                        <strong>Reason:</strong>{" "}
                        {request.reason}
                      </p>

                      <p className="mt-2 text-xs text-gray-500">
                        Requested{" "}
                        {new Date(
                          request.created_at
                        ).toLocaleString()}
                      </p>
                    </div>

                    <label className="grid gap-2 text-sm font-medium">
                      Administrative response

                      <textarea
                        className="min-h-24 resize-y rounded-xl border px-4 py-3 font-normal leading-6"
                        disabled={workingKey !== null}
                        maxLength={2000}
                        onChange={(event) =>
                          setReviewResponses((current) => ({
                            ...current,
                            [request.id]: event.target.value,
                          }))
                        }
                        placeholder="Optional for approval; required when declining."
                        value={
                          reviewResponses[request.id] ?? ""
                        }
                      />
                    </label>

                    <div className="grid gap-2 sm:flex sm:flex-wrap sm:gap-3">
                      <button
                        className="w-full rounded-xl bg-gray-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 sm:w-auto"
                        disabled={workingKey !== null}
                        onClick={() =>
                          void reviewLeaveRequest(
                            request.id,
                            true
                          )
                        }
                        type="button"
                      >
                        {isWorking
                          ? "Processing..."
                          : "Approve departure"}
                      </button>

                      <button
                        className="w-full rounded-xl border px-4 py-2 text-sm font-semibold disabled:opacity-50 sm:w-auto"
                        disabled={workingKey !== null}
                        onClick={() =>
                          void reviewLeaveRequest(
                            request.id,
                            false
                          )
                        }
                        type="button"
                      >
                        Decline request
                      </button>
                    </div>
                  </article>
                );
              })
            )}
          </section>

          <section className="grid gap-4">
            <div>
              <h2 className="text-lg font-semibold sm:text-xl">
                Remove FC Team member
              </h2>

              <p className="mt-1 text-sm leading-snug text-gray-600 sm:leading-6">
                Removing a member immediately returns them to
                standard-member access. A justification is
                mandatory.
              </p>
            </div>

            <div className="grid gap-4">
              {activeMembers
                .filter(
                  (member) =>
                    member.user_id !== currentUserId
                )
                .map((member) => {
                  const profile =
                    profileById.get(member.user_id);

                  const isWorking =
                    workingKey ===
                    `remove-${member.user_id}`;

                  return (
                    <article
                      className="grid gap-3 rounded-2xl border bg-white p-4 sm:gap-4 sm:p-5"
                      key={member.user_id}
                    >
                      <div>
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
                      </div>

                      <label className="grid gap-2 text-sm font-medium">
                        Reason category

                        <select
                          className="rounded-xl border px-4 py-3 font-normal"
                          disabled={workingKey !== null}
                          onChange={(event) =>
                            setRemovalCategories((current) => ({
                              ...current,
                              [member.user_id]:
                                event.target.value,
                            }))
                          }
                          required
                          value={
                            removalCategories[
                              member.user_id
                            ] ?? ""
                          }
                        >
                          <option value="">
                            Select a reason
                          </option>

                          <option value="Inactivity">
                            Inactivity
                          </option>

                          <option value="Misconduct">
                            Misconduct
                          </option>

                          <option value="Breach of confidentiality">
                            Breach of confidentiality
                          </option>

                          <option value="Failure to perform assigned duties">
                            Failure to perform assigned duties
                          </option>

                          <option value="Violation of FC Team responsibilities">
                            Violation of FC Team responsibilities
                          </option>

                          <option value="Other">
                            Other
                          </option>
                        </select>
                      </label>

                      <label className="grid gap-2 text-sm font-medium">
                        Removal justification

                        <textarea
                          className="min-h-24 resize-y rounded-xl border px-4 py-3 font-normal leading-6"
                          disabled={workingKey !== null}
                          maxLength={2000}
                          onChange={(event) =>
                            setRemovalReasons((current) => ({
                              ...current,
                              [member.user_id]:
                                event.target.value,
                            }))
                          }
                          placeholder="Provide specific details supporting the removal decision."
                          value={
                            removalReasons[member.user_id] ??
                            ""
                          }
                        />
                      </label>

                      <button
                        className="w-full rounded-xl border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-50 sm:w-fit"
                        disabled={
                          workingKey !== null ||
                          !(
                            removalCategories[
                              member.user_id
                            ] ?? ""
                          ).trim() ||
                          (
                            removalReasons[
                              member.user_id
                            ] ?? ""
                          ).trim().length < 10
                        }
                        onClick={() =>
                          void removeMember(member.user_id)
                        }
                        type="button"
                      >
                        {isWorking
                          ? "Removing member..."
                          : "Remove from FC Team"}
                      </button>
                    </article>
                  );
                })}
            </div>
          </section>
        </>
      )}
    </section>
  );
}