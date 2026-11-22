"use client";

import Link from "next/link";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/browser";
import { ProfileAvatar } from "@/components/profile/ProfileAvatar";
import { FcLogoAvatar } from "@/components/branding/FcLogoAvatar";
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

type SystemInboxMessage = {
  id: string;
  recipient_id: string;
  sender_label: string;
  title: string;
  body: string;
  created_at: string;
};


const MESSAGE_PAGE_SIZE = 10;
const MOBILE_THREAD_SCROLL_THRESHOLD = 8;
const DESKTOP_THREAD_SCROLL_THRESHOLD = 8;

// Short-lived memory-only index for revisiting Messages. Scoped by the
// authenticated member so another login cannot display previous account data.
// Always refresh in the background to catch new conversations and unread items.
type MessagingIndexSnapshot = {
  userId: string;
  timestamp: number;
  connections: Connection[];
  profiles: Profile[];
  conversations: Conversation[];
  systemInboxMessages: SystemInboxMessage[];
  unreadMessageNotifications: UnreadMessageNotification[];
  channelActivity: Record<string, string>;
};
let cachedMessagingIndex: MessagingIndexSnapshot | null = null;
const MESSAGE_INDEX_CACHE_MS = 2 * 60 * 1000;

function ScrollableConversationList({
  children,
  className,
  itemCount,
  threshold,
}: {
  children: React.ReactNode;
  className: string;
  itemCount: number;
  threshold: number;
}) {
  const listRef = useRef<HTMLDivElement | null>(null);
  const [maxHeight, setMaxHeight] = useState<number | null>(null);

  useEffect(() => {
    if (itemCount <= threshold) {
      setMaxHeight(null);
      return;
    }

    const list = listRef.current;
    if (!list) return;

    const firstVisibleItems = Array.from(list.children).slice(
      0,
      threshold
    ) as HTMLElement[];

    if (firstVisibleItems.length !== threshold) return;

    function measure() {
      if (!list) return;

      const gap =
        Number.parseFloat(getComputedStyle(list).rowGap) || 0;
      const height =
        firstVisibleItems.reduce(
          (total, item) => total + item.getBoundingClientRect().height,
          0
        ) + gap * (threshold - 1);

      if (height > 0) {
        setMaxHeight(Math.ceil(height));
      }
    }

    measure();

    const observer =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(measure)
        : null;

    firstVisibleItems.forEach((item) => observer?.observe(item));
    window.addEventListener("resize", measure);

    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [children, itemCount, threshold]);

  return (
    <div
      ref={listRef}
      aria-label="Conversations"
      className={`${className} ${
        itemCount > threshold
          ? "overflow-y-auto overscroll-auto pr-2"
          : ""
      }`}
      style={
        itemCount > threshold
          ? { maxHeight: maxHeight ?? "38rem" }
          : undefined
      }
      tabIndex={itemCount > threshold ? 0 : undefined}
    >
      {children}
    </div>
  );
}

export function MessagingWorkflow() {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [channelActivity, setChannelActivity] = useState<Record<string, string>>({});
  const [messages, setMessages] = useState<Message[]>([]);
  const [systemInboxMessages, setSystemInboxMessages] =
    useState<SystemInboxMessage[]>([]);
  const [activeSystemMessageId, setActiveSystemMessageId] =
    useState<string | null>(null);
  const [unreadMessageNotifications, setUnreadMessageNotifications] =
    useState<UnreadMessageNotification[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [activeConnectionId, setActiveConnectionId] = useState<string | null>(null);
  const [draftMessage, setDraftMessage] = useState("");
  const [conversationSearchOpen, setConversationSearchOpen] = useState(false);
  const [conversationSearch, setConversationSearch] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isWorking, setIsWorking] = useState(false);
  const [hasOlderMessages, setHasOlderMessages] =
    useState(false);
  const [isLoadingOlderMessages, setIsLoadingOlderMessages] =
    useState(false);

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

  const activeSystemMessage =
    systemInboxMessages.find(
      (item) => item.id === activeSystemMessageId
    ) ?? null;

  const chatConnections = useMemo(() => {
    return connections;
  }, [connections]);



  const orderedChannels = useMemo(() => {
    const items = [
      ...systemInboxMessages.map((item) => ({ kind: "system" as const, id: item.id, activityAt: item.created_at, item })),
      ...chatConnections.map((connection) => ({
        kind: "chat" as const, id: connection.id,
        activityAt: channelActivity[conversationByConnectionId.get(connection.id)?.id ?? ""] ?? null,
        connection,
      })),
    ];
    return items.sort((a, b) => {
      const delta = (b.activityAt ? Date.parse(b.activityAt) : 0) -
        (a.activityAt ? Date.parse(a.activityAt) : 0);
      return delta || a.id.localeCompare(b.id);
    });
  }, [systemInboxMessages, chatConnections, channelActivity, conversationByConnectionId]);

  const filteredChannels = useMemo(() => {
    const search = conversationSearch.trim().toLocaleLowerCase();
    if (!search) return orderedChannels;

    return orderedChannels.filter((channel) => {
      if (channel.kind === "system") {
        return channel.item.sender_label.toLocaleLowerCase().includes(search);
      }

      const connection = channel.connection;
      const otherId = connection.requester_id === currentUserId
        ? connection.recipient_id
        : connection.requester_id;
      const person = profileById.get(otherId);
      return [person?.display_name, person?.username].some(
        (name) => name?.toLocaleLowerCase().includes(search)
      );
    });
  }, [orderedChannels, conversationSearch, currentUserId, profileById]);

  async function refreshChannelActivity(ids: string[]) {
    if (!isSupabaseConfigured() || ids.length === 0) return;
    const supabase = getSupabaseBrowserClient();
    const latest: Record<string, string> = {};
    for (let index = 0; index < ids.length; index += 100) {
      const { data, error } = await supabase.from("conversations")
        .select("id, messages(created_at)")
        .in("id", ids.slice(index, index + 100))
        .order("created_at", { ascending: false, referencedTable: "messages" })
        .limit(1, { referencedTable: "messages" });
      if (error) {
        console.error("Unable to refresh message channel activity:", error);
        return;
      }
      for (const row of data ?? []) {
        const latestMessage = Array.isArray(row.messages) ? row.messages[0] : null;
        if (latestMessage?.created_at) latest[row.id] = latestMessage.created_at;
      }
    }
    setChannelActivity((current) => ({ ...current, ...latest }));
  }

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

      if (
        cachedMessagingIndex?.userId === userId &&
        Date.now() - cachedMessagingIndex.timestamp < MESSAGE_INDEX_CACHE_MS
      ) {
        setConnections(cachedMessagingIndex.connections);
        setProfiles(cachedMessagingIndex.profiles);
        setConversations(cachedMessagingIndex.conversations);
        setSystemInboxMessages(cachedMessagingIndex.systemInboxMessages);
        setUnreadMessageNotifications(cachedMessagingIndex.unreadMessageNotifications);
        setChannelActivity(cachedMessagingIndex.channelActivity);
        setIsLoading(false);
      }

      // The first batch is limited to this account's connections, unread
      // items and inbox. Do not download every profile in the system.
      const [
        { data: connectionData, error: connectionError },
        { data: unreadNotificationData, error: unreadNotificationError },
        { data: systemInboxData, error: systemInboxError },
      ] = await Promise.all([
        supabase
          .from("connections")
          .select("id, requester_id, recipient_id, status")
          .eq("status", "accepted")
          .or(`requester_id.eq.${userId},recipient_id.eq.${userId}`),
        supabase
          .from("notifications")
          .select("id, actor_id, read_at")
          .eq("recipient_id", userId)
          .eq("notification_type", "new_message")
          .is("read_at", null),
        supabase
          .from("system_inbox_messages")
          .select("id, recipient_id, sender_label, title, body, created_at")
          .eq("recipient_id", userId)
          .order("created_at", { ascending: false }),
      ]);

      if (connectionError) throw connectionError;
      if (unreadNotificationError) throw unreadNotificationError;
      if (systemInboxError) throw systemInboxError;

      const acceptedConnections = (connectionData ?? []) as Connection[];
      const unreadRows = (unreadNotificationData ?? []) as UnreadMessageNotification[];
      const inboxRows = (systemInboxData ?? []) as SystemInboxMessage[];

      const connectionIds = acceptedConnections.map((connection) => connection.id);
      const contactIds = Array.from(new Set([
        userId,
        ...acceptedConnections.map((connection) =>
          connection.requester_id === userId
            ? connection.recipient_id
            : connection.requester_id
        ),
      ]));

      // Fetch only connected members' public profile details, and the
      // conversations themselves, concurrently in this second network round.
      const profileChunks: string[][] = [];
      for (let i = 0; i < contactIds.length; i += 100) {
        profileChunks.push(contactIds.slice(i, i + 100));
      }
      const [profileBatches, conversationResult] = await Promise.all([
        Promise.all(profileChunks.map(async (ids) => {
          const { data, error } = await supabase
            .from("profiles")
            .select("id, display_name, username, role_type, field, avatar_url")
            .in("id", ids)
            .is("deleted_at", null);
          if (error) throw error;
          return (data ?? []) as Profile[];
        })),
        connectionIds.length
          ? supabase
            .from("conversations")
            .select("id, connection_id")
            .in("connection_id", connectionIds)
          : Promise.resolve({ data: [] as Conversation[], error: null }),
      ]);
      if (conversationResult.error) throw conversationResult.error;

      const visibleProfiles = profileBatches.flat();
      const visibleIds = new Set(visibleProfiles.map((profile) => profile.id));
      const missingContactIds = contactIds.filter((id) => !visibleIds.has(id));

      // Keep the existing private-profile identity policy exactly as before.
      const privateChunks: string[][] = [];
      for (let i = 0; i < missingContactIds.length; i += 100) {
        privateChunks.push(missingContactIds.slice(i, i + 100));
      }
      const privateBatches = await Promise.all(privateChunks.map(async (ids) => {
        const { data, error } = await supabase.rpc(
          "get_discoverable_member_cards", { target_ids: ids }
        );
        if (error) {
          console.warn("Unable to resolve private contact names:", error);
          return [] as Profile[];
        }
        return (data ?? []) as Profile[];
      }));

      const contactProfiles = [...visibleProfiles, ...privateBatches.flat()];
      const visibleConversations = (conversationResult.data ?? []) as Conversation[];

      setConnections(acceptedConnections);
      setProfiles(contactProfiles);
      setSystemInboxMessages(inboxRows);
      setUnreadMessageNotifications(unreadRows);
      setConversations(visibleConversations);
      setMessages([]);
      setHasOlderMessages(false);

      cachedMessagingIndex = {
        userId,
        timestamp: Date.now(),
        connections: acceptedConnections,
        profiles: contactProfiles,
        conversations: visibleConversations,
        systemInboxMessages: inboxRows,
        unreadMessageNotifications: unreadRows,
        channelActivity: cachedMessagingIndex?.userId === userId
          ? cachedMessagingIndex.channelActivity : {},
      };

      // Channel ordering can refine in the background. Never hold the whole
      // Messages page behind the extra last-message activity request.
      setIsLoading(false);
      if (visibleConversations.length > 0) {
        void refreshChannelActivity(visibleConversations.map((item) => item.id));
      } else {
        setChannelActivity({});
      }
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
          void refreshChannelActivity(conversations.map((item) => item.id));
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [currentUserId, conversations]);

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
          void refreshChannelActivity([activeConversationId]);
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

  function openSystemMessage(item: SystemInboxMessage) {
    setActiveSystemMessageId(item.id);
    setActiveConnectionId(null);
    setActiveConversationId(null);
    setMessages([]);
    setHasOlderMessages(false);
  }

  async function openConversation(connection: Connection) {
    if (!currentUserId || !isSupabaseConfigured()) return;

    setActiveSystemMessageId(null);
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
    setActiveSystemMessageId(null);
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
      setChannelActivity((current) => ({ ...current, [activeConversationId]: createdMessage.created_at }));

      setDraftMessage("");
      scrollMessagesToBottom();
    } catch (error) {
      setMessage(getActionErrorMessage(error, "send message"));
    } finally {
      setIsWorking(false);
    }
  }

  function renderChannelItem(channel: (typeof orderedChannels)[number], mobile: boolean) {
    if (channel.kind === "system") {
      const item = channel.item;
      return (
        <button key={`system-${item.id}`}
          className={`w-full rounded-xl border p-3 text-left ${activeSystemMessageId === item.id ? "bg-gray-100" : ""}`}
          onClick={() => openSystemMessage(item)} type="button">
          <span className="flex min-w-0 items-center gap-3">
            <FcLogoAvatar size={mobile ? 36 : 32} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold leading-snug">{item.sender_label}</span>
              <span className="mt-0.5 block truncate text-xs text-gray-600">{item.title}</span>
            </span>
          </span>
        </button>
      );
    }
    const connection = channel.connection;
    const profile = getOtherProfile(connection);
    const otherUserId = connection.requester_id === currentUserId
      ? connection.recipient_id : connection.requester_id;
    const unreadCount = unreadMessagesBySender.get(otherUserId) ?? 0;
    return (
      <button key={`chat-${connection.id}`}
        className={`w-full rounded-xl border p-3 text-left ${activeConnectionId === connection.id ? "bg-gray-100" : ""}`}
        disabled={isWorking} onClick={() => openConversation(connection)} type="button">
        <span className="flex min-w-0 items-center gap-3">
          <span className="relative shrink-0">
            <ProfileAvatar avatarPath={profile?.avatar_url} displayName={profile?.display_name} size={mobile ? 36 : 32} />
            {onlineUserIds.has(otherUserId) && (
              <span aria-label="Online" className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-green-500" title="Online" />
            )}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold leading-snug">{profile?.display_name ?? "Unknown profile"}</span>
            <span className="mt-0.5 block truncate text-xs text-gray-600">
              {[profile?.role_type, profile?.field].filter(Boolean).join(" - ") || "Connection"}
            </span>
          </span>
          {unreadCount > 0 && (
            <span className="ml-auto inline-flex min-w-6 shrink-0 items-center justify-center rounded-full bg-blue-700 px-2 py-1 text-xs font-semibold text-white">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </span>
      </button>
    );
  }

  const activeConnection = connections.find((connection) => connection.id === activeConnectionId);
  const activeProfile = activeConnection ? getOtherProfile(activeConnection) : null;
  const hasActiveThread =
    Boolean(activeConversationId) ||
    Boolean(activeSystemMessage);

  return (
    <section className="mx-auto grid w-full max-w-6xl gap-4 px-3 pb-1 pt-4 sm:gap-6 sm:px-6 sm:py-8 lg:grid-cols-[320px_minmax(0,1fr)]">
      <aside
        className={`min-w-0 rounded-xl border bg-white p-3 sm:p-4 ${
          hasActiveThread
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

        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold">Messages</h2>
          <button
            aria-label={conversationSearchOpen ? "Close conversation search" : "Search conversations"}
            aria-expanded={conversationSearchOpen}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border text-gray-700 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            onClick={() => {
              setConversationSearchOpen((open) => !open);
              setConversationSearch("");
            }}
            title="Search conversations by name"
            type="button"
          >
            <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8">
              <circle cx="10.8" cy="10.8" r="6.5" />
              <path strokeLinecap="round" d="m16 16 5 5" />
            </svg>
          </button>
        </div>

        {conversationSearchOpen && (
          <div className="mb-3">
            <input
              aria-label="Search conversations by name"
              autoFocus
              className="w-full min-w-0 rounded-lg border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
              onChange={(event) => setConversationSearch(event.target.value)}
              placeholder="Search people by name..."
              type="search"
              value={conversationSearch}
            />
          </div>
        )}

        {isLoading ? (
          <p className="text-sm text-gray-600">
            Loading messages...
          </p>
        ) : connections.length === 0 &&
          systemInboxMessages.length === 0 ? (
          <p className="rounded-xl border border-dashed p-4 text-sm text-gray-600">
            No messages yet.
          </p>
        ) : filteredChannels.length === 0 ? (
          <p className="rounded-xl border border-dashed p-4 text-sm text-gray-600">
            No conversations match your search.
          </p>
        ) : (
          <>
            <ScrollableConversationList
              className="flex flex-col gap-2 lg:hidden"
              itemCount={filteredChannels.length}
              threshold={MOBILE_THREAD_SCROLL_THRESHOLD}
            >
              {filteredChannels.map((channel) => renderChannelItem(channel, true))}
            </ScrollableConversationList>
            <ScrollableConversationList
              className="hidden flex-col gap-3 lg:flex"
              itemCount={filteredChannels.length}
              threshold={DESKTOP_THREAD_SCROLL_THRESHOLD}
            >
              {filteredChannels.map((channel) => renderChannelItem(channel, false))}
            </ScrollableConversationList>
          </>
        )}
      </aside>

      <main
        data-message-report-boundary
        className={`h-[78dvh] min-h-[500px] min-w-0 flex-col overflow-hidden rounded-xl border bg-white sm:h-[72vh] sm:min-h-[520px] lg:flex ${
          hasActiveThread
            ? "flex"
            : "hidden"
        }`}
      >
        <div className="flex min-w-0 items-center gap-3 border-b p-3 sm:p-4">
          {hasActiveThread && (
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

          {activeSystemMessage ? (
            <div className="flex min-w-0 items-center gap-3">
              <FcLogoAvatar size={40} />
              <div className="min-w-0">
                <h2 className="truncate text-sm font-semibold leading-snug sm:text-xl">
                  {activeSystemMessage.sender_label}
                </h2>
                <p className="truncate text-xs text-gray-500 sm:text-sm">
                  {activeSystemMessage.title}
                </p>
              </div>
            </div>
          ) : activeProfile ? (
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
          className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-auto p-3 sm:p-4"
          onScroll={handleMessageScroll}
        >
          {activeSystemMessage ? (
            <>
              <div className="flex w-full items-center gap-3 py-1">
                <span className="h-px flex-1 bg-gray-200" />
                <span className="shrink-0 text-[11px] font-medium text-gray-500">
                  {formatMessageDateLabel(
                    activeSystemMessage.created_at,
                    currentLocalDate
                  )}
                </span>
                <span className="h-px flex-1 bg-gray-200" />
              </div>

              <article className="flex max-w-[88%] gap-2 self-start rounded-xl border p-3 text-sm sm:max-w-2xl sm:gap-3">
                <FcLogoAvatar size={28} />

                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium sm:text-sm">
                    {activeSystemMessage.sender_label}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap leading-snug text-gray-800">
                    {activeSystemMessage.body}
                  </p>
                  <p className="mt-1 text-left text-[10px] text-gray-500">
                    {formatMessageTime(
                      activeSystemMessage.created_at
                    )}
                  </p>
                </div>
              </article>
            </>
          ) : !activeConversationId ? null : activeMessages.length ===
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
                              constrainToMessagePanel
                              menuAlign="left"
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

        {!activeSystemMessage && (
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
        )}
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
