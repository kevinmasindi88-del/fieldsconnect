"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/browser";
import { ProfileAvatar } from "@/components/profile/ProfileAvatar";

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

export function ConnectionWorkflow() {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isWorking, setIsWorking] = useState(false);

  const profileById = useMemo(() => {
    return new Map(profiles.map((profile) => [profile.id, profile]));
  }, [profiles]);

  const discoverableProfiles = profiles.filter((profile) => {
    if (!currentUserId || profile.id === currentUserId) return false;

    return !connections.some(
      (connection) =>
        (connection.requester_id === currentUserId && connection.recipient_id === profile.id) ||
        (connection.requester_id === profile.id && connection.recipient_id === currentUserId)
    );
  });

  const incomingRequests = connections.filter(
    (connection) => connection.recipient_id === currentUserId && connection.status === "pending"
  );

  const outgoingRequests = connections.filter(
    (connection) => connection.requester_id === currentUserId && connection.status === "pending"
  );

  const acceptedConnections = connections.filter(
    (connection) =>
      connection.status === "accepted" &&
      (connection.requester_id === currentUserId || connection.recipient_id === currentUserId)
  );

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

      const [{ data: profilesData, error: profilesError }, { data: connectionsData, error: connectionsError }] =
        await Promise.all([
          supabase
            .from("profiles")
            .select("id, display_name, username, role_type, field, bio, mentor_available, avatar_url")
            .is("deleted_at", null)
            .order("display_name", { ascending: true }),
          supabase
            .from("connections")
            .select("id, requester_id, recipient_id, status, created_at")
            .or(`requester_id.eq.${userId},recipient_id.eq.${userId}`)
            .order("created_at", { ascending: false }),
        ]);

      if (profilesError) throw profilesError;
      if (connectionsError) throw connectionsError;

      setProfiles((profilesData ?? []) as Profile[]);
      setConnections((connectionsData ?? []) as Connection[]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load connection data.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  async function sendRequest(profileId: string) {
    if (!currentUserId || !isSupabaseConfigured()) return;

    setIsWorking(true);
    setMessage(null);

    try {
      const supabase = getSupabaseBrowserClient();

      const { error } = await supabase.from("connections").insert({
        requester_id: currentUserId,
        recipient_id: profileId,
        status: "pending",
      });

      if (error) throw error;

      setMessage("Connection request sent.");
      await loadData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to send connection request.");
    } finally {
      setIsWorking(false);
    }
  }

  async function updateRequest(connectionId: string, status: "accepted" | "declined") {
    setIsWorking(true);
    setMessage(null);

    try {
      const supabase = getSupabaseBrowserClient();

      const { error } = await supabase
        .from("connections")
        .update({
          status,
          responded_at: new Date().toISOString(),
        })
        .eq("id", connectionId);

      if (error) throw error;

      setMessage(status === "accepted" ? "Connection accepted." : "Connection declined.");
      await loadData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update connection request.");
    } finally {
      setIsWorking(false);
    }
  }

  function getOtherProfile(connection: Connection) {
    const otherId = connection.requester_id === currentUserId ? connection.recipient_id : connection.requester_id;
    return profileById.get(otherId);
  }

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-8 p-8">
      <div>
        <h1 className="text-3xl font-semibold">Connections</h1>
        <p className="mt-2 text-sm text-gray-600">
          Find visible profiles, send connection requests, and accept or decline incoming requests.
        </p>
      </div>

      {message && <p className="rounded-lg border p-3 text-sm text-gray-700">{message}</p>}

      {isLoading ? (
        <p className="text-sm text-gray-600">Loading connections...</p>
      ) : (
        <>
          <ConnectionSection title="Incoming requests">
            {incomingRequests.length === 0 ? (
              <EmptyState text="No incoming requests yet." />
            ) : (
              incomingRequests.map((connection) => {
                const profile = profileById.get(connection.requester_id);
                return (
                  <ConnectionCard key={connection.id} profile={profile}>
                    <div className="flex gap-2">
                      <button
                        className="rounded-lg bg-black px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
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

          <ConnectionSection title="Accepted connections">
            {acceptedConnections.length === 0 ? (
              <EmptyState text="No accepted connections yet." />
            ) : (
              acceptedConnections.map((connection) => (
                <ConnectionCard key={connection.id} profile={getOtherProfile(connection)}>
                  <span className="text-sm font-medium text-gray-700">Connected</span>
                </ConnectionCard>
              ))
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
            {discoverableProfiles.length === 0 ? (
              <EmptyState text="No additional visible profiles found." />
            ) : (
              discoverableProfiles.map((profile) => (
                <ConnectionCard key={profile.id} profile={profile}>
                  <button
                    className="rounded-lg bg-black px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
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

function ConnectionCard({ profile, children }: { profile?: Profile; children: React.ReactNode }) {
  const identity = (
    <>
      <ProfileAvatar avatarPath={profile?.avatar_url} displayName={profile?.display_name} size={40} />
      <div>
        <h3 className="font-semibold">{profile?.display_name ?? "Unknown profile"}</h3>
        <p className="text-sm text-gray-600">
          {[profile?.role_type, profile?.field].filter(Boolean).join(" - ") || "No field added yet"}
        </p>
        {profile?.bio && <p className="mt-2 max-w-2xl text-sm text-gray-700">{profile.bio}</p>}
        {profile?.mentor_available && <p className="mt-2 text-sm font-medium">Available as mentor</p>}
      </div>
    </>
  );

  return (
    <article className="flex flex-col justify-between gap-4 rounded-xl border p-4 md:flex-row md:items-center">
      {profile ? (
        <Link className="flex gap-3 rounded-lg hover:bg-gray-50" href={`/profile/${profile.id}`}>
          {identity}
        </Link>
      ) : (
        <div className="flex gap-3">{identity}</div>
      )}
      <div>{children}</div>
    </article>
  );
}
function EmptyState({ text }: { text: string }) {
  return <p className="rounded-xl border border-dashed p-4 text-sm text-gray-600">{text}</p>;
}



