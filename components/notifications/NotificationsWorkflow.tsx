"use client";

import { useEffect, useMemo, useState } from "react";
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
    | "post_commented";
  entity_type: "connection" | "conversation" | "message" | "post" | "comment";
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

export function NotificationsWorkflow() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isWorking, setIsWorking] = useState(false);

  const profileById = useMemo(() => {
    return new Map(profiles.map((profile) => [profile.id, profile]));
  }, [profiles]);

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
      ]);

      if (notificationError) throw notificationError;
      if (profileError) throw profileError;

      setNotifications((notificationData ?? []) as Notification[]);
      setProfiles((profileData ?? []) as Profile[]);
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

  return (
    <section className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-8">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-3xl font-semibold">Notifications</h1>
          <p className="mt-2 text-sm text-gray-600">
            Stay updated on connection activity, messages, likes, and comments.
          </p>
        </div>

        <button
          className="w-fit rounded-lg border px-4 py-2 text-sm font-medium disabled:opacity-50"
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
        <div className="flex flex-col gap-3">
          {notifications.map((notification) => {
            const actor = notification.actor_id ? profileById.get(notification.actor_id) : null;
            const isUnread = !notification.read_at;

            return (
              <article
                key={notification.id}
                className={`flex gap-3 rounded-xl border p-4 ${isUnread ? "bg-gray-50" : ""}`}
              >
                <ProfileAvatar
                  avatarPath={actor?.avatar_url}
                  displayName={actor?.display_name ?? notification.title}
                  size={40}
                />

                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-semibold">{notification.title}</h2>
                      {isUnread && (
                        <span className="rounded-full border px-2 py-1 text-xs font-medium">
                          New
                        </span>
                      )}
                    </div>

                    {notification.body && (
                      <p className="mt-1 text-sm text-gray-700">{notification.body}</p>
                    )}

                    <p className="mt-2 text-xs text-gray-500">
                      {formatDate(notification.created_at)}
                    </p>
                  </div>

                  {isUnread && (
                    <button
                      className="w-fit rounded-lg border px-3 py-2 text-sm font-medium disabled:opacity-50"
                      disabled={isWorking}
                      onClick={() => markAsRead(notification.id)}
                      type="button"
                    >
                      Mark as read
                    </button>
                  )}
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
