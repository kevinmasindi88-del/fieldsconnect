"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/browser";

type Profile = {
  id: string;
  display_name: string;
  username: string | null;
  role_type: string;
  field: string | null;
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

export function MessagingWorkflow() {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [activeConnectionId, setActiveConnectionId] = useState<string | null>(null);
  const [draftMessage, setDraftMessage] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isWorking, setIsWorking] = useState(false);

  const profileById = useMemo(() => {
    return new Map(profiles.map((profile) => [profile.id, profile]));
  }, [profiles]);

  const conversationByConnectionId = useMemo(() => {
    return new Map(conversations.map((conversation) => [conversation.connection_id, conversation]));
  }, [conversations]);

  const activeMessages = messages.filter((item) => item.conversation_id === activeConversationId);

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

      const [{ data: connectionData, error: connectionError }, { data: profileData, error: profileError }] =
        await Promise.all([
          supabase
            .from("connections")
            .select("id, requester_id, recipient_id, status")
            .eq("status", "accepted")
            .or(`requester_id.eq.${userId},recipient_id.eq.${userId}`),
          supabase
            .from("profiles")
            .select("id, display_name, username, role_type, field")
            .is("deleted_at", null),
        ]);

      if (connectionError) throw connectionError;
      if (profileError) throw profileError;

      const acceptedConnections = (connectionData ?? []) as Connection[];
      setConnections(acceptedConnections);
      setProfiles((profileData ?? []) as Profile[]);

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

      const conversationIds = visibleConversations.map((conversation) => conversation.id);

      if (conversationIds.length === 0) {
        setMessages([]);
        return;
      }

      const { data: messageData, error: messageError } = await supabase
        .from("messages")
        .select("id, conversation_id, sender_id, body, created_at")
        .in("conversation_id", conversationIds)
        .is("deleted_at", null)
        .order("created_at", { ascending: true });

      if (messageError) throw messageError;

      setMessages((messageData ?? []) as Message[]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load messaging data.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  function getOtherProfile(connection: Connection) {
    const otherId = connection.requester_id === currentUserId ? connection.recipient_id : connection.requester_id;
    return profileById.get(otherId);
  }

  async function openConversation(connection: Connection) {
    if (!currentUserId || !isSupabaseConfigured()) return;

    setIsWorking(true);
    setMessage(null);

    try {
      const existing = conversationByConnectionId.get(connection.id);

      if (existing) {
        setActiveConnectionId(connection.id);
        setActiveConversationId(existing.id);
        return;
      }

      const supabase = getSupabaseBrowserClient();

      const { data: createdConversation, error: conversationError } = await supabase
        .from("conversations")
        .insert({
          connection_id: connection.id,
        })
        .select("id, connection_id")
        .single();

      if (conversationError) throw conversationError;

      const memberRows = [
        {
          conversation_id: createdConversation.id,
          profile_id: connection.requester_id,
        },
        {
          conversation_id: createdConversation.id,
          profile_id: connection.recipient_id,
        },
      ];

      const { error: membersError } = await supabase.from("conversation_members").insert(memberRows);

      if (membersError) throw membersError;

      setActiveConnectionId(connection.id);
      setActiveConversationId(createdConversation.id);
      await loadData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to open conversation.");
    } finally {
      setIsWorking(false);
    }
  }

  async function sendMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!currentUserId || !activeConversationId || !draftMessage.trim() || !isSupabaseConfigured()) return;

    setIsWorking(true);
    setMessage(null);

    try {
      const supabase = getSupabaseBrowserClient();

      const { error } = await supabase.from("messages").insert({
        conversation_id: activeConversationId,
        sender_id: currentUserId,
        body: draftMessage.trim(),
      });

      if (error) throw error;

      setDraftMessage("");
      await loadData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to send message.");
    } finally {
      setIsWorking(false);
    }
  }

  const activeConnection = connections.find((connection) => connection.id === activeConnectionId);
  const activeProfile = activeConnection ? getOtherProfile(activeConnection) : null;

  return (
    <section className="mx-auto grid w-full max-w-6xl gap-6 p-8 lg:grid-cols-[320px_1fr]">
      <aside className="rounded-xl border p-4">
        <h1 className="text-2xl font-semibold">Messages</h1>
        <p className="mt-2 text-sm text-gray-600">
          MVP messaging is limited to accepted 1:1 connections only.
        </p>

        {message && <p className="mt-4 rounded-lg border p-3 text-sm text-gray-700">{message}</p>}

        <div className="mt-6 flex flex-col gap-3">
          {isLoading ? (
            <p className="text-sm text-gray-600">Loading accepted connections...</p>
          ) : connections.length === 0 ? (
            <p className="rounded-xl border border-dashed p-4 text-sm text-gray-600">
              No accepted connections yet. Connect with someone before messaging.
            </p>
          ) : (
            connections.map((connection) => {
              const profile = getOtherProfile(connection);
              const isActive = activeConnectionId === connection.id;

              return (
                <button
                  key={connection.id}
                  className={`rounded-xl border p-3 text-left text-sm ${isActive ? "bg-gray-100" : ""}`}
                  disabled={isWorking}
                  onClick={() => openConversation(connection)}
                >
                  <span className="block font-semibold">{profile?.display_name ?? "Unknown profile"}</span>
                  <span className="text-gray-600">
                    {[profile?.role_type, profile?.field].filter(Boolean).join(" - ") || "Accepted connection"}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </aside>

      <main className="flex min-h-[520px] flex-col rounded-xl border">
        <div className="border-b p-4">
          <h2 className="text-xl font-semibold">
            {activeProfile ? activeProfile.display_name : "Select an accepted connection"}
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            {activeProfile
              ? "This is a controlled 1:1 MVP conversation."
              : "Only accepted connections can be opened here."}
          </p>
        </div>

        <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
          {!activeConversationId ? (
            <p className="rounded-xl border border-dashed p-4 text-sm text-gray-600">
              Choose an accepted connection to start or continue a conversation.
            </p>
          ) : activeMessages.length === 0 ? (
            <p className="rounded-xl border border-dashed p-4 text-sm text-gray-600">
              No messages yet. Send the first message in this 1:1 conversation.
            </p>
          ) : (
            activeMessages.map((item) => {
              const isOwn = item.sender_id === currentUserId;
              const sender = profileById.get(item.sender_id);

              return (
                <article
                  key={item.id}
                  className={`max-w-2xl rounded-xl border p-3 text-sm ${isOwn ? "self-end bg-gray-100" : "self-start"}`}
                >
                  <p className="font-medium">{isOwn ? "You" : sender?.display_name ?? "Connection"}</p>
                  <p className="mt-1 whitespace-pre-wrap text-gray-800">{item.body}</p>
                </article>
              );
            })
          )}
        </div>

        <form onSubmit={sendMessage} className="flex gap-3 border-t p-4">
          <input
            className="flex-1 rounded-lg border px-3 py-2 text-sm"
            disabled={!activeConversationId || isWorking}
            value={draftMessage}
            onChange={(event) => setDraftMessage(event.target.value)}
            placeholder="Write a message..."
          />
          <button
            className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            disabled={!activeConversationId || !draftMessage.trim() || isWorking}
            type="submit"
          >
            Send
          </button>
        </form>
      </main>
    </section>
  );
}
