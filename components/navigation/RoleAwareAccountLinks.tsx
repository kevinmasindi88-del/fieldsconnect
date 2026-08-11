"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import {
  getSupabaseBrowserClient,
  isSupabaseConfigured,
} from "@/lib/supabase/browser";

type PlatformRole =
  | "user"
  | "moderator"
  | "senior_moderator"
  | "admin";

type RoleAwareAccountLinksProps = {
  pathname: string;
};

function closeAccountDropdown(
  event: React.MouseEvent<HTMLAnchorElement>
) {
  event.currentTarget
    .closest("details")
    ?.removeAttribute("open");
}

function accountLinkClass(isActive: boolean) {
  return [
    "block rounded-lg px-3 py-2 text-sm",
    isActive
      ? "bg-gray-100 font-medium text-gray-950"
      : "text-gray-700 hover:bg-gray-50",
  ].join(" ");
}

export function RoleAwareAccountLinks({
  pathname,
}: RoleAwareAccountLinksProps) {
  const [platformRole, setPlatformRole] =
    useState<PlatformRole>("user");

  const [currentUserId, setCurrentUserId] =
    useState<string | null>(null);

  const [isFcTeamMember, setIsFcTeamMember] =
    useState(false);

  const [isLoading, setIsLoading] = useState(true);

  const realtimeInstanceId = useId();

  useEffect(() => {
    let isMounted = true;

    async function loadRoleAccess() {
      if (!isSupabaseConfigured()) {
        if (isMounted) setIsLoading(false);
        return;
      }

      try {
        const supabase = getSupabaseBrowserClient();

        const { data: sessionData, error: sessionError } =
          await supabase.auth.getSession();

        if (sessionError) throw sessionError;

        if (!sessionData.session?.user) {
          return;
        }

        if (isMounted) {
          setCurrentUserId(
            sessionData.session.user.id
          );
        }

        const [roleResult, teamResult] =
          await Promise.all([
            supabase.rpc("current_platform_role"),
            supabase.rpc("is_fc_team_member"),
          ]);

        if (roleResult.error) throw roleResult.error;
        if (teamResult.error) throw teamResult.error;

        if (!isMounted) return;

        setPlatformRole(
          (roleResult.data ?? "user") as PlatformRole
        );

        setIsFcTeamMember(Boolean(teamResult.data));
      } catch (error) {
        console.error(
          "Unable to load account workspace access:",
          error
        );
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    void loadRoleAccess();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (
      !currentUserId ||
      !isSupabaseConfigured()
    ) {
      return;
    }

    const supabase = getSupabaseBrowserClient();

    const channel = supabase
      .channel(
        `account-fc-team-access-${currentUserId}-${realtimeInstanceId}`
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
          const updatedMembership = payload.new as {
            revoked_at?: string | null;
          };

          const membershipIsActive =
            !updatedMembership.revoked_at;

          setIsFcTeamMember(membershipIsActive);

          if (!membershipIsActive) {
            window.location.replace("/");
          }
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [currentUserId]);

  useEffect(() => {
    if (
      !currentUserId ||
      !isSupabaseConfigured()
    ) {
      return;
    }

    const supabase = getSupabaseBrowserClient();

    const channel = supabase
      .channel(
        `account-fc-team-notifications-${currentUserId}-${realtimeInstanceId}`
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `recipient_id=eq.${currentUserId}`,
        },
        (payload) => {
          const notification = payload.new as {
            notification_type?: string;
          };

          const membershipEnded = [
            "fc_team_removed",
            "fc_team_leave_approved",
          ].includes(
            notification.notification_type ?? ""
          );

          if (!membershipEnded) {
            return;
          }

          setIsFcTeamMember(false);

          window.location.replace("/");
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [currentUserId]);
  const canAccessModeration = [
    "moderator",
    "senior_moderator",
    "admin",
  ].includes(platformRole);

  const canAccessFeedbackReview =
    platformRole === "admin" || isFcTeamMember;

  const canAccessFcTeam =
    platformRole === "admin" || isFcTeamMember;

  if (isLoading) {
    return null;
  }

  return (
    <>
      {canAccessFeedbackReview && (
        <Link
          className={accountLinkClass(
            pathname.startsWith("/feedback/manage")
          )}
          href="/feedback/manage"
          onClick={closeAccountDropdown}
        >
          Feedback Review
        </Link>
      )}

      {canAccessFcTeam && (
        <Link
          className={accountLinkClass(
            pathname.startsWith("/feedback/team")
          )}
          href="/feedback/team"
          onClick={closeAccountDropdown}
        >
          FC Team
        </Link>
      )}

      {canAccessModeration && (
        <Link
          className={accountLinkClass(
            pathname.startsWith("/moderation/dashboard")
          )}
          href="/moderation/dashboard"
          onClick={closeAccountDropdown}
        >
          Moderation
        </Link>
      )}
    </>
  );
}