"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/browser";
import { ProfileAvatar } from "@/components/profile/ProfileAvatar";
import { MentorRating, type MentorRatingSummary } from "@/components/mentorship/MentorRating";
import {
  getActionErrorMessage,
  getMessageAlertClass,
} from "@/lib/action-errors";

type Profile = {
  id: string;
  display_name: string;
  bio: string | null;
  field: string | null;
  role_type: string;
  profile_visibility: "public" | "connections" | "private";
  mentor_available: boolean;
  avatar_url: string | null;
};

type MentorshipDuration =
  | "3_months"
  | "6_months"
  | "1_year"
  | "ongoing";

type MentorshipFrequency =
  | "weekly"
  | "fortnightly"
  | "monthly"
  | "flexible";

type MentorProfile = {
  mentorship_summary: string | null;
  mentoring_fields: string[];
  mentoring_levels: string[];
  maximum_active_mentees: number;
  preferred_frequency: MentorshipFrequency | null;
  accepts_3_month: boolean;
  accepts_6_month: boolean;
  accepts_1_year: boolean;
  accepts_ongoing: boolean;
  is_accepting_requests: boolean;
};

type MentorshipPaymentOffer = {
  id: string;
  duration: MentorshipDuration;
  payment_mode: "free" | "paid";
  price_amount_minor: number;
  currency: string;
  is_active: boolean;
};

type MentorshipRequestForm = {
  mentorshipField: string;
  mentorshipLevel: string;
  objective: string;
  motivation: string;
  requestedDuration: MentorshipDuration;
  requestedFrequency: MentorshipFrequency;
};

type Skill = {
  id: string;
  name: string;
  description: string | null;
  rating: number | null;
  is_published: boolean;
};

type LibraryDocument = {
  id: string;
  title: string;
  description: string | null;

  resource_type: "uploaded_file" | "external_link";

  file_name: string | null;
  file_size_bytes: number | null;
  storage_bucket: string | null;
  storage_path: string | null;

  external_url: string | null;
  source_title: string | null;
  source_publisher: string | null;
  source_accessed_on: string | null;

  visibility: "public" | "connections";
  is_published: boolean;
};

type ProfileConnection = {
  id: string;
  requester_id: string;
  recipient_id: string;
  status: "pending" | "accepted" | "declined" | "cancelled";
};

type PublicProfileViewProps = {
  profileId: string;
};

const initialMentorshipRequestForm: MentorshipRequestForm = {
  mentorshipField: "",
  mentorshipLevel: "",
  objective: "",
  motivation: "",
  requestedDuration: "3_months",
  requestedFrequency: "flexible",
};

export function PublicProfileView({ profileId }: PublicProfileViewProps) {
  const [fromMentorshipHub, setFromMentorshipHub] = useState(false);
  useEffect(() => {
    setFromMentorshipHub(new URLSearchParams(window.location.search).get("from") === "mentorships");
  }, [profileId]);
  const returnHref = fromMentorshipHub ? "/mentorships" : "/connections";
  const [profile, setProfile] = useState<Profile | null>(null);
  const [hasFullProfileAccess, setHasFullProfileAccess] = useState(false);
  const [connection, setConnection] = useState<ProfileConnection | null>(null);
  const [mentorProfile, setMentorProfile] =
    useState<MentorProfile | null>(null);
  const [mentorRating, setMentorRating] = useState<MentorRatingSummary | null>(null);
  const [paymentOffers, setPaymentOffers] =
    useState<MentorshipPaymentOffer[]>([]);
  const [currentUserId, setCurrentUserId] =
    useState<string | null>(null);
  const [requestForm, setRequestForm] =
    useState<MentorshipRequestForm>(
      initialMentorshipRequestForm
    );
  const [skills, setSkills] = useState<Skill[]>([]);
  const [documents, setDocuments] = useState<LibraryDocument[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isWorking, setIsWorking] = useState(false);
  const [isSubmittingRequest, setIsSubmittingRequest] =
    useState(false);
  const [requestSubmitted, setRequestSubmitted] =
    useState(false);
  const [isBioExpanded, setIsBioExpanded] =
    useState(false);
  const [isBioOverflowing, setIsBioOverflowing] =
    useState(false);
  const bioRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    setIsBioExpanded(false);
    setIsBioOverflowing(false);

    const frame = window.requestAnimationFrame(() => {
      const element = bioRef.current;

      if (!element) return;

      setIsBioOverflowing(
        element.scrollHeight > element.clientHeight + 1
      );
    });

    return () => window.cancelAnimationFrame(frame);
  }, [profile?.bio]);

  async function reloadVisibleLibraryDocuments() {
    if (!isSupabaseConfigured()) return;

    try {
      const supabase = getSupabaseBrowserClient();

      const { data, error } = await supabase
        .from("library_documents")
        .select(
          "id, title, description, resource_type, file_name, file_size_bytes, storage_bucket, storage_path, external_url, source_title, source_publisher, source_accessed_on, visibility, is_published"
        )
        .eq("owner_id", profileId)
        .eq("is_published", true)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      if (error) throw error;

      setDocuments((data ?? []) as LibraryDocument[]);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to refresh visible library resources."
      );
    }
  }

  useEffect(() => {
    async function loadProfile() {
      setMessage(null);

      if (!isSupabaseConfigured()) {
        setMessage("Supabase is not configured yet. Public profiles will work once environment variables are set.");
        setIsLoading(false);
        return;
      }

      try {
        const supabase = getSupabaseBrowserClient();
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) throw sessionError;

        const userId = sessionData.session?.user.id;

        if (!userId) {
          setMessage("Please log in before viewing profiles.");
          setIsLoading(false);
          return;
        }

        setCurrentUserId(userId);

        // Accepted connections unlock private profiles. Track pending requests
        // to render Connect / Request pending / Accept on private profile pages.
        const { data: connectionRows, error: connectionError } = await supabase
          .from("connections")
          .select("id, requester_id, recipient_id, status")
          .in("requester_id", [userId, profileId])
          .in("recipient_id", [userId, profileId])
          .order("created_at", { ascending: false });
        if (connectionError) throw connectionError;
        const currentConnection =
          (connectionRows ?? []).find((item) =>
            item.status === "accepted" || item.status === "pending"
          ) ?? connectionRows?.[0] ?? null;
        setConnection(currentConnection as ProfileConnection | null);

        const [
          { data: profileData, error: profileError },
          { data: mentorData, error: mentorError },
          { data: paymentOfferData, error: paymentOfferError },
          { data: skillData, error: skillError },
          { data: documentData, error: documentError },
          { data: ratingData, error: ratingError },
        ] = await Promise.all([
          supabase
            .from("profiles")
            .select("id, display_name, bio, field, role_type, profile_visibility, mentor_available, avatar_url")
            .eq("id", profileId)
            .maybeSingle(),
          supabase
            .from("mentor_profiles")
            .select(
              "mentorship_summary, mentoring_fields, mentoring_levels, maximum_active_mentees, preferred_frequency, accepts_3_month, accepts_6_month, accepts_1_year, accepts_ongoing, is_accepting_requests"
            )
            .eq("mentor_id", profileId)
            .maybeSingle(),
          supabase
            .from("mentorship_payment_offers")
            .select(
              "id, duration, payment_mode, price_amount_minor, currency, is_active"
            )
            .eq("mentor_id", profileId)
            .order("created_at", { ascending: true }),
          supabase
            .from("skills")
            .select("id, name, description, rating, is_published")
            .eq("profile_id", profileId)
            .eq("is_published", true)
            .is("deleted_at", null)
            .order("created_at", { ascending: false }),
          supabase
            .from("library_documents")
            .select(
              "id, title, description, resource_type, file_name, file_size_bytes, storage_bucket, storage_path, external_url, source_title, source_publisher, source_accessed_on, visibility, is_published"
            )
            .eq("owner_id", profileId)
            .eq("is_published", true)
            .is("deleted_at", null)
            .order("created_at", { ascending: false }),
          supabase.rpc("get_mentor_rating_summaries", {
            target_mentor_ids: [profileId],
          }),
        ]);

        if (profileError) throw profileError;
        if (mentorError) throw mentorError;
        if (paymentOfferError) throw paymentOfferError;
        if (skillError) throw skillError;
        if (documentError) throw documentError;

        if (!profileData) {
          // Private profiles have no directly readable detail row. Only resolve
          // the name and privacy status for a clear, non-disclosing notice.
          const { data: cards, error: cardsError } = await supabase.rpc(
            "get_discoverable_member_cards",
            { target_ids: [profileId] }
          );
          if (cardsError) throw cardsError;
          const card = (cards ?? [])[0];
          if (card?.profile_visibility === "private") {
            setProfile(card as Profile);
            setHasFullProfileAccess(false);
            setMentorProfile(null);
            setPaymentOffers([]);
            setSkills([]);
            setDocuments([]);
            return;
          }
        }
        setProfile((profileData ?? null) as Profile | null);
        setHasFullProfileAccess(Boolean(profileData));
        setMentorProfile(
          (mentorData ?? null) as MentorProfile | null
        );
        if (ratingError) console.warn("Unable to load mentor rating:", ratingError);
        setMentorRating(ratingError ? null : (ratingData?.[0] ?? null) as MentorRatingSummary | null);
        setPaymentOffers(
          (paymentOfferData ?? []) as MentorshipPaymentOffer[]
        );
        setSkills((skillData ?? []) as Skill[]);
        setDocuments((documentData ?? []) as LibraryDocument[]);

        if (mentorData) {
          const firstAcceptedDuration:
            | MentorshipDuration
            | null =
            mentorData.accepts_3_month
              ? "3_months"
              : mentorData.accepts_6_month
                ? "6_months"
                : mentorData.accepts_1_year
                  ? "1_year"
                  : mentorData.accepts_ongoing
                    ? "ongoing"
                    : null;

          setRequestForm((current) => ({
            ...current,
            mentorshipField:
              mentorData.mentoring_fields?.[0] ?? "",
            mentorshipLevel:
              mentorData.mentoring_levels?.[0] ?? "",
            requestedDuration:
              firstAcceptedDuration ??
              current.requestedDuration,
            requestedFrequency:
              mentorData.preferred_frequency ??
              "flexible",
          }));
        }
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to load profile.");
      } finally {
        setIsLoading(false);
      }
    }

    void loadProfile();
  }, [profileId]);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;

    const supabase = getSupabaseBrowserClient();

    const channel = supabase
      .channel("library-resource-events")
      .on(
        "broadcast",
        {
          event: "resource-removed",
        },
        ({ payload }) => {
          const resourceId =
            typeof payload?.resourceId === "string"
              ? payload.resourceId
              : null;

          if (!resourceId) return;

          setDocuments((currentDocuments) =>
            currentDocuments.filter(
              (document) => document.id !== resourceId
            )
          );
        }
      )
      .on(
        "broadcast",
        {
          event: "resource-visibility-changed",
        },
        () => {
          void reloadVisibleLibraryDocuments();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  async function openDocument(document: LibraryDocument) {
    if (!isSupabaseConfigured()) return;

    setIsWorking(true);
    setMessage(null);

    try {
      if (document.resource_type === "external_link") {
        if (!document.external_url) {
          throw new Error(
            "This online resource does not have a valid link."
          );
        }

        window.open(
          document.external_url,
          "_blank",
          "noopener,noreferrer"
        );

        return;
      }

      if (
        !document.storage_bucket ||
        !document.storage_path
      ) {
        throw new Error(
          "This uploaded file does not have a valid storage location."
        );
      }

      const supabase = getSupabaseBrowserClient();

      const { data, error } = await supabase.storage
        .from(document.storage_bucket)
        .createSignedUrl(document.storage_path, 60);

      if (error) throw error;

      if (data?.signedUrl) {
        window.open(
          data.signedUrl,
          "_blank",
          "noopener,noreferrer"
        );
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to open resource."
      );
    } finally {
      setIsWorking(false);
    }
  }

  function updateRequestField<
    K extends keyof MentorshipRequestForm
  >(
    key: K,
    value: MentorshipRequestForm[K]
  ) {
    setRequestForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function getActivePaymentOffer(
    duration: MentorshipDuration
  ) {
    return (
      paymentOffers.find(
        (offer) =>
          offer.duration === duration &&
          offer.is_active
      ) ?? null
    );
  }

  function formatOfferPrice(
    duration: MentorshipDuration
  ) {
    const offer = getActivePaymentOffer(duration);

    if (!offer) {
      return paymentOffers.length === 0
        ? "Free"
        : null;
    }

    if (
      offer.payment_mode === "free" ||
      offer.price_amount_minor === 0
    ) {
      return "Free";
    }

    return new Intl.NumberFormat("en-ZA", {
      style: "currency",
      currency: offer.currency,
    }).format(offer.price_amount_minor / 100);
  }

  function getAcceptedDurations() {
    if (!mentorProfile) {
      return [] as Array<{
        value: MentorshipDuration;
        label: string;
        priceLabel: string;
      }>;
    }

    const durations: Array<{
      value: MentorshipDuration;
      label: string;
      priceLabel: string;
    }> = [];

    function addDuration(
      accepted: boolean,
      value: MentorshipDuration,
      label: string
    ) {
      if (!accepted) return;

      const priceLabel = formatOfferPrice(value);

      if (priceLabel === null) return;

      durations.push({
        value,
        label,
        priceLabel,
      });
    }

    addDuration(
      mentorProfile.accepts_3_month,
      "3_months",
      "3 months"
    );
    addDuration(
      mentorProfile.accepts_6_month,
      "6_months",
      "6 months"
    );
    addDuration(
      mentorProfile.accepts_1_year,
      "1_year",
      "1 year"
    );
    addDuration(
      mentorProfile.accepts_ongoing,
      "ongoing",
      "Full-time / ongoing"
    );

    return durations;
  }

  async function connectFromPrivateProfile() {
    if (!currentUserId || !isSupabaseConfigured() || isWorking ||
      connection?.status === "pending" || connection?.status === "accepted") return;
    setIsWorking(true);
    setMessage(null);
    try {
      const supabase = getSupabaseBrowserClient();
      let connectionId: string;
      if (connection && (connection.status === "declined" || connection.status === "cancelled")) {
        const { data, error } = await supabase.from("connections")
          .update({
            requester_id: currentUserId, recipient_id: profileId,
            status: "pending", responded_at: null,
            created_at: new Date().toISOString(),
          })
          .eq("id", connection.id).select("id").single();
        if (error) throw error;
        connectionId = data.id;
      } else {
        const { data, error } = await supabase.from("connections")
          .insert({ requester_id: currentUserId, recipient_id: profileId, status: "pending" })
          .select("id").single();
        if (error) throw error;
        connectionId = data.id;
      }
      setConnection({
        id: connectionId, requester_id: currentUserId,
        recipient_id: profileId, status: "pending",
      });
      // Notification failure does not invalidate a successful connection request.
      const { data: actor } = await supabase.from("profiles")
        .select("display_name").eq("id", currentUserId).maybeSingle();
      const { error: notifyError } = await supabase.from("notifications").insert({
        recipient_id: profileId, actor_id: currentUserId,
        notification_type: "connection_request", entity_type: "connection",
        entity_id: connectionId, title: "New connection request",
        body: (actor?.display_name ?? "Someone") + " sent you a connection request.",
      });
      if (notifyError) console.error("Unable to notify connection request:", notifyError);
      setMessage("Connection request sent.");
    } catch (error) {
      setMessage(getActionErrorMessage(error, "send connection request"));
    } finally {
      setIsWorking(false);
    }
  }

  async function acceptPrivateProfileRequest() {
    if (!currentUserId || !isSupabaseConfigured() || isWorking ||
      connection?.status !== "pending" || connection.recipient_id !== currentUserId) return;
    setIsWorking(true);
    setMessage(null);
    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.from("connections")
        .update({ status: "accepted", responded_at: new Date().toISOString() })
        .eq("id", connection.id)
        .eq("recipient_id", currentUserId)
        .eq("status", "pending").select("id").single();
      if (error) throw error;
      const { data: actor } = await supabase.from("profiles")
        .select("display_name").eq("id", currentUserId).maybeSingle();
      const { error: notifyError } = await supabase.from("notifications").insert({
        recipient_id: connection.requester_id, actor_id: currentUserId,
        notification_type: "connection_accepted", entity_type: "connection",
        entity_id: connection.id, title: "Connection request accepted",
        body: (actor?.display_name ?? "Someone") + " accepted your connection request.",
      });
      if (notifyError) console.error("Unable to notify accepted connection:", notifyError);
      window.location.reload();
    } catch (error) {
      setMessage(getActionErrorMessage(error, "accept connection request"));
      setIsWorking(false);
    }
  }

  async function submitMentorshipRequest(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    setMessage(null);

    const mentorshipField =
      requestForm.mentorshipField.trim();
    const objective = requestForm.objective.trim();
    const motivation = requestForm.motivation.trim();

    if (!currentUserId) {
      setMessage(
        "Please log in before requesting mentorship."
      );
      return;
    }

    if (currentUserId === profileId) {
      setMessage(
        "You cannot request mentorship from yourself."
      );
      return;
    }

    if (
      !mentorProfile ||
      !mentorProfile.is_accepting_requests
    ) {
      setMessage(
        "This mentor is not currently accepting requests."
      );
      return;
    }

    if (
      mentorshipField.length < 2 ||
      mentorshipField.length > 120
    ) {
      setMessage(
        "Mentorship field must be between 2 and 120 characters."
      );
      return;
    }

    if (
      objective.length < 10 ||
      objective.length > 1000
    ) {
      setMessage(
        "Objective must be between 10 and 1,000 characters."
      );
      return;
    }

    if (
      motivation.length < 10 ||
      motivation.length > 1500
    ) {
      setMessage(
        "Motivation must be between 10 and 1,500 characters."
      );
      return;
    }

    const availableMentorshipLevels =
      mentorProfile.mentoring_levels ?? [];

    if (
      !requestForm.mentorshipLevel ||
      !availableMentorshipLevels.includes(
        requestForm.mentorshipLevel
      )
    ) {
      setMessage(
        "Select a mentorship level offered by this mentor."
      );
      return;
    }

    const acceptedDurationValues =
      getAcceptedDurations().map(
        (duration) => duration.value
      );

    if (
      !acceptedDurationValues.includes(
        requestForm.requestedDuration
      )
    ) {
      setMessage(
        "Select a mentorship period accepted by this mentor."
      );
      return;
    }

    if (!isSupabaseConfigured()) {
      setMessage(
        "Supabase is not configured yet."
      );
      return;
    }

    setIsSubmittingRequest(true);

    try {
      const supabase = getSupabaseBrowserClient();

      const { error } = await supabase.rpc(
        "create_mentorship_request",
        {
          target_mentor_id: profileId,
          requested_mentorship_field:
            mentorshipField,
          requested_objective: objective,
          requested_motivation: motivation,
          requested_period:
            requestForm.requestedDuration,
          requested_contact_frequency:
            requestForm.requestedFrequency,
          requested_mentorship_level:
            requestForm.mentorshipLevel,
        }
      );

      if (error) throw error;

      setRequestSubmitted(true);
      setRequestForm((current) => ({
        ...current,
        objective: "",
        motivation: "",
      }));

      setMessage(
        "Mentorship request sent successfully."
      );
    } catch (error) {
      setMessage(
        getActionErrorMessage(
          error,
          "send mentorship request"
        )
      );
    } finally {
      setIsSubmittingRequest(false);
    }
  }

  if (isLoading) {
    return (
      <section className="mx-auto w-full max-w-5xl px-4 py-6 sm:p-8">
        <p className="text-sm text-gray-600">Loading profile...</p>
      </section>
    );
  }

  if (!profile) {
    return (
      <section className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-6 sm:p-8">
        <p className="rounded-xl border border-dashed p-4 text-sm text-gray-600">
          This profile is not available. It may be private, connection-only, or removed.
        </p>
        <Link className="w-fit rounded-lg border px-4 py-2 text-sm font-medium" href={returnHref}>
          {fromMentorshipHub ? "Back to mentorship" : "Back to connections"}
        </Link>
        {message && <p className="text-sm text-gray-700">{message}</p>}
      </section>
    );
  }

  if (profile.profile_visibility === "private" &&
      profile.id !== currentUserId && !hasFullProfileAccess) {
    const outgoingPending = connection?.status === "pending" &&
      connection.requester_id === currentUserId;
    const incomingPending = connection?.status === "pending" &&
      connection.recipient_id === currentUserId;
    const acceptedButUnavailable = connection?.status === "accepted";

    return (
      <section className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-6 sm:p-8">
        <Link className="w-fit text-sm font-medium text-gray-600 hover:text-black" href={returnHref}>
          ← {fromMentorshipHub ? "Back to mentorship" : "Back to connections"}
        </Link>
        <div className="rounded-xl border bg-white p-5">
          <h1 className="text-xl font-semibold">{profile.display_name}</h1>
          <p className="mt-2 text-sm font-medium text-gray-700">Private profile</p>
          <p className="mt-2 text-sm text-gray-600">
            {acceptedButUnavailable
              ? "You are connected, but this profile's details are temporarily unavailable."
              : "Connect with this member to view their profile details, published skills and shared Library resources."}
          </p>
          {message && <p className={getMessageAlertClass(message)}>{message}</p>}
          <div className="mt-4">
            {outgoingPending ? (
              <span className="inline-flex min-h-11 items-center rounded-lg border px-4 py-2 text-sm font-medium text-gray-700">
                Request pending
              </span>
            ) : incomingPending ? (
              <button type="button" onClick={() => void acceptPrivateProfileRequest()}
                disabled={isWorking}
                className="min-h-11 rounded-lg bg-black px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">
                {isWorking ? "Accepting..." : "Accept connection"}
              </button>
            ) : acceptedButUnavailable ? null : (
              <button type="button" onClick={() => void connectFromPrivateProfile()}
                disabled={isWorking}
                className="min-h-11 rounded-lg bg-black px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">
                {isWorking ? "Sending..." : "Connect"}
              </button>
            )}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-3 py-4 sm:gap-6 sm:p-8">
      <Link className="w-fit text-sm font-medium text-gray-600 hover:text-black" href={returnHref}>
        ← {fromMentorshipHub ? "Back to mentorship" : "Back to connections"}
      </Link>

      {message && (
        <p className={getMessageAlertClass(message)}>
          {message}
        </p>
      )}

      <header className="flex flex-col gap-3 rounded-xl border p-4 sm:gap-4 sm:p-6 md:flex-row md:items-center">
        <ProfileAvatar avatarPath={profile.avatar_url} displayName={profile.display_name} size={88} />

        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold leading-snug sm:text-3xl">{profile.display_name}</h1>
            <span className="rounded-full border px-2.5 py-0.5 text-[11px] sm:px-3 sm:py-1 sm:text-xs">
              {profile.profile_visibility}
            </span>
          </div>

          <p className="mt-2 text-xs leading-snug text-gray-600 sm:text-sm">
            {[profile.role_type, profile.field].filter(Boolean).join(" - ") || "Profile"}
          </p>

          {profile.mentor_available && <div className="mt-2 flex flex-wrap items-center gap-1 text-xs font-medium sm:text-sm"><span>Available as mentor</span><span className="text-gray-400">·</span><MentorRating summary={mentorRating} mentorId={profile.id} mentorName={profile.display_name} /></div>}

          {profile.bio && (
            <div className="mt-3 max-w-3xl sm:mt-4">
              <p
                ref={bioRef}
                className={`whitespace-pre-wrap text-sm leading-snug text-gray-700 ${
                  !isBioExpanded
                    ? "line-clamp-3"
                    : ""
                }`}
              >
                {profile.bio}
              </p>

              {isBioOverflowing && (
                <button
                  className="mt-2 text-xs font-semibold text-gray-700 underline-offset-4 hover:underline sm:text-sm"
                  onClick={() =>
                    setIsBioExpanded((current) => !current)
                  }
                  type="button"
                >
                  {isBioExpanded ? "View less" : "View more"}
                </button>
              )}
            </div>
          )}
        </div>
      </header>

      {profile.mentor_available && mentorProfile && (
        <section id="mentorship-request" className="scroll-mt-24 flex flex-col gap-4 rounded-xl border p-4 sm:gap-5 sm:p-5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold sm:text-xl">
                Mentorship
              </h2>

              <span className="rounded-full border px-3 py-1 text-xs font-medium">
                {mentorProfile.is_accepting_requests
                  ? "Accepting requests"
                  : "Requests paused"}
              </span>
            </div>

            {mentorProfile.mentorship_summary && (
              <p className="mt-3 max-w-3xl whitespace-pre-wrap text-sm text-gray-700">
                {mentorProfile.mentorship_summary}
              </p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <h3 className="text-sm font-semibold">
                Mentoring fields
              </h3>

              <div className="mt-2 flex flex-wrap gap-2">
                {mentorProfile.mentoring_fields.length > 0 ? (
                  mentorProfile.mentoring_fields.map(
                    (field) => (
                      <span
                        key={field}
                        className="rounded-full border px-3 py-1 text-xs"
                      >
                        {field}
                      </span>
                    )
                  )
                ) : (
                  <p className="text-sm text-gray-600">
                    No fields listed.
                  </p>
                )}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold">
                Mentee levels
              </h3>

              <div className="mt-2 flex flex-wrap gap-2">
                {mentorProfile.mentoring_levels.map(
                  (level) => (
                    <span
                      key={level}
                      className="rounded-full border px-3 py-1 text-xs capitalize"
                    >
                      {level}
                    </span>
                  )
                )}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold">
                Preferred frequency
              </h3>

              <p className="mt-1 text-sm capitalize text-gray-700">
                {mentorProfile.preferred_frequency
                  ? mentorProfile.preferred_frequency.replace(
                      "_",
                      " "
                    )
                  : "Flexible"}
              </p>
            </div>

            <div>
              <h3 className="text-sm font-semibold">
                Maximum active mentees
              </h3>

              <p className="mt-1 text-sm text-gray-700">
                {mentorProfile.maximum_active_mentees}
              </p>
            </div>

            <div className="sm:col-span-2">
              <h3 className="text-sm font-semibold">
                Periods accepted
              </h3>

              <div className="mt-2 flex flex-wrap gap-2">
                {getAcceptedDurations().map(
                  (duration) => (
                    <span
                      key={duration.value}
                      className="rounded-full border px-3 py-1 text-xs"
                    >
                      {duration.label} · {duration.priceLabel}
                    </span>
                  )
                )}
              </div>
            </div>
          </div>

          {currentUserId === profileId ? (
            <p className="rounded-xl border border-dashed p-4 text-sm text-gray-600">
              This is your mentor profile. Other eligible users
              will see the mentorship request form here.
            </p>
          ) : !mentorProfile.is_accepting_requests ? (
            <p className="rounded-xl border border-dashed p-4 text-sm text-gray-600">
              This mentor has temporarily paused new requests.
            </p>
          ) : requestSubmitted ? (
            <p className="rounded-xl border p-4 text-sm font-medium">
              Your mentorship request has been sent.{" "}
              <Link className="underline" href="/mentorships">View mentorship requests</Link>
            </p>
          ) : getAcceptedDurations().length === 0 ? (
            <p className="rounded-xl border border-dashed p-4 text-sm text-gray-600">
              No mentorship periods are currently available to request.
            </p>
          ) : (
            <form
              className="flex flex-col gap-4 border-t pt-5"
              onSubmit={submitMentorshipRequest}
            >
              <div>
                <h3 className="text-base font-semibold sm:text-lg">
                  Request mentorship
                </h3>

                <p className="mt-1 text-sm text-gray-600">
                  Explain what you hope to achieve and why this
                  mentor is a suitable match.
                </p>
              </div>

              <div className="rounded-xl border bg-gray-50 p-4">
                <p className="text-sm font-semibold">
                  Choose your mentorship level
                </p>

                <p className="mt-1 text-sm text-gray-600">
                  This mentor currently offers mentorship at the
                  following level(s). Select the level that best fits
                  this mentorship cycle. Your main FieldsConnect
                  profile will not be changed.
                </p>

                <label className="mt-3 flex flex-col gap-2 text-sm font-medium">
                  Mentorship level

                  <select
                    className="rounded-lg border bg-white px-3 py-2"
                    value={requestForm.mentorshipLevel}
                    onChange={(event) =>
                      updateRequestField(
                        "mentorshipLevel",
                        event.target.value
                      )
                    }
                  >
                    <option value="">
                      Select a mentorship level
                    </option>

                    {mentorProfile.mentoring_levels.map(
                      (level) => (
                        <option key={level} value={level}>
                          {formatMentorshipLevel(level)}
                        </option>
                      )
                    )}
                  </select>
                </label>
              </div>

              <label className="flex flex-col gap-2 text-sm font-medium">
                Mentorship field

                <select
                  className="rounded-lg border px-3 py-2"
                  value={requestForm.mentorshipField}
                  onChange={(event) =>
                    updateRequestField(
                      "mentorshipField",
                      event.target.value
                    )
                  }
                >
                  <option value="">
                    Select a field
                  </option>

                  {mentorProfile.mentoring_fields.map(
                    (field) => (
                      <option key={field} value={field}>
                        {field}
                      </option>
                    )
                  )}
                </select>
              </label>

              <label className="flex flex-col gap-2 text-sm font-medium">
                Objective

                <textarea
                  className="min-h-28 rounded-lg border px-3 py-2"
                  maxLength={1000}
                  value={requestForm.objective}
                  onChange={(event) =>
                    updateRequestField(
                      "objective",
                      event.target.value
                    )
                  }
                  placeholder="What specific outcome would you like to achieve through this mentorship?"
                />

                <span className="text-xs font-normal text-gray-500">
                  10–1,000 characters.
                </span>
              </label>

              <label className="flex flex-col gap-2 text-sm font-medium">
                Motivation

                <textarea
                  className="min-h-32 rounded-lg border px-3 py-2"
                  maxLength={1500}
                  value={requestForm.motivation}
                  onChange={(event) =>
                    updateRequestField(
                      "motivation",
                      event.target.value
                    )
                  }
                  placeholder="Why are you requesting mentorship from this person, and what commitment will you bring?"
                />

                <span className="text-xs font-normal text-gray-500">
                  10–1,500 characters.
                </span>
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-2 text-sm font-medium">
                  Requested period

                  <select
                    className="rounded-lg border px-3 py-2"
                    value={requestForm.requestedDuration}
                    onChange={(event) =>
                      updateRequestField(
                        "requestedDuration",
                        event.target.value as MentorshipDuration
                      )
                    }
                  >
                    {getAcceptedDurations().map(
                      (duration) => (
                        <option
                          key={duration.value}
                          value={duration.value}
                        >
                          {duration.label} · {duration.priceLabel}
                        </option>
                      )
                    )}
                  </select>
                </label>

                <label className="flex flex-col gap-2 text-sm font-medium">
                  Preferred contact frequency

                  <select
                    className="rounded-lg border px-3 py-2"
                    value={requestForm.requestedFrequency}
                    onChange={(event) =>
                      updateRequestField(
                        "requestedFrequency",
                        event.target.value as MentorshipFrequency
                      )
                    }
                  >
                    <option value="weekly">Weekly</option>

                    <option value="fortnightly">
                      Every two weeks
                    </option>

                    <option value="monthly">
                      Monthly
                    </option>

                    <option value="flexible">
                      Flexible
                    </option>
                  </select>
                </label>
              </div>

              <button
                className="w-fit rounded-lg bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                disabled={isSubmittingRequest}
                type="submit"
              >
                {isSubmittingRequest
                  ? "Sending request..."
                  : "Send mentorship request"}
              </button>
            </form>
          )}
        </section>
      )}

      <section className="rounded-xl border p-4">
        <h2 className="text-lg font-semibold sm:text-xl">Published skills</h2>

        {skills.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed p-4 text-sm text-gray-600">
            No published skills are visible yet.
          </p>
        ) : (
          <div className="mt-3 grid gap-3">
            {skills.map((skill) => (
              <article key={skill.id} className="rounded-xl border p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-semibold leading-snug sm:text-base">{skill.name}</h3>
                  <span className="rounded-full border px-2 py-0.5 text-[11px] sm:py-1 sm:text-xs">
                    Rating: {skill.rating ?? "Not rated"}
                  </span>
                </div>
                {skill.description && <p className="mt-2 text-sm leading-snug text-gray-700">{skill.description}</p>}
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-xl border p-4">
        <h2 className="text-lg font-semibold sm:text-xl">Visible library documents</h2>

        {documents.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed p-4 text-sm text-gray-600">
            No library documents are visible yet.
          </p>
        ) : (
          <div className="mt-3 grid gap-3">
            {documents.map((document) => (
              <article
                key={document.id}
                className="flex min-w-0 flex-col justify-between gap-4 rounded-xl border p-4 md:flex-row md:items-center"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <h3 className="min-w-0 break-words text-sm font-semibold leading-snug [overflow-wrap:anywhere] sm:text-base">{document.title}</h3>

                    <span className="rounded-full border px-2 py-1 text-xs">
                      {document.resource_type === "external_link"
                        ? "Online link"
                        : "File"}
                    </span>

                    <span className="rounded-full border px-2 py-1 text-xs">
                      {document.visibility === "public"
                        ? "Public"
                        : "Connections"}
                    </span>
                  </div>

                </div>

                <button
                  className="w-fit rounded-lg bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                  disabled={isWorking}
                  onClick={() => openDocument(document)}
                  type="button"
                >
                  Open
                </button>
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}

function formatMentorshipLevel(level: string) {
  return level
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) =>
      character.toUpperCase()
    );
}

