"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/browser";
import { ProfileAvatar } from "@/components/profile/ProfileAvatar";

type Notification = {
  id: string;
  recipient_id: string;
  actor_id: string | null;
  notification_type:
    | "connection_request"
    | "connection_accepted"
    | "new_message"
    | "post_liked"
    | "post_commented"
    | "comment_liked"
    | "moderation_warning"
    | "moderation_action"
    | "moderation_report"
    | "moderation_assignment"
    | "moderation_outcome"
    | "moderation_escalation"
    | "account_suspension"
  | "new_fc_feedback"
  | "fc_feedback_assignment"
  | "fc_team_activated"
  | "fc_team_recruitment_accepted"
  | "fc_team_recruitment"
  | "fc_team_removed"
  | "fc_team_leave_declined"
  | "fc_team_leave_approved"
  | "fc_team_leave_requested"
  | "fc_feedback_unassigned"
    | "suspension_revoked"
    | "mentorship_completion_feedback";
  entity_type:
    | "connection"
    | "conversation"
    | "message"
    | "post"
    | "comment"
    | "moderation_ticket"
    | "mentorship";
  entity_id: string | null;
  title: string;
  body: string | null;
  read_at: string | null;
  created_at: string;
};

type Profile = {
  id: string;
  display_name: string;
  avatar_url: string | null;
};

type CommentReference = {
  id: string;
  post_id: string;
};

export function NotificationsWorkflow() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [commentReferences, setCommentReferences] = useState<CommentReference[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isWorking, setIsWorking] = useState(false);

  const profileById = useMemo(() => {
    return new Map(profiles.map((profile) => [profile.id, profile]));
  }, [profiles]);

  const postIdByCommentId = useMemo(() => {
    return new Map(commentReferences.map((comment) => [comment.id, comment.post_id]));
  }, [commentReferences]);

  const unreadCount = notifications.filter((notification) => !notification.read_at).length;

  async function loadNotifications() {
    setMessage(null);

    if (!isSupabaseConfigured()) {
      setMessage("Supabase is not configured yet.");
      setIsLoading(false);
      return;
    }

    try {
      const supabase = getSupabaseBrowserClient();
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

      if (sessionError) throw sessionError;

      const userId = sessionData.session?.user.id;

      if (!userId) {
        setMessage("Please log in before viewing notifications.");
        setIsLoading(false);
        return;
      }

      const [
        { data: notificationData, error: notificationError },
        { data: profileData, error: profileError },
        { data: commentData, error: commentError },
      ] = await Promise.all([
        supabase
          .from("notifications")
          .select(
            "id, recipient_id, actor_id, notification_type, entity_type, entity_id, title, body, read_at, created_at"
          )
          .order("created_at", { ascending: false }),
        supabase
          .from("profiles")
          .select("id, display_name, avatar_url")
          .is("deleted_at", null),
        supabase
          .from("comments")
          .select("id, post_id")
          .is("deleted_at", null),
      ]);

      if (notificationError) throw notificationError;
      if (profileError) throw profileError;
      if (commentError) throw commentError;

      setNotifications((notificationData ?? []) as Notification[]);
      setProfiles((profileData ?? []) as Profile[]);
      setCommentReferences((commentData ?? []) as CommentReference[]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load notifications.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadNotifications();
  }, []);

  async function markAsRead(notificationId: string) {
    setIsWorking(true);
    setMessage(null);

    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("id", notificationId);

      if (error) throw error;

      await loadNotifications();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to mark notification as read.");
    } finally {
      setIsWorking(false);
    }
  }

  async function openNotificationPath(notification: Notification, path: string) {
    setIsWorking(true);
    setMessage(null);

    try {
      if (!notification.read_at) {
        const supabase = getSupabaseBrowserClient();
        const { error } = await supabase
          .from("notifications")
          .update({ read_at: new Date().toISOString() })
          .eq("id", notification.id);

        if (error) throw error;
      }

      router.push(path);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to open notification.");
      setIsWorking(false);
    }
  }

  async function markAllAsRead() {
    setIsWorking(true);
    setMessage(null);

    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .is("read_at", null);

      if (error) throw error;

      await loadNotifications();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to mark all notifications as read.");
    } finally {
      setIsWorking(false);
    }
  }

  function getNotificationPostId(notification: Notification) {
    if (notification.entity_type === "post") {
      return notification.entity_id;
    }

    if (notification.entity_type === "comment" && notification.entity_id) {
      return postIdByCommentId.get(notification.entity_id) ?? null;
    }

    return null;
  }

  function getActorName(notification: Notification) {
    if (!notification.actor_id) return "Someone";
    return profileById.get(notification.actor_id)?.display_name ?? "Someone";
  }

  function getNotificationTitle(notification: Notification) {
    const actorName = getActorName(notification);

    switch (notification.notification_type) {
      case "post_liked":
        return `${actorName} liked your post`;
      case "post_commented":
        return `${actorName} commented on your post`;
      case "comment_liked":
        return `${actorName} liked your comment`;
      case "connection_request":
        return `${actorName} sent you a connection request`;
      case "connection_accepted":
        return `${actorName} accepted your connection request`;
      case "new_message":
        return `${actorName} sent you a message`;
      case "moderation_escalation":
        return "Moderation ticket escalated";
      case "account_suspension":
        return notification.title || "FieldsConnect account suspended";
      case "suspension_revoked":
        return notification.title || "FieldsConnect suspension ended";
      default:
        return notification.title;
    }
  }

  function renderNotificationBody(notification: Notification, postId: string | null) {
    const actorName = getActorName(notification);

    if (notification.notification_type === "connection_request") {
      return (
        <>
          {actorName} sent you a connection{" "}
          <button
            className="font-medium text-blue-700 underline underline-offset-2 disabled:opacity-50"
            disabled={isWorking}
            onClick={() => openNotificationPath(notification, "/connections")}
            type="button"
          >
            request
          </button>
          .
        </>
      );
    }

    if (
      notification.entity_type === "moderation_ticket" &&
      notification.entity_id &&
      [
        "moderation_report",
        "moderation_assignment",
        "moderation_escalation",
      ].includes(notification.notification_type)
    ) {
      return (
        <>
          {notification.body}{" "}
          <button
            className="font-medium text-blue-700 underline underline-offset-2 disabled:opacity-50"
            disabled={isWorking}
            onClick={() =>
              openNotificationPath(
                notification,
                `/moderation/review/${notification.entity_id}`
              )
            }
            type="button"
          >
            Open ticket
          </button>
        </>
      );
    }
    if (!postId) {
      return notification.body;
    }

    if (notification.notification_type === "post_liked") {
      return (
        <>
          {actorName} liked your{" "}
          <button
            className="font-medium text-blue-700 underline underline-offset-2 disabled:opacity-50"
            disabled={isWorking}
            onClick={() => openNotificationPath(notification, `/post/${postId}`)}
            type="button"
          >
            post
          </button>
          .
        </>
      );
    }

    if (notification.notification_type === "post_commented") {
      return (
        <>
          {actorName} commented on your{" "}
          <button
            className="font-medium text-blue-700 underline underline-offset-2 disabled:opacity-50"
            disabled={isWorking}
            onClick={() => openNotificationPath(notification, `/post/${postId}`)}
            type="button"
          >
            post
          </button>
          .
        </>
      );
    }

    if (notification.notification_type === "comment_liked") {
      return (
        <>
          {actorName} liked your{" "}
          <button
            className="font-medium text-blue-700 underline underline-offset-2 disabled:opacity-50"
            disabled={isWorking}
            onClick={() => openNotificationPath(notification, `/post/${postId}`)}
            type="button"
          >
            comment
          </button>
          .
        </>
      );
    }

    return notification.body;
  }

  return (
    <section className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-3 py-4 sm:gap-6 sm:p-8">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <button
          className="min-h-10 w-full rounded-lg border px-4 py-2 text-sm font-medium disabled:opacity-50 sm:w-fit"
          disabled={unreadCount === 0 || isWorking}
          onClick={markAllAsRead}
          type="button"
        >
          Mark all as read
        </button>
      </div>

      {message && <p className="rounded-lg border p-3 text-sm text-gray-700">{message}</p>}

      {isLoading ? (
        <p className="text-sm text-gray-600">Loading notifications...</p>
      ) : notifications.length === 0 ? (
        <p className="rounded-xl border border-dashed p-4 text-sm text-gray-600">
          No notifications yet.
        </p>
      ) : (
        <div className="flex flex-col gap-2 sm:gap-3">
          {notifications.map((notification) => {
            const actor = notification.actor_id ? profileById.get(notification.actor_id) : null;
            const isUnread = !notification.read_at;
            const postId = getNotificationPostId(notification);

            return (
              <article
                key={notification.id}
                className={`flex min-w-0 gap-3 rounded-xl border p-3 sm:p-4 ${isUnread ? "bg-gray-50" : ""}`}
              >
                <ProfileAvatar
                  avatarPath={actor?.avatar_url}
                  displayName={actor?.display_name ?? notification.title}
                  size={40}
                />

                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <div>
                    <div className="flex min-w-0 items-start justify-between gap-2">
                      <h2 className="min-w-0 text-sm font-semibold leading-snug sm:text-base">
                        {getNotificationTitle(notification)}
                      </h2>
                      {isUnread && (
                        <span className="shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium sm:py-1 sm:text-xs">
                          New
                        </span>
                      )}
                    </div>

                    {notification.body && (
                      <p className="mt-1 text-sm leading-snug text-gray-700">
                        {renderNotificationBody(notification, postId)}
                      </p>
                    )}

                    {notification.notification_type ===
                      "mentorship_completion_feedback" &&
                      notification.entity_id && (
                        <button
                          className="mt-3 inline-flex w-fit rounded-lg border px-3 py-2 text-sm font-medium text-gray-900 transition hover:bg-gray-50"
                          onClick={() =>
                            router.push(
                              `/mentorships/${notification.entity_id}`
                            )
                          }
                          type="button"
                        >
                          View mentorship
                        </button>
                      )}

                    {notification.notification_type ===
                      "new_fc_feedback" &&
                      notification.entity_id && (
                        <button
                          className="mt-3 inline-flex w-fit rounded-lg border px-3 py-2 text-sm font-medium text-gray-900 transition hover:bg-gray-50"
                          onClick={() =>
                            router.push(
                              `/feedback/manage?submission=${notification.entity_id}`
                            )
                          }
                          type="button"
                        >
                          View feedback
                        </button>
                      )}
                    {notification.notification_type ===
                      "fc_team_recruitment" && (
                        <button
                          className="mt-3 inline-flex w-fit rounded-lg border px-3 py-2 text-sm font-medium text-gray-900 transition hover:bg-gray-50"
                          onClick={() =>
                            router.push("/feedback/team")
                          }
                          type="button"
                        >
                          View invitation
                        </button>
                      )}
                    {notification.notification_type ===
                      "fc_team_recruitment_accepted" && (
                        <button
                          className="mt-3 inline-flex w-fit rounded-lg border px-3 py-2 text-sm font-medium text-gray-900 transition hover:bg-gray-50"
                          onClick={() =>
                            router.push("/feedback/team")
                          }
                          type="button"
                        >
                          Review and activate
                        </button>
                      )}

                    {notification.notification_type ===
                      "fc_team_activated" && (
                        <button
                          className="mt-3 inline-flex w-fit rounded-lg border px-3 py-2 text-sm font-medium text-gray-900 transition hover:bg-gray-50"
                          onClick={() =>
                            router.push("/feedback/team")
                          }
                          type="button"
                        >
                          View FC Team
                        </button>
                      )}

                    {notification.notification_type ===
                      "fc_feedback_assignment" &&
                      notification.entity_id && (
                        <button
                          className="mt-3 inline-flex w-fit rounded-lg border px-3 py-2 text-sm font-medium text-gray-900 transition hover:bg-gray-50"
                          onClick={() =>
                            router.push(
                              `/feedback/manage?ticket=${encodeURIComponent(
                                notification.entity_id!
                              )}`
                            )
                          }
                          type="button"
                        >
                          View assignment
                        </button>
                      )}

                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs text-gray-500">
                      {formatDate(notification.created_at)}
                    </p>

                    {isUnread && (
                      <button
                        className="min-h-9 shrink-0 rounded-lg border px-3 py-1.5 text-xs font-medium disabled:opacity-50 sm:text-sm"
                        disabled={isWorking}
                        onClick={() => markAsRead(notification.id)}
                        type="button"
                      >
                        Mark as read
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}