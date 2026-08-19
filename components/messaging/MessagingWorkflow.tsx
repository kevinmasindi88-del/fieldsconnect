"use client";

import Link from "next/link";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/browser";
import { ProfileAvatar } from "@/components/profile/ProfileAvatar";
import { ReportMenu } from "@/components/moderation/ReportMenu";
import { useOnlinePresence } from "@/components/navigation/AppShell";
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
  avatar_url: string | null;
};

type Connection = {
  id: string;
  requester_id: string;
  recipient_id: string;
  status: "pending" | "accepted" | "declined" | "cancelled";
};

type Conversation = {
  id: string;
  connection_id: string;
};

type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
};

type UnreadMessageNotification = {
  id: string;
  actor_id: string | null;
  read_at: string | null;
};


const MESSAGE_PAGE_SIZE = 10;
const MOBILE_THREAD_PAGE_SIZE = 10;

export function MessagingWorkflow() {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [unreadMessageNotifications, setUnreadMessageNotifications] =
    useState<UnreadMessageNotification[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [activeConnectionId, setActiveConnectionId] = useState<string | null>(null);
  const [draftMessage, setDraftMessage] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isWorking, setIsWorking] = useState(false);
  const [hasOlderMessages, setHasOlderMessages] =
    useState(false);
  const [isLoadingOlderMessages, setIsLoadingOlderMessages] =
    useState(false);
  const [mobileThreadOffset, setMobileThreadOffset] =
    useState(0);
  const [currentLocalDate, setCurrentLocalDate] =
    useState(() => new Date());
  const onlineUserIds =
    useOnlinePresence();
  const messageScrollRef =
    useRef<HTMLDivElement | null>(null);
  const handledConnectionDeepLinkRef =
    useRef<string | null>(null);

  const profileById = useMemo(() => {
    return new Map(profiles.map((profile) => [profile.id, profile]));
  }, [profiles]);

  const conversationByConnectionId = useMemo(() => {
    return new Map(conversations.map((conversation) => [conversation.connection_id, conversation]));
  }, [conversations]);

  const activeMessages = messages.filter(
    (item) =>
      item.conversation_id ===
      activeConversationId
  );

  const chatConnections = useMemo(() => {
    return connections;
  }, [connections]);

  const visibleMobileChatConnections =
    chatConnections.slice(
      mobileThreadOffset,
      mobileThreadOffset +
        MOBILE_THREAD_PAGE_SIZE
    );

  const hasPreviousMobileChatConnections =
    mobileThreadOffset > 0;

  const hasMoreMobileChatConnections =
    mobileThreadOffset +
      MOBILE_THREAD_PAGE_SIZE <
    chatConnections.length;

  const unreadMessagesBySender = useMemo(() => {
    const counts = new Map<string, number>();

    unreadMessageNotifications.forEach((notification) => {
      if (!notification.actor_id || notification.read_at) return;

      counts.set(
        notification.actor_id,
        (counts.get(notification.actor_id) ?? 0) + 1
      );
    });

    return counts;
  }, [unreadMessageNotifications]);

  async function loadUnreadMessageNotifications(userId: string) {
    if (!isSupabaseConfigured()) return;

    const supabase = getSupabaseBrowserClient();

    const { data, error } = await supabase
      .from("notifications")
      .select("id, actor_id, read_at")
      .eq("recipient_id", userId)
      .eq("notification_type", "new_message")
      .is("read_at", null);

    if (error) {
      console.error("Unable to refresh unread message notifications:", error);
      return;
    }

    setUnreadMessageNotifications(
      (data ?? []) as UnreadMessageNotification[]
    );
  }

  function scrollMessagesToBottom() {
    window.requestAnimationFrame(() => {
      const container = messageScrollRef.current;

      if (!container) return;

      container.scrollTop =
        container.scrollHeight;
    });
  }

  function mergeMessages(
    current: Message[],
    incoming: Message[]
  ) {
    const byId = new Map<string, Message>();

    current.forEach((item) => {
      byId.set(item.id, item);
    });

    incoming.forEach((item) => {
      byId.set(item.id, item);
    });

    return Array.from(byId.values()).sort(
      (left, right) =>
        new Date(left.created_at).getTime() -
        new Date(right.created_at).getTime()
    );
  }

  async function loadLatestConversationMessages(
    conversationId: string,
    preserveExisting = false,
    shouldScrollToBottom = true
  ) {
    if (!isSupabaseConfigured()) return;

    const supabase =
      getSupabaseBrowserClient();

    const { data, error } = await supabase
      .from("messages")
      .select(
        "id, conversation_id, sender_id, body, created_at"
      )
      .eq(
        "conversation_id",
        conversationId
      )
      .is("deleted_at", null)
      .order(
        "created_at",
        { ascending: false }
      )
      .limit(MESSAGE_PAGE_SIZE);

    if (error) {
      console.error(
        "Unable to refresh conversation messages:",
        error
      );
      return;
    }

    const latestMessages =
      ((data ?? []) as Message[])
        .reverse();

    if (preserveExisting) {
      setMessages((current) =>
        mergeMessages(
          current.filter(
            (item) =>
              item.conversation_id ===
              conversationId
          ),
          latestMessages
        )
      );
    } else {
      setMessages(latestMessages);

      setHasOlderMessages(
        latestMessages.length ===
          MESSAGE_PAGE_SIZE
      );
    }

    if (shouldScrollToBottom) {
      scrollMessagesToBottom();
    }
  }

  async function loadOlderMessages(
    conversationId: string
  ) {
    if (
      !isSupabaseConfigured() ||
      isLoadingOlderMessages ||
      !hasOlderMessages
    ) {
      return;
    }

    const conversationMessages =
      messages
        .filter(
          (item) =>
            item.conversation_id ===
            conversationId
        )
        .sort(
          (left, right) =>
            new Date(
              left.created_at
            ).getTime() -
            new Date(
              right.created_at
            ).getTime()
        );

    const oldestMessage =
      conversationMessages[0];

    if (!oldestMessage) return;

    const container =
      messageScrollRef.current;

    const previousScrollHeight =
      container?.scrollHeight ?? 0;

    setIsLoadingOlderMessages(true);

    try {
      const supabase =
        getSupabaseBrowserClient();

      const { data, error } =
        await supabase
          .from("messages")
          .select(
            "id, conversation_id, sender_id, body, created_at"
          )
          .eq(
            "conversation_id",
            conversationId
          )
          .is("deleted_at", null)
          .lt(
            "created_at",
            oldestMessage.created_at
          )
          .order(
            "created_at",
            { ascending: false }
          )
          .limit(MESSAGE_PAGE_SIZE);

      if (error) throw error;

      const olderMessages =
        ((data ?? []) as Message[])
          .reverse();

      setMessages((current) =>
        mergeMessages(
          current,
          olderMessages
        )
      );

      setHasOlderMessages(
        olderMessages.length ===
          MESSAGE_PAGE_SIZE
      );

      window.requestAnimationFrame(
        () => {
          const nextContainer =
            messageScrollRef.current;

          if (!nextContainer) return;

          const addedHeight =
            nextContainer.scrollHeight -
            previousScrollHeight;

          nextContainer.scrollTop +=
            addedHeight;
        }
      );
    } catch (error) {
      console.error(
        "Unable to load earlier messages:",
        error
      );
    } finally {
      setIsLoadingOlderMessages(false);
    }
  }

  function handleMessageScroll() {
    const container =
      messageScrollRef.current;

    if (
      !container ||
      container.scrollTop > 40 ||
      !activeConversationId ||
      !hasOlderMessages ||
      isLoadingOlderMessages
    ) {
      return;
    }

    void loadOlderMessages(
      activeConversationId
    );
  }
  async function loadData() {
    setMessage(null);

    if (!isSupabaseConfigured()) {
      setMessage("Supabase is not configured yet. Messaging will work once environment variables are set.");
      setIsLoading(false);
      return;
    }

    try {
      const supabase = getSupabaseBrowserClient();
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

      if (sessionError) throw sessionError;

      const userId = sessionData.session?.user.id;

      if (!userId) {
        setMessage("Please log in before using messages.");
        setIsLoading(false);
        return;
      }

      setCurrentUserId(userId);

      const [
        { data: connectionData, error: connectionError },
        { data: profileData, error: profileError },
        { data: unreadNotificationData, error: unreadNotificationError },
      ] = await Promise.all([
        supabase
          .from("connections")
          .select("id, requester_id, recipient_id, status")
          .eq("status", "accepted")
          .or(`requester_id.eq.${userId},recipient_id.eq.${userId}`),
        supabase
          .from("profiles")
          .select("id, display_name, username, role_type, field, avatar_url")
          .is("deleted_at", null),
        supabase
          .from("notifications")
          .select("id, actor_id, read_at")
          .eq("notification_type", "new_message")
          .is("read_at", null),
      ]);

      if (connectionError) throw connectionError;
      if (profileError) throw profileError;
      if (unreadNotificationError) throw unreadNotificationError;

      const acceptedConnections = (connectionData ?? []) as Connection[];
      setConnections(acceptedConnections);
      setProfiles((profileData ?? []) as Profile[]);
      setUnreadMessageNotifications(
        (unreadNotificationData ?? []) as UnreadMessageNotification[]
      );

      const connectionIds = acceptedConnections.map((connection) => connection.id);

      if (connectionIds.length === 0) {
        setConversations([]);
        setMessages([]);
        setIsLoading(false);
        return;
      }

      const { data: conversationData, error: conversationError } = await supabase
        .from("conversations")
        .select("id, connection_id")
        .in("connection_id", connectionIds);

      if (conversationError) throw conversationError;

      const visibleConversations = (conversationData ?? []) as Conversation[];
      setConversations(visibleConversations);

      setMessages([]);
      setHasOlderMessages(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load messaging data.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      const nextDate = new Date();

      setCurrentLocalDate((currentDate) =>
        getLocalDateKey(currentDate) ===
        getLocalDateKey(nextDate)
          ? currentDate
          : nextDate
      );
    }, 60_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    if (
      isLoading ||
      !currentUserId ||
      activeConnectionId ||
      isWorking ||
      connections.length === 0
    ) {
      return;
    }

    const requestedConnectionId =
      new URLSearchParams(window.location.search).get("connection");

    if (!requestedConnectionId) return;

    if (
      handledConnectionDeepLinkRef.current ===
      requestedConnectionId
    ) {
      return;
    }

    handledConnectionDeepLinkRef.current =
      requestedConnectionId;

    const requestedConnection = connections.find(
      (connection) => connection.id === requestedConnectionId
    );

    if (!requestedConnection) {
      setMessage(
        "That connection is not available for messaging."
      );
      return;
    }

    void openConversation(requestedConnection);
  }, [
    isLoading,
    currentUserId,
    activeConnectionId,
    isWorking,
    connections,
  ]);

  useEffect(() => {
    if (!currentUserId || !isSupabaseConfigured()) return;

    const supabase = getSupabaseBrowserClient();

    const channel = supabase
      .channel(`messages-page-notifications:${currentUserId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `recipient_id=eq.${currentUserId}`,
        },
        () => {
          void loadUnreadMessageNotifications(currentUserId);
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [currentUserId]);

  useEffect(() => {
    if (!activeConversationId || !isSupabaseConfigured()) return;

    const supabase = getSupabaseBrowserClient();

    const channel = supabase
      .channel(`messages-page-conversation:${activeConversationId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${activeConversationId}`,
        },
        () => {
          const container =
            messageScrollRef.current;

          const isNearBottom =
            !container ||
            container.scrollHeight -
              container.scrollTop -
              container.clientHeight <
              80;

          void loadLatestConversationMessages(
            activeConversationId,
            true,
            isNearBottom
          );
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [activeConversationId]);

  function getOtherProfile(connection: Connection) {
    const otherId = connection.requester_id === currentUserId ? connection.recipient_id : connection.requester_id;
    return profileById.get(otherId);
  }

  async function openConversation(connection: Connection) {
    if (!currentUserId || !isSupabaseConfigured()) return;

    setIsWorking(true);
    setMessage(null);

    const otherUserId =
      connection.requester_id === currentUserId
        ? connection.recipient_id
        : connection.requester_id;

    try {
      const supabase = getSupabaseBrowserClient();

      const { error: readError } = await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("notification_type", "new_message")
        .eq("actor_id", otherUserId)
        .is("read_at", null);

      if (readError) {
        console.error("Unable to mark message notifications as read:", readError);
      }

      setUnreadMessageNotifications((current) =>
        current.filter((notification) => notification.actor_id !== otherUserId)
      );

      const existing = conversationByConnectionId.get(connection.id);

      if (existing) {
        setActiveConnectionId(
          connection.id
        );
        setActiveConversationId(
          existing.id
        );

        setMessages([]);
        setHasOlderMessages(false);

        await loadLatestConversationMessages(
          existing.id,
          false,
          true
        );

        return;
      }

      const { data: conversationId, error } = await supabase.rpc(
        "get_or_create_conversation",
        {
          p_connection_id: connection.id,
        }
      );

      if (error) throw new Error(error.message);

      if (!conversationId) {
        throw new Error("The conversation could not be created.");
      }

      const createdConversation:
        Conversation = {
          id: conversationId,
          connection_id: connection.id,
        };

      setConversations((current) =>
        current.some(
          (item) =>
            item.id === conversationId
        )
          ? current
          : [
              ...current,
              createdConversation,
            ]
      );

      setActiveConnectionId(
        connection.id
      );

      setActiveConversationId(
        conversationId
      );

      setMessages([]);
      setHasOlderMessages(false);

      await loadLatestConversationMessages(
        conversationId,
        false,
        true
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to open conversation."
      );
    } finally {
      setIsWorking(false);
    }
  }

  function closeMobileConversation() {
    setActiveConnectionId(null);
    setActiveConversationId(null);
    setMessages([]);
    setHasOlderMessages(false);
  }

  async function sendMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!currentUserId || !activeConversationId || !draftMessage.trim() || !isSupabaseConfigured()) return;

    setIsWorking(true);
    setMessage(null);

    try {
      const supabase = getSupabaseBrowserClient();
      const messageBody = draftMessage.trim();

      const { data: createdMessage, error } = await supabase
        .from("messages")
        .insert({
          conversation_id: activeConversationId,
          sender_id: currentUserId,
          body: messageBody,
        })
        .select(
          "id, conversation_id, sender_id, body, created_at"
        )
        .single();

      if (error) throw error;

      const activeConnection = connections.find(
        (connection) => connection.id === activeConnectionId
      );

      if (activeConnection) {
        const recipientId =
          activeConnection.requester_id === currentUserId
            ? activeConnection.recipient_id
            : activeConnection.requester_id;

        const actor = profiles.find((profile) => profile.id === currentUserId);

        const { error: notificationError } = await supabase.from("notifications").insert({
          recipient_id: recipientId,
          actor_id: currentUserId,
          notification_type: "new_message",
          entity_type: "message",
          entity_id: createdMessage.id,
          title: "New message",
          body: `${actor?.display_name ?? "Someone"} sent you a message.`,
        });

        if (notificationError) {
          console.error("Unable to create new message notification:", notificationError);
        }
      }

      setMessages((current) =>
        mergeMessages(
          current,
          [createdMessage as Message]
        )
      );

      setDraftMessage("");
      scrollMessagesToBottom();
    } catch (error) {
      setMessage(getActionErrorMessage(error, "send message"));
    } finally {
      setIsWorking(false);
    }
  }

  const activeConnection = connections.find((connection) => connection.id === activeConnectionId);
  const activeProfile = activeConnection ? getOtherProfile(activeConnection) : null;

  return (
    <section className="mx-auto grid w-full max-w-6xl gap-4 px-3 pb-1 pt-4 sm:gap-6 sm:px-6 sm:py-8 lg:grid-cols-[320px_minmax(0,1fr)]">
      <aside
        className={`min-w-0 rounded-xl border bg-white p-3 sm:p-4 ${
          activeConversationId
            ? "hidden lg:block"
            : "block"
        }`}
      >
        {message && (
          <p
            className={`mb-3 ${getMessageAlertClass(
              message
            )}`}
          >
            {message}
          </p>
        )}

        {isLoading ? (
          <p className="text-sm text-gray-600">
            Loading messages...
          </p>
        ) : connections.length === 0 ? (
          <p className="rounded-xl border border-dashed p-4 text-sm text-gray-600">
            No accepted connections yet.
          </p>
        ) : (
          <>
            <div className="flex flex-col gap-2 lg:hidden">
              {chatConnections.length === 0 ? (
                <p className="rounded-xl border border-dashed p-4 text-sm text-gray-600">
                  No conversations yet.
                </p>
              ) : (
                <>
                  {visibleMobileChatConnections.map(
                    (connection) => {
                      const profile =
                        getOtherProfile(
                          connection
                        );

                      const otherUserId =
                        connection.requester_id ===
                        currentUserId
                          ? connection.recipient_id
                          : connection.requester_id;

                      const unreadCount =
                        unreadMessagesBySender.get(
                          otherUserId
                        ) ?? 0;

                      return (
                        <button
                          key={
                            connection.id
                          }
                          className="w-full rounded-xl border p-3 text-left"
                          disabled={isWorking}
                          onClick={() =>
                            openConversation(
                              connection
                            )
                          }
                          type="button"
                        >
                          <span className="flex min-w-0 items-center gap-3">
                            <span className="relative shrink-0">
                              <ProfileAvatar
                                avatarPath={
                                  profile?.avatar_url
                                }
                                displayName={
                                  profile?.display_name
                                }
                                size={36}
                              />

                              {onlineUserIds.has(
                                otherUserId
                              ) && (
                                <span
                                  aria-label="Online"
                                  className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-green-500"
                                  title="Online"
                                />
                              )}
                            </span>

                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-semibold leading-snug">
                                {profile?.display_name ??
                                  "Unknown profile"}
                              </span>

                              <span className="mt-0.5 block truncate text-xs text-gray-600">
                                {[
                                  profile?.role_type,
                                  profile?.field,
                                ]
                                  .filter(Boolean)
                                  .join(" - ") ||
                                  "Connection"}
                              </span>
                            </span>

                            {unreadCount > 0 && (
                              <span className="ml-auto inline-flex min-w-6 shrink-0 items-center justify-center rounded-full bg-blue-700 px-2 py-1 text-xs font-semibold text-white">
                                {unreadCount > 99
                                  ? "99+"
                                  : unreadCount}
                              </span>
                            )}
                          </span>
                        </button>
                      );
                    }
                  )}

                  {(hasPreviousMobileChatConnections ||
                    hasMoreMobileChatConnections) && (
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        className="min-h-10 rounded-xl border bg-white px-4 py-2 text-sm font-medium disabled:opacity-40"
                        disabled={
                          !hasPreviousMobileChatConnections
                        }
                        onClick={() =>
                          setMobileThreadOffset(
                            (current) =>
                              Math.max(
                                0,
                                current -
                                  MOBILE_THREAD_PAGE_SIZE
                              )
                          )
                        }
                        type="button"
                      >
                        Previous
                      </button>

                      <button
                        className="min-h-10 rounded-xl border bg-white px-4 py-2 text-sm font-medium disabled:opacity-40"
                        disabled={
                          !hasMoreMobileChatConnections
                        }
                        onClick={() =>
                          setMobileThreadOffset(
                            (current) =>
                              current +
                              MOBILE_THREAD_PAGE_SIZE
                          )
                        }
                        type="button"
                      >
                        Load more
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="hidden flex-col gap-3 lg:flex">
              {connections.map(
                (connection) => {
                  const profile =
                    getOtherProfile(
                      connection
                    );

                  const isActive =
                    activeConnectionId ===
                    connection.id;

                  const otherUserId =
                    connection.requester_id ===
                    currentUserId
                      ? connection.recipient_id
                      : connection.requester_id;

                  const unreadCount =
                    unreadMessagesBySender.get(
                      otherUserId
                    ) ?? 0;

                  return (
                    <button
                      key={connection.id}
                      className={`rounded-xl border p-3 text-left text-sm ${
                        isActive
                          ? "bg-gray-100"
                          : ""
                      }`}
                      disabled={isWorking}
                      onClick={() =>
                        openConversation(
                          connection
                        )
                      }
                      type="button"
                    >
                      <span className="flex w-full items-center gap-3">
                        <span className="relative shrink-0">
                          <ProfileAvatar
                            avatarPath={
                              profile?.avatar_url
                            }
                            displayName={
                              profile?.display_name
                            }
                            size={32}
                          />

                          {onlineUserIds.has(
                            otherUserId
                          ) && (
                            <span
                              aria-label="Online"
                              className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-green-500"
                              title="Online"
                            />
                          )}
                        </span>

                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold">
                            {profile?.display_name ??
                              "Unknown profile"}
                          </span>

                          <span className="block truncate text-gray-600">
                            {[
                              profile?.role_type,
                              profile?.field,
                            ]
                              .filter(Boolean)
                              .join(" - ") ||
                              "Accepted connection"}
                          </span>
                        </span>

                        {unreadCount > 0 && (
                          <span className="ml-auto inline-flex min-w-6 items-center justify-center rounded-full bg-blue-700 px-2 py-1 text-xs font-semibold text-white">
                            {unreadCount > 99
                              ? "99+"
                              : unreadCount}
                          </span>
                        )}
                      </span>
                    </button>
                  );
                }
              )}
            </div>
          </>
        )}
      </aside>

      <main
        className={`h-[78dvh] min-h-[500px] min-w-0 flex-col overflow-hidden rounded-xl border bg-white sm:h-[72vh] sm:min-h-[520px] lg:flex ${
          activeConversationId
            ? "flex"
            : "hidden"
        }`}
      >
        <div className="flex min-w-0 items-center gap-3 border-b p-3 sm:p-4">
          {activeConversationId && (
            <button
              aria-label="Back to messages"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border text-lg lg:hidden"
              onClick={
                closeMobileConversation
              }
              type="button"
            >
              ←
            </button>
          )}

          {activeProfile ? (
            <Link
              className="flex min-w-0 items-center gap-3 rounded-lg hover:bg-gray-50"
              href={`/profile/${activeProfile.id}`}
            >
              <span className="relative shrink-0">
                <ProfileAvatar
                  avatarPath={
                    activeProfile.avatar_url
                  }
                  displayName={
                    activeProfile.display_name
                  }
                  size={40}
                />

                {onlineUserIds.has(
                  activeProfile.id
                ) && (
                  <span
                    aria-label="Online"
                    className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-green-500"
                    title="Online"
                  />
                )}
              </span>

              <div className="min-w-0">
                <h2 className="truncate text-sm font-semibold leading-snug sm:text-xl">
                  {
                    activeProfile.display_name
                  }
                </h2>
              </div>
            </Link>
          ) : (
            <div className="hidden lg:block">
              <h2 className="text-xl font-semibold">
                Select a connection
              </h2>
            </div>
          )}
        </div>

        <div
          ref={messageScrollRef}
          className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3 sm:p-4"
          onScroll={handleMessageScroll}
        >
          {!activeConversationId ? null : activeMessages.length ===
            0 ? (
            <p className="rounded-xl border border-dashed p-4 text-sm text-gray-600">
              No messages yet. Send the first message in this 1:1 conversation.
            </p>
          ) : (
            <>
              {hasOlderMessages && (
                <button
                  className="self-center rounded-full border px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                  disabled={
                    isLoadingOlderMessages
                  }
                  onClick={() =>
                    activeConversationId &&
                    void loadOlderMessages(
                      activeConversationId
                    )
                  }
                  type="button"
                >
                  {isLoadingOlderMessages
                    ? "Loading earlier messages..."
                    : "Load earlier messages"}
                </button>
              )}

              {activeMessages.map(
                (item, index) => {
                  const isOwn =
                    item.sender_id ===
                    currentUserId;

                  const sender =
                    profileById.get(
                      item.sender_id
                    );

                  const previousMessage =
                    index > 0
                      ? activeMessages[index - 1]
                      : null;

                  const showDateSeparator =
                    !previousMessage ||
                    getLocalDateKey(
                      new Date(
                        previousMessage.created_at
                      )
                    ) !==
                      getLocalDateKey(
                        new Date(item.created_at)
                      );

                  const dateLabel =
                    formatMessageDateLabel(
                      item.created_at,
                      currentLocalDate
                    );

                  return (
                    <Fragment key={item.id}>
                      {showDateSeparator && (
                        <div className="flex w-full items-center gap-3 py-1">
                          <span className="h-px flex-1 bg-gray-200" />

                          <span className="shrink-0 text-[11px] font-medium text-gray-500">
                            {dateLabel}
                          </span>

                          <span className="h-px flex-1 bg-gray-200" />
                        </div>
                      )}

                    <article

                      className={`flex max-w-[88%] gap-2 rounded-xl border p-3 text-sm sm:max-w-2xl sm:gap-3 ${
                        isOwn
                          ? "self-end bg-gray-100"
                          : "self-start"
                      }`}
                    >
                      {sender ? (
                        <Link
                          className="shrink-0 rounded-full"
                          href={`/profile/${sender.id}`}
                        >
                          <ProfileAvatar
                            avatarPath={
                              sender.avatar_url
                            }
                            displayName={
                              isOwn
                                ? "You"
                                : sender.display_name
                            }
                            size={28}
                          />
                        </Link>
                      ) : (
                        <ProfileAvatar
                          avatarPath={null}
                          displayName="Connection"
                          size={28}
                        />
                      )}

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          {sender ? (
                            <Link
                              className="text-xs font-medium hover:underline sm:text-sm"
                              href={`/profile/${sender.id}`}
                            >
                              {isOwn
                                ? "You"
                                : sender.display_name}
                            </Link>
                          ) : (
                            <p className="text-xs font-medium sm:text-sm">
                              Connection
                            </p>
                          )}

                          {!isOwn && (
                            <ReportMenu
                              targetType="message"
                              targetId={item.id}
                              reportedUserId={
                                item.sender_id
                              }
                              label="message"
                              disabled={
                                isWorking
                              }
                            />
                          )}
                        </div>

                        <p className="mt-1 whitespace-pre-wrap leading-snug text-gray-800">
                          {item.body}
                        </p>

                        <p
                          className={`mt-1 text-[10px] text-gray-500 ${
                            isOwn
                              ? "text-right"
                              : "text-left"
                          }`}
                        >
                          {formatMessageTime(
                            item.created_at
                          )}
                        </p>
                      </div>
                    </article>
                    </Fragment>
                  );
                }
              )}
            </>
          )}
        </div>

        <form
          onSubmit={sendMessage}
          className="flex flex-col gap-3 border-t p-3 sm:flex-row sm:p-4"
        >
          <input
            className="min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm"
            disabled={
              !activeConversationId ||
              isWorking
            }
            value={draftMessage}
            onChange={(event) =>
              setDraftMessage(
                event.target.value
              )
            }
            placeholder="Write a message..."
          />

          <button
            className="min-h-10 rounded-xl bg-gray-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:opacity-50"
            disabled={
              !activeConversationId ||
              !draftMessage.trim() ||
              isWorking
            }
            type="submit"
          >
            Send
          </button>
        </form>
      </main>
    </section>
  );
}
function getLocalDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(
    date.getMonth() + 1
  ).padStart(2, "0");
  const day = String(
    date.getDate()
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatMessageDateLabel(
  createdAt: string,
  currentDate: Date
) {
  const messageDate = new Date(createdAt);

  const todayKey =
    getLocalDateKey(currentDate);

  const yesterday = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth(),
    currentDate.getDate() - 1
  );

  const yesterdayKey =
    getLocalDateKey(yesterday);

  const messageKey =
    getLocalDateKey(messageDate);

  if (messageKey === todayKey) {
    return "Today";
  }

  if (messageKey === yesterdayKey) {
    return "Yesterday";
  }

  return messageDate.toLocaleDateString(
    "en-ZA",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }
  );
}

function formatMessageTime(createdAt: string) {
  return new Date(
    createdAt
  ).toLocaleTimeString(
    "en-ZA",
    {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }
  );
}
