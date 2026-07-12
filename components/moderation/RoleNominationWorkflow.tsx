"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/browser";

type PlatformRole = "user" | "moderator" | "senior_moderator" | "admin";
type ProposedRole = Exclude<PlatformRole, "user">;

type Profile = {
  id: string;
  display_name: string;
  field: string | null;
};

type RoleNomination = {
  id: string;
  nominee_id: string;
  nominated_by: string;
  proposed_role: ProposedRole;
  justification: string;
  evidence_notes: string | null;
  expected_availability: string | null;
  conflict_of_interest_notes: string | null;
  status: string;
  code_of_conduct_acknowledged: boolean;
  confidentiality_acknowledged: boolean;
  impartiality_acknowledged: boolean;
  conflict_declaration_acknowledged: boolean;
  expires_at: string;
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

function formatRole(role: string) {
  return role
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function RoleNominationWorkflow() {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentRole, setCurrentRole] = useState<PlatformRole>("user");
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [nominations, setNominations] = useState<RoleNomination[]>([]);
  const [selectedNomineeId, setSelectedNomineeId] = useState("");
  const [proposedRole, setProposedRole] = useState<ProposedRole>("moderator");
  const [justification, setJustification] = useState("");
  const [evidenceNotes, setEvidenceNotes] = useState("");
  const [availability, setAvailability] = useState("");
  const [conflictNotes, setConflictNotes] = useState("");
  const [acknowledgements, setAcknowledgements] = useState({
    coc: false,
    confidentiality: false,
    impartiality: false,
    conflicts: false,
  });
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isWorking, setIsWorking] = useState(false);

  const profileById = useMemo(
    () => new Map(profiles.map((profile) => [profile.id, profile])),
    [profiles]
  );

  const nomineeOptions = useMemo(
    () =>
      profiles
        .filter((profile) => profile.id !== currentUserId)
        .sort((a, b) => a.display_name.localeCompare(b.display_name)),
    [profiles, currentUserId]
  );

  const myPendingNominations = nominations.filter(
    (nomination) => nomination.nominee_id === currentUserId && nomination.status === "awaiting_response"
  );

  const awaitingApproval = nominations.filter(
    (nomination) => nomination.status === "awaiting_final_approval"
  );

  const canNominate = currentRole === "admin" || currentRole === "senior_moderator";

  async function loadData() {
    setMessage(null);

    if (!isSupabaseConfigured()) {
      setMessage("Supabase is not configured.");
      setIsLoading(false);
      return;
    }

    try {
      const supabase = getSupabaseBrowserClient();
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;

      const userId = sessionData.session?.user.id;
      if (!userId) {
        setMessage("Please log in to manage or respond to nominations.");
        setIsLoading(false);
        return;
      }

      setCurrentUserId(userId);

      const [roleResult, profileResult, nominationResult] = await Promise.all([
        supabase.rpc("current_platform_role"),
        supabase.from("profiles").select("id, display_name, field").is("deleted_at", null),
        supabase
          .from("role_nominations")
          .select(
            "id, nominee_id, nominated_by, proposed_role, justification, evidence_notes, expected_availability, conflict_of_interest_notes, status, code_of_conduct_acknowledged, confidentiality_acknowledged, impartiality_acknowledged, conflict_declaration_acknowledged, expires_at, created_at"
          )
          .order("created_at", { ascending: false }),
      ]);

      if (roleResult.error) throw roleResult.error;
      if (profileResult.error) throw profileResult.error;
      if (nominationResult.error) throw nominationResult.error;

      setCurrentRole((roleResult.data ?? "user") as PlatformRole);
      setProfiles((profileResult.data ?? []) as Profile[]);
      setNominations((nominationResult.data ?? []) as RoleNomination[]);
    } catch (error) {
      setMessage(getErrorMessage(error, "Unable to load role nominations."));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  async function submitNomination(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedNomineeId || justification.trim().length < 20) return;

    setIsWorking(true);
    setMessage(null);

    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.rpc("nominate_platform_role", {
        nominee: selectedNomineeId,
        proposed: proposedRole,
        justification_text: justification.trim(),
        evidence_text: evidenceNotes.trim() || null,
        availability_text: availability.trim() || null,
        conflict_text: conflictNotes.trim() || null,
      });

      if (error) throw error;

      setSelectedNomineeId("");
      setProposedRole("moderator");
      setJustification("");
      setEvidenceNotes("");
      setAvailability("");
      setConflictNotes("");
      setMessage("Nomination sent to the user's FieldsConnect account for review.");
      await loadData();
    } catch (error) {
      setMessage(getErrorMessage(error, "Unable to submit nomination."));
    } finally {
      setIsWorking(false);
    }
  }

  async function respondToNomination(nominationId: string, accept: boolean) {
    if (
      accept &&
      !(
        acknowledgements.coc &&
        acknowledgements.confidentiality &&
        acknowledgements.impartiality &&
        acknowledgements.conflicts
      )
    ) {
      setMessage("Accept all four responsibilities before accepting the nomination.");
      return;
    }

    setIsWorking(true);
    setMessage(null);

    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.rpc("respond_to_role_nomination", {
        nomination: nominationId,
        accept_nomination: accept,
        acknowledge_coc: accept ? acknowledgements.coc : false,
        acknowledge_confidentiality: accept ? acknowledgements.confidentiality : false,
        acknowledge_impartiality: accept ? acknowledgements.impartiality : false,
        acknowledge_conflicts: accept ? acknowledgements.conflicts : false,
      });

      if (error) throw error;

      setAcknowledgements({ coc: false, confidentiality: false, impartiality: false, conflicts: false });
      setMessage(
        accept
          ? "Nomination accepted and returned to the administrator for final approval."
          : "Nomination declined."
      );
      await loadData();
    } catch (error) {
      setMessage(getErrorMessage(error, "Unable to respond to nomination."));
    } finally {
      setIsWorking(false);
    }
  }

  async function approveNomination(nominationId: string) {
    setIsWorking(true);
    setMessage(null);

    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.rpc("approve_and_activate_role_nomination", {
        nomination: nominationId,
      });

      if (error) throw error;

      setMessage("Role approved and activated. The user's moderation access is now enabled.");
      await loadData();
    } catch (error) {
      setMessage(getErrorMessage(error, "Unable to approve nomination."));
    } finally {
      setIsWorking(false);
    }
  }

  if (isLoading) {
    return <p className="p-8 text-sm text-gray-600">Loading nomination workflow...</p>;
  }

  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col gap-8 p-8">
      <div>
        <p className="text-sm font-medium text-blue-700">Current platform role: {formatRole(currentRole)}</p>
        <h1 className="mt-1 text-3xl font-semibold">Moderation role nominations</h1>
        <p className="mt-2 max-w-3xl text-sm text-gray-600">
          Moderation privileges are granted only after nomination, candidate acknowledgement, and final administrative approval.
        </p>
      </div>

      {message && <p className="rounded-xl border bg-white p-4 text-sm text-gray-700">{message}</p>}

      {canNominate && (
        <form onSubmit={submitNomination} className="grid gap-4 rounded-2xl border bg-white p-5">
          <div>
            <h2 className="text-xl font-semibold">Create nomination</h2>
            <p className="mt-1 text-sm text-gray-600">Record why this person is strategically suited to the proposed role.</p>
          </div>

          <label className="grid gap-2 text-sm font-medium">
            Candidate
            <select
              className="rounded-lg border px-3 py-2"
              value={selectedNomineeId}
              onChange={(event) => setSelectedNomineeId(event.target.value)}
              required
            >
              <option value="">Select a user</option>
              {nomineeOptions.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.display_name}{profile.field ? ` — ${profile.field}` : ""}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-2 text-sm font-medium">
            Proposed role
            <select
              className="rounded-lg border px-3 py-2"
              value={proposedRole}
              onChange={(event) => setProposedRole(event.target.value as ProposedRole)}
            >
              <option value="moderator">Moderator</option>
              {currentRole === "admin" && <option value="senior_moderator">Senior Moderator</option>}
              {currentRole === "admin" && <option value="admin">Admin</option>}
            </select>
          </label>

          <label className="grid gap-2 text-sm font-medium">
            Justification
            <textarea
              className="min-h-28 rounded-lg border px-3 py-2"
              value={justification}
              onChange={(event) => setJustification(event.target.value)}
              placeholder="Explain the candidate's judgement, conduct, reliability and strategic suitability."
              minLength={20}
              required
            />
          </label>

          <label className="grid gap-2 text-sm font-medium">
            Evidence or observations
            <textarea
              className="min-h-20 rounded-lg border px-3 py-2"
              value={evidenceNotes}
              onChange={(event) => setEvidenceNotes(event.target.value)}
              placeholder="Optional examples supporting the nomination."
            />
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-sm font-medium">
              Expected availability
              <input
                className="rounded-lg border px-3 py-2"
                value={availability}
                onChange={(event) => setAvailability(event.target.value)}
                placeholder="Example: 3 hours per week"
              />
            </label>

            <label className="grid gap-2 text-sm font-medium">
              Known conflict considerations
              <input
                className="rounded-lg border px-3 py-2"
                value={conflictNotes}
                onChange={(event) => setConflictNotes(event.target.value)}
                placeholder="None known, or describe briefly"
              />
            </label>
          </div>

          <button
            className="w-fit rounded-lg bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            disabled={isWorking || !selectedNomineeId || justification.trim().length < 20}
            type="submit"
          >
            {isWorking ? "Sending..." : "Send nomination"}
          </button>
        </form>
      )}

      {myPendingNominations.map((nomination) => {
        const nominator = profileById.get(nomination.nominated_by);
        return (
          <article key={nomination.id} className="rounded-2xl border bg-white p-5">
            <p className="text-sm font-medium text-blue-700">Private nomination from FCModerators</p>
            <h2 className="mt-1 text-xl font-semibold">You have been nominated as {formatRole(nomination.proposed_role)}</h2>
            <p className="mt-2 text-sm text-gray-600">
              Moderators review reports, apply the FieldsConnect Code of Conduct fairly, protect confidentiality and document every decision.
            </p>

            <div className="mt-4 rounded-xl bg-gray-50 p-4 text-sm text-gray-700">
              <p><span className="font-medium">Justification:</span> {nomination.justification}</p>
              {nomination.expected_availability && (
                <p className="mt-2"><span className="font-medium">Expected availability:</span> {nomination.expected_availability}</p>
              )}
              <p className="mt-2 text-xs text-gray-500">Nominated by {nominator?.display_name ?? "an authorised administrator"}. Expires {new Date(nomination.expires_at).toLocaleDateString()}.</p>
            </div>

            <div className="mt-4 grid gap-3 text-sm">
              {[
                ["coc", "I have read and agree to apply the FieldsConnect Code of Conduct."],
                ["confidentiality", "I will protect reporter identities and confidential moderation information."],
                ["impartiality", "I will act impartially and avoid personal retaliation or favouritism."],
                ["conflicts", "I will declare conflicts of interest and recuse myself where necessary."],
              ].map(([key, label]) => (
                <label key={key} className="flex items-start gap-3">
                  <input
                    className="mt-1"
                    type="checkbox"
                    checked={acknowledgements[key as keyof typeof acknowledgements]}
                    onChange={(event) =>
                      setAcknowledgements((current) => ({ ...current, [key]: event.target.checked }))
                    }
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                disabled={isWorking}
                onClick={() => void respondToNomination(nomination.id, true)}
                type="button"
              >
                Accept nomination
              </button>
              <button
                className="rounded-lg border px-4 py-2 text-sm font-medium disabled:opacity-50"
                disabled={isWorking}
                onClick={() => void respondToNomination(nomination.id, false)}
                type="button"
              >
                Decline
              </button>
            </div>
          </article>
        );
      })}

      {currentRole === "admin" && (
        <section className="grid gap-3">
          <div>
            <h2 className="text-xl font-semibold">Awaiting final approval</h2>
            <p className="mt-1 text-sm text-gray-600">Accepted nominations remain inactive until you approve them.</p>
          </div>

          {awaitingApproval.length === 0 ? (
            <p className="rounded-xl border border-dashed p-4 text-sm text-gray-600">No nominations are awaiting final approval.</p>
          ) : (
            awaitingApproval.map((nomination) => {
              const nominee = profileById.get(nomination.nominee_id);
              return (
                <article key={nomination.id} className="rounded-xl border bg-white p-4">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <h3 className="font-semibold">{nominee?.display_name ?? "Candidate"}</h3>
                      <p className="text-sm text-gray-600">Proposed role: {formatRole(nomination.proposed_role)}</p>
                      <p className="mt-2 max-w-2xl text-sm text-gray-700">{nomination.justification}</p>
                    </div>
                    <button
                      className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                      disabled={isWorking}
                      onClick={() => void approveNomination(nomination.id)}
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
      )}

      <section className="grid gap-3">
        <h2 className="text-xl font-semibold">Nomination history</h2>
        {nominations.length === 0 ? (
          <p className="rounded-xl border border-dashed p-4 text-sm text-gray-600">No nomination records are visible to this account.</p>
        ) : (
          nominations.map((nomination) => {
            const nominee = profileById.get(nomination.nominee_id);
            return (
              <article key={nomination.id} className="rounded-xl border bg-white p-4 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">{nominee?.display_name ?? "Candidate"}</p>
                    <p className="text-gray-600">{formatRole(nomination.proposed_role)}</p>
                  </div>
                  <span className="rounded-full border px-3 py-1 text-xs">{formatRole(nomination.status)}</span>
                </div>
              </article>
            );
          })
        )}
      </section>
    </section>
  );
}
