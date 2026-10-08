"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/browser";
import { ProfileAvatar } from "@/components/profile/ProfileAvatar";
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

type MentorshipRequest = {
  id: string;
  mentee_id: string;
  mentor_id: string;
  mentorship_field: string;
  objective: string;
  motivation: string;
  requested_duration:
    | "3_months"
    | "6_months"
    | "1_year"
    | "ongoing";
  requested_frequency:
    | "weekly"
    | "fortnightly"
    | "monthly"
    | "flexible";
  proposed_duration:
    | "3_months"
    | "6_months"
    | "1_year"
    | "ongoing"
    | null;
  proposed_frequency:
    | "weekly"
    | "fortnightly"
    | "monthly"
    | "flexible"
    | null;
  proposal_message: string | null;
  status:
    | "pending"
    | "change_proposed"
    | "awaiting_payment"
    | "accepted"
    | "declined"
    | "cancelled"
    | "expired";
  requested_payment_mode: "free" | "paid";
  requested_price_amount_minor: number;
  requested_currency: string;
  proposed_payment_mode: "free" | "paid" | null;
  proposed_price_amount_minor: number | null;
  proposed_currency: string | null;
  payment_due_at: string | null;
  requested_at: string;
  expires_at: string | null;
};

type Mentorship = {
  id: string;
  request_id: string;
  mentor_id: string;
  mentee_id: string;
  mentorship_field: string;
  agreed_duration:
    | "3_months"
    | "6_months"
    | "1_year"
    | "ongoing";
  agreed_frequency:
    | "weekly"
    | "fortnightly"
    | "monthly"
    | "flexible";
  objective: string;
  status:
    | "active"
    | "paused"
    | "completion_requested"
    | "completed"
    | "cancelled"
    | "ended_early";
  start_date: string;
  expected_end_date: string | null;
  created_at: string;
  updated_at: string;
};

type PaymentOrder = {
  id: string;
  request_id: string;
  mentorship_id: string | null;
  mentor_id: string;
  mentee_id: string;
  currency: string;
  gross_amount_minor: number;
  status:
    | "awaiting_payment"
    | "paid"
    | "failed"
    | "expired"
    | "cancelled"
    | "refunded"
    | "review_required";
  payment_expires_at: string;
  paid_at: string | null;
  agreed_duration:
    | "3_months"
    | "6_months"
    | "1_year";
  agreed_frequency:
    | "weekly"
    | "fortnightly"
    | "monthly"
    | "flexible";
  mentorship_field: string;
  payment_review_reason: string | null;
  created_at: string;
};

type PaymentInitializationResponse = {
  ok?: boolean;
  state?: string;
  orderId?: string;
  mentorshipId?: string | null;
  authorizationUrl?: string;
  accessCode?: string;
  paymentExpiresAt?: string | null;
  error?: string;
};

type Skill = {
  profile_id: string;
  name: string;
};

type PeopleSearchCriteria = {
  term: string;
  role: string;
  mentor: string;
};

const PEOPLE_SEARCH_PAGE_SIZE = 20;

export function ConnectionWorkflow() {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [mentorshipRequests, setMentorshipRequests] =
    useState<MentorshipRequest[]>([]);
  const [mentorships, setMentorships] =
    useState<Mentorship[]>([]);
  const [paymentOrders, setPaymentOrders] =
    useState<PaymentOrder[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [mentorFilter, setMentorFilter] = useState("all");
  const [peopleSearchResults, setPeopleSearchResults] =
    useState<Profile[]>([]);
  const [peopleSearchCriteria, setPeopleSearchCriteria] =
    useState<PeopleSearchCriteria | null>(null);
  const [peopleSearchOffset, setPeopleSearchOffset] =
    useState(0);
  const [hasMorePeople, setHasMorePeople] =
    useState(false);
  const [hasSearchedPeople, setHasSearchedPeople] =
    useState(false);
  const [isSearchingPeople, setIsSearchingPeople] =
    useState(false);
  const [peopleSearchError, setPeopleSearchError] =
    useState<string | null>(null);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [connectionSearch, setConnectionSearch] = useState("");
  const [connectionSort, setConnectionSort] =
    useState<"newest" | "oldest">("newest");
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isWorking, setIsWorking] = useState(false);
  const [counterproposalRequestId, setCounterproposalRequestId] =
    useState<string | null>(null);
  const [counterproposalDuration, setCounterproposalDuration] =
    useState<"3_months" | "6_months" | "1_year" | "ongoing">(
      "6_months"
    );
  const [counterproposalFrequency, setCounterproposalFrequency] =
    useState<"weekly" | "fortnightly" | "monthly" | "flexible">(
      "monthly"
    );
  const [counterproposalMessage, setCounterproposalMessage] =
    useState("");

  const [
    isMentorshipHistoryOpen,
    setIsMentorshipHistoryOpen,
  ] = useState(false);

  const profileById = useMemo(() => {
    return new Map(profiles.map((profile) => [profile.id, profile]));
  }, [profiles]);

  const skillsByProfileId = useMemo(() => {
    const skillMap = new Map<string, string[]>();

    skills.forEach((skill) => {
      const profileSkills = skillMap.get(skill.profile_id) ?? [];
      profileSkills.push(skill.name);
      skillMap.set(skill.profile_id, profileSkills);
    });

    return skillMap;
  }, [skills]);


  const participantMentorships = mentorships.filter(
    (mentorship) =>
      mentorship.mentor_id === currentUserId ||
      mentorship.mentee_id === currentUserId
  );

  const activeMentorships = participantMentorships.filter(
    (mentorship) =>
      [
        "active",
        "ending",
        "extension_pending",
        "paused",
        "completion_requested",
      ].includes(mentorship.status)
  );

  const historicalMentorships = participantMentorships.filter(
    (mentorship) =>
      [
        "completed",
        "cancelled",
        "ended_early",
      ].includes(mentorship.status)
  );

  const incomingMentorshipRequests =
    mentorshipRequests.filter(
      (request) =>
        request.mentor_id === currentUserId &&
        request.status === "pending"
    );

  const outgoingMentorshipRequests =
    mentorshipRequests.filter(
      (request) =>
        request.mentee_id === currentUserId &&
        (
          request.status === "pending" ||
          request.status === "change_proposed"
        )
    );

  const incomingRequests = connections.filter(
    (connection) => connection.recipient_id === currentUserId && connection.status === "pending"
  );

  const outgoingRequests = connections.filter(
    (connection) => connection.requester_id === currentUserId && connection.status === "pending"
  );

  const acceptedConnections = connections.filter(
    (connection) =>
      connection.status === "accepted" &&
      (connection.requester_id === currentUserId ||
        connection.recipient_id === currentUserId)
  );

  const visibleAcceptedConnections = useMemo(() => {
    const normalizedSearch = connectionSearch.trim().toLowerCase();

    return acceptedConnections
      .filter((connection) => {
        const otherProfileId =
          connection.requester_id === currentUserId
            ? connection.recipient_id
            : connection.requester_id;

        const profile = profileById.get(otherProfileId);
        const profileSkills =
          skillsByProfileId.get(otherProfileId) ?? [];

        if (!normalizedSearch) return true;

        return [
          profile?.display_name,
          profile?.username,
          profile?.field,
          ...profileSkills,
        ]
          .filter((value): value is string => Boolean(value))
          .some((value) =>
            value.toLowerCase().includes(normalizedSearch)
          );
      })
      .sort((left, right) => {
        const leftDate = new Date(left.created_at).getTime();
        const rightDate = new Date(right.created_at).getTime();

        return connectionSort === "newest"
          ? rightDate - leftDate
          : leftDate - rightDate;
      });
  }, [
    acceptedConnections,
    connectionSearch,
    connectionSort,
    currentUserId,
    profileById,
    skillsByProfileId,
  ]);

  async function loadConnections(userId: string) {
    if (!isSupabaseConfigured()) return;

    const supabase = getSupabaseBrowserClient();

    const { data, error } = await supabase
      .from("connections")
      .select("id, requester_id, recipient_id, status, created_at")
      .or(`requester_id.eq.${userId},recipient_id.eq.${userId}`)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Unable to refresh connections:", error);
      return;
    }

    setConnections((data ?? []) as Connection[]);
  }

  async function loadMentorships(userId: string) {
    if (!isSupabaseConfigured()) return;

    const supabase = getSupabaseBrowserClient();

    const { data, error } = await supabase
      .from("mentorships")
      .select(
        "id, request_id, mentor_id, mentee_id, mentorship_field, agreed_duration, agreed_frequency, objective, status, start_date, expected_end_date, created_at, updated_at"
      )
      .or(`mentor_id.eq.${userId},mentee_id.eq.${userId}`)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(
        "Unable to refresh mentorships:",
        error
      );
      return;
    }

    setMentorships((data ?? []) as Mentorship[]);
  }

  async function loadMentorshipRequests(userId: string) {
    if (!isSupabaseConfigured()) return;

    const supabase = getSupabaseBrowserClient();

    const { data, error } = await supabase
      .from("mentorship_requests")
      .select(
        "id, mentee_id, mentor_id, mentorship_field, objective, motivation, requested_duration, requested_frequency, proposed_duration, proposed_frequency, proposal_message, status, requested_payment_mode, requested_price_amount_minor, requested_currency, proposed_payment_mode, proposed_price_amount_minor, proposed_currency, payment_due_at, requested_at, expires_at"
      )
      .or(`mentee_id.eq.${userId},mentor_id.eq.${userId}`)
      .order("requested_at", { ascending: false });

    if (error) {
      console.error(
        "Unable to refresh mentorship requests:",
        error
      );
      return;
    }

    setMentorshipRequests(
      (data ?? []) as MentorshipRequest[]
    );
  }

  async function loadPaymentOrders(userId: string) {
    if (!isSupabaseConfigured()) return;

    const supabase = getSupabaseBrowserClient();

    const { data, error } = await supabase
      .from("mentorship_payment_orders")
      .select(
        "id, request_id, mentorship_id, mentor_id, mentee_id, currency, gross_amount_minor, status, payment_expires_at, paid_at, agreed_duration, agreed_frequency, mentorship_field, payment_review_reason, created_at"
      )
      .or(`mentee_id.eq.${userId},mentor_id.eq.${userId}`)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(
        "Unable to refresh mentorship payment orders:",
        error
      );
      return;
    }

    setPaymentOrders((data ?? []) as PaymentOrder[]);
  }

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

      const [
        { data: connectionsData, error: connectionsError },
        {
          data: mentorshipRequestData,
          error: mentorshipRequestError,
        },
        {
          data: mentorshipData,
          error: mentorshipError,
        },
        {
          data: paymentOrderData,
          error: paymentOrderError,
        },
      ] = await Promise.all([
        supabase
          .from("connections")
          .select(
            "id, requester_id, recipient_id, status, created_at"
          )
          .or(
            `requester_id.eq.${userId},recipient_id.eq.${userId}`
          )
          .order("created_at", { ascending: false }),
        supabase
          .from("mentorship_requests")
          .select(
            "id, mentee_id, mentor_id, mentorship_field, objective, motivation, requested_duration, requested_frequency, proposed_duration, proposed_frequency, proposal_message, status, requested_payment_mode, requested_price_amount_minor, requested_currency, proposed_payment_mode, proposed_price_amount_minor, proposed_currency, payment_due_at, requested_at, expires_at"
          )
          .or(
            `mentee_id.eq.${userId},mentor_id.eq.${userId}`
          )
          .order("requested_at", {
            ascending: false,
          }),
        supabase
          .from("mentorships")
          .select(
            "id, request_id, mentor_id, mentee_id, mentorship_field, agreed_duration, agreed_frequency, objective, status, start_date, expected_end_date, created_at, updated_at"
          )
          .or(
            `mentor_id.eq.${userId},mentee_id.eq.${userId}`
          )
          .order("created_at", {
            ascending: false,
          }),
        supabase
          .from("mentorship_payment_orders")
          .select(
            "id, request_id, mentorship_id, mentor_id, mentee_id, currency, gross_amount_minor, status, payment_expires_at, paid_at, agreed_duration, agreed_frequency, mentorship_field, payment_review_reason, created_at"
          )
          .or(
            `mentor_id.eq.${userId},mentee_id.eq.${userId}`
          )
          .order("created_at", {
            ascending: false,
          }),
      ]);

      if (connectionsError) throw connectionsError;
      if (mentorshipRequestError) {
        throw mentorshipRequestError;
      }
      if (mentorshipError) {
        throw mentorshipError;
      }
      if (paymentOrderError) {
        throw paymentOrderError;
      }

      const connectionRows =
        (connectionsData ?? []) as Connection[];
      const mentorshipRequestRows =
        (mentorshipRequestData ?? []) as MentorshipRequest[];
      const mentorshipRows =
        (mentorshipData ?? []) as Mentorship[];
      const paymentOrderRows =
        (paymentOrderData ?? []) as PaymentOrder[];

      const relatedProfileIds =
        new Set<string>([userId]);

      connectionRows.forEach((connection) => {
        relatedProfileIds.add(connection.requester_id);
        relatedProfileIds.add(connection.recipient_id);
      });

      mentorshipRequestRows.forEach((request) => {
        relatedProfileIds.add(request.mentee_id);
        relatedProfileIds.add(request.mentor_id);
      });

      mentorshipRows.forEach((mentorship) => {
        relatedProfileIds.add(mentorship.mentor_id);
        relatedProfileIds.add(mentorship.mentee_id);
      });

      paymentOrderRows.forEach((order) => {
        relatedProfileIds.add(order.mentor_id);
        relatedProfileIds.add(order.mentee_id);
      });

      let profilesData: Profile[] = [];

      if (relatedProfileIds.size > 0) {
        const {
          data: relatedProfilesData,
          error: relatedProfilesError,
        } = await supabase
          .from("profiles")
          .select(
            "id, display_name, username, role_type, field, bio, mentor_available, avatar_url"
          )
          .in("id", Array.from(relatedProfileIds))
          .is("deleted_at", null)
          .order("display_name", {
            ascending: true,
          });

        if (relatedProfilesError) {
          throw relatedProfilesError;
        }

        profilesData =
          (relatedProfilesData ?? []) as Profile[];
      }

      const acceptedProfileIds =
        Array.from(
          new Set(
            connectionRows
              .filter(
                (connection) =>
                  connection.status === "accepted"
              )
              .map((connection) =>
                connection.requester_id === userId
                  ? connection.recipient_id
                  : connection.requester_id
              )
          )
        );

      let skillsData: Skill[] = [];

      if (acceptedProfileIds.length > 0) {
        const {
          data: relatedSkillsData,
          error: relatedSkillsError,
        } = await supabase
          .from("skills")
          .select("profile_id, name")
          .in("profile_id", acceptedProfileIds)
          .eq("is_published", true)
          .is("deleted_at", null);

        if (relatedSkillsError) {
          throw relatedSkillsError;
        }

        skillsData =
          (relatedSkillsData ?? []) as Skill[];
      }

      setProfiles(profilesData);
      setConnections(connectionRows);
      setMentorshipRequests(
        mentorshipRequestRows
      );
      setMentorships(mentorshipRows);
      setPaymentOrders(paymentOrderRows);
      setSkills(skillsData);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load connection data.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    if (!currentUserId || !isSupabaseConfigured()) return;

    const supabase = getSupabaseBrowserClient();

    const channel = supabase
      .channel(`connections-live:${currentUserId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "connections",
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
          table: "mentorship_requests",
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
          table: "mentorships",
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
          table: "mentorship_payment_orders",
        },
        () => {
          void loadData();
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
      !isSupabaseConfigured() ||
      typeof window === "undefined"
    ) {
      return;
    }

    const params = new URLSearchParams(
      window.location.search
    );

    if (params.get("payment") !== "return") {
      return;
    }

    const orderId = params.get("order");

    if (
      !orderId ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        orderId
      )
    ) {
      const invalidReferenceTimer =
        window.setTimeout(() => {
          setMessage(
            "Unable to confirm payment because the payment reference is invalid."
          );
        }, 0);

      return () => {
        window.clearTimeout(invalidReferenceTimer);
      };
    }

    let cancelled = false;
    let attempts = 0;
    let timer: number | undefined;

    async function checkPaymentState() {
      attempts += 1;

      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("mentorship_payment_orders")
        .select(
          "id, request_id, mentorship_id, mentor_id, mentee_id, currency, gross_amount_minor, status, payment_expires_at, paid_at, agreed_duration, agreed_frequency, mentorship_field, payment_review_reason, created_at"
        )
        .eq("id", orderId)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        setMessage(
          "Payment was submitted, but FieldsConnect could not confirm it yet. Please refresh shortly."
        );
        return;
      }

      if (!data) {
        setMessage(
          "This payment order is not available to your account."
        );
        return;
      }

      const order = data as PaymentOrder;

      setPaymentOrders((current) => [
        order,
        ...current.filter(
          (item) => item.id !== order.id
        ),
      ]);

      if (order.status === "paid") {
        await loadData();

        if (cancelled) return;

        setMessage(
          "Payment confirmed. Your mentorship is now active."
        );
        window.history.replaceState(
          {},
          "",
          "/connections"
        );
        return;
      }

      if (order.status === "review_required") {
        setMessage(
          "Payment was received, but this mentorship needs payment review before activation."
        );
        window.history.replaceState(
          {},
          "",
          "/connections"
        );
        return;
      }

      if (
        ["expired", "failed", "cancelled", "refunded"].includes(
          order.status
        )
      ) {
        setMessage(
          `Payment status: ${order.status.replaceAll("_", " ")}.`
        );
        window.history.replaceState(
          {},
          "",
          "/connections"
        );
        return;
      }

      if (attempts >= 15) {
        setMessage(
          "Payment has been submitted and confirmation is still processing. Refresh this page shortly."
        );
        return;
      }

      timer = window.setTimeout(
        () => void checkPaymentState(),
        2000
      );
    }

    timer = window.setTimeout(() => {
      setMessage("Confirming payment...");
      void checkPaymentState();
    }, 0);

    return () => {
      cancelled = true;

      if (timer !== undefined) {
        window.clearTimeout(timer);
      }
    };
  }, [currentUserId]);

  async function respondToMentorshipRequest(
    requestId: string,
    action: "accept" | "decline" | "counterpropose"
  ) {
    if (!isSupabaseConfigured()) return;

    const normalizedCounterproposalMessage =
      counterproposalMessage.trim();

    if (
      action === "counterpropose" &&
      normalizedCounterproposalMessage.length === 0
    ) {
      setMessage("Add a short message explaining the proposed changes.");
      return;
    }

    const targetRequest =
      mentorshipRequests.find(
        (request) => request.id === requestId
      ) ?? null;

    const effectivePaymentMode =
      targetRequest?.status === "change_proposed" &&
      targetRequest.proposed_payment_mode
        ? targetRequest.proposed_payment_mode
        : targetRequest?.requested_payment_mode;

    setIsWorking(true);
    setMessage(null);

    try {
      const supabase = getSupabaseBrowserClient();

      const { error } = await supabase.rpc(
        "respond_to_mentorship_request",
        {
          target_request_id: requestId,
          response_action: action,
          counterproposal_duration:
            action === "counterpropose"
              ? counterproposalDuration
              : null,
          counterproposal_frequency:
            action === "counterpropose"
              ? counterproposalFrequency
              : null,
          response_message:
            action === "counterpropose"
              ? normalizedCounterproposalMessage
              : null,
        }
      );

      if (error) throw error;

      setMessage(
        action === "accept"
          ? effectivePaymentMode === "paid"
            ? "Mentorship terms accepted. Awaiting mentee payment before activation."
            : "Mentorship request accepted."
          : action === "decline"
            ? "Mentorship request declined."
            : "Mentorship counterproposal sent."
      );

      if (action === "counterpropose") {
        setCounterproposalRequestId(null);
        setCounterproposalDuration("6_months");
        setCounterproposalFrequency("monthly");
        setCounterproposalMessage("");
      }

      if (currentUserId) {
        await Promise.all([
          loadMentorshipRequests(currentUserId),
          loadMentorships(currentUserId),
          loadPaymentOrders(currentUserId),
        ]);
      }
    } catch (error) {
      setMessage(
        getActionErrorMessage(
          error,
          `${action} mentorship request`
        )
      );
    } finally {
      setIsWorking(false);
    }
  }

  async function startMentorshipPayment(
    order: PaymentOrder
  ) {
    if (!isSupabaseConfigured()) return;

    setIsWorking(true);
    setMessage(null);

    try {
      const supabase = getSupabaseBrowserClient();

      const { data, error } =
        await supabase.functions.invoke(
          "initialize-mentorship-payment",
          {
            body: {
              orderId: order.id,
            },
          }
        );

      if (error) throw error;

      const result =
        (data ?? {}) as PaymentInitializationResponse;

      if (result.state === "paid") {
        await loadData();
        setMessage(
          "Payment is already confirmed. Your mentorship is active."
        );
        return;
      }

      if (
        typeof result.authorizationUrl !== "string" ||
        !result.authorizationUrl.startsWith(
          "https://checkout.paystack.com/"
        )
      ) {
        throw new Error(
          result.error ??
            "FieldsConnect could not open the secure payment checkout."
        );
      }

      window.location.assign(
        result.authorizationUrl
      );
    } catch (error) {
      setMessage(
        getActionErrorMessage(
          error,
          "start mentorship payment"
        )
      );
    } finally {
      setIsWorking(false);
    }
  }

  async function sendRequest(profileId: string) {
    if (!currentUserId || !isSupabaseConfigured()) return;

    setIsWorking(true);
    setMessage(null);

    try {
      const supabase = getSupabaseBrowserClient();

      const existingConnection = connections.find(
        (connection) =>
          (connection.requester_id === currentUserId && connection.recipient_id === profileId) ||
          (connection.requester_id === profileId && connection.recipient_id === currentUserId)
      );

      let connectionId: string;

      if (
        existingConnection &&
        (existingConnection.status === "cancelled" || existingConnection.status === "declined")
      ) {
        const { data: connection, error } = await supabase
          .from("connections")
          .update({
            requester_id: currentUserId,
            recipient_id: profileId,
            status: "pending",
            responded_at: null,
            created_at: new Date().toISOString(),
          })
          .eq("id", existingConnection.id)
          .select("id")
          .single();

        if (error) throw error;
        connectionId = connection.id;
      } else {
        const { data: connection, error } = await supabase
          .from("connections")
          .insert({
            requester_id: currentUserId,
            recipient_id: profileId,
            status: "pending",
          })
          .select("id")
          .single();

        if (error) throw error;
        connectionId = connection.id;
      }

      const actor = profileById.get(currentUserId);

      const { error: notificationError } = await supabase.from("notifications").insert({
        recipient_id: profileId,
        actor_id: currentUserId,
        notification_type: "connection_request",
        entity_type: "connection",
        entity_id: connectionId,
        title: "New connection request",
        body: `${actor?.display_name ?? "Someone"} sent you a connection request.`,
      });

      if (notificationError) {
        console.error("Unable to create connection request notification:", notificationError);
      }

      setMessage("Connection request sent.");
      setPeopleSearchResults(
        (currentResults) =>
          currentResults.filter(
            (profile) =>
              profile.id !== profileId
          )
      );
      setPeopleSearchOffset(
        (currentOffset) =>
          Math.max(0, currentOffset - 1)
      );
      await loadData();
    } catch (error) {
      setMessage(getActionErrorMessage(error, "send connection request"));
    } finally {
      setIsWorking(false);
    }
  }

  async function updateRequest(connectionId: string, status: "accepted" | "declined") {
    setIsWorking(true);
    setMessage(null);

    try {
      const supabase = getSupabaseBrowserClient();
      const connection = connections.find((item) => item.id === connectionId);

      const { error } = await supabase
        .from("connections")
        .update({
          status,
          responded_at: new Date().toISOString(),
        })
        .eq("id", connectionId);

      if (error) throw error;

      if (status === "accepted" && connection && currentUserId) {
        const actor = profileById.get(currentUserId);

        const { error: notificationError } = await supabase.from("notifications").insert({
          recipient_id: connection.requester_id,
          actor_id: currentUserId,
          notification_type: "connection_accepted",
          entity_type: "connection",
          entity_id: connection.id,
          title: "Connection request accepted",
          body: `${actor?.display_name ?? "Someone"} accepted your connection request.`,
        });

        if (notificationError) {
          console.error("Unable to create connection accepted notification:", notificationError);
        }
      }

      setMessage(status === "accepted" ? "Connection accepted." : "Connection declined.");
      await loadData();
    } catch (error) {
      setMessage(getActionErrorMessage(error, "update connection request"));
    } finally {
      setIsWorking(false);
    }
  }

  async function disconnectConnection(connectionId: string) {
    const confirmed = window.confirm(
      "Disconnect from this person? Your previous conversation history will be preserved."
    );

    if (!confirmed || !isSupabaseConfigured()) return;

    setIsWorking(true);
    setMessage(null);

    try {
      const supabase = getSupabaseBrowserClient();

      const { error } = await supabase
        .from("connections")
        .update({
          status: "cancelled",
          responded_at: new Date().toISOString(),
        })
        .eq("id", connectionId);

      if (error) throw error;

      setMessage("Connection removed.");
      await loadData();
    } catch (error) {
      setMessage(getActionErrorMessage(error, "remove connection"));
    } finally {
      setIsWorking(false);
    }
  }

  function getOtherProfile(connection: Connection) {
    const otherId = connection.requester_id === currentUserId ? connection.recipient_id : connection.requester_id;
    return profileById.get(otherId);
  }

  function renderMentorshipCard(
    mentorship: Mentorship
  ) {
    const isMentor =
      mentorship.mentor_id === currentUserId;

    const otherProfileId = isMentor
      ? mentorship.mentee_id
      : mentorship.mentor_id;

    const otherProfile =
      profileById.get(otherProfileId);

    const isHistorical =
      mentorship.status === "completed" ||
      mentorship.status === "cancelled" ||
      mentorship.status === "ended_early";

    return (
      <article
        key={mentorship.id}
        className="flex flex-col gap-3 rounded-xl border bg-white p-3 sm:gap-4 sm:p-4"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <ProfileAvatar
              avatarPath={otherProfile?.avatar_url}
              displayName={otherProfile?.display_name}
              size={40}
            />

            <div className="min-w-0">
              <Link
                className="font-semibold hover:underline"
                href={`/profile/${otherProfileId}`}
              >
                {otherProfile?.display_name ??
                  "Unknown profile"}
              </Link>

              <p className="mt-1 text-sm text-gray-600">
                {mentorship.mentorship_field}
              </p>

              {!isHistorical && (
                <p className="mt-1 text-xs font-medium text-gray-500">
                  You are the{" "}
                  {isMentor ? "mentor" : "mentee"}
                </p>
              )}
            </div>
          </div>

          <span className="shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-medium capitalize sm:px-3 sm:text-xs">
            {mentorship.status.replace("_", " ")}
          </span>
        </div>

        <div className="rounded-lg bg-gray-50 px-3 py-2 sm:bg-transparent sm:px-0 sm:py-0">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 sm:text-sm sm:normal-case sm:tracking-normal sm:text-gray-950">
            Objective
          </h3>

          <p className="mt-1 whitespace-pre-wrap text-sm leading-snug text-gray-700">
            {mentorship.objective}
          </p>
        </div>

        {!isHistorical && (
          <div className="grid grid-cols-2 gap-2 text-xs sm:flex sm:flex-wrap">
            <span className="min-w-0 rounded-lg border px-2.5 py-2 text-center sm:rounded-full sm:px-3 sm:py-1">
              {formatMentorshipDuration(
                mentorship.agreed_duration
              )}
            </span>

            <span className="min-w-0 rounded-lg border px-2.5 py-2 text-center sm:rounded-full sm:px-3 sm:py-1">
              {formatMentorshipFrequency(
                mentorship.agreed_frequency
              )}
            </span>

            <span className="min-w-0 rounded-lg border px-2.5 py-2 text-center sm:rounded-full sm:px-3 sm:py-1">
              Started{" "}
              {formatMentorshipDate(
                mentorship.start_date
              )}
            </span>

            <span className="min-w-0 rounded-lg border px-2.5 py-2 text-center sm:rounded-full sm:px-3 sm:py-1">
              {mentorship.expected_end_date
                ? `Expected end ${formatMentorshipDate(
                    mentorship.expected_end_date
                  )}`
                : "Ongoing"}
            </span>
          </div>
        )}

        <Link
          className="inline-flex min-h-10 w-full items-center justify-center rounded-xl bg-gray-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800 sm:w-fit"
          href={`/mentorships/${mentorship.id}`}
        >
          {isHistorical
            ? "View mentorship"
            : "Open mentorship"}
        </Link>
      </article>
    );
  }

  async function searchPeople(
    append: boolean
  ) {
    if (
      !currentUserId ||
      !isSupabaseConfigured() ||
      isSearchingPeople
    ) {
      return;
    }

    const criteria: PeopleSearchCriteria =
      append && peopleSearchCriteria
        ? peopleSearchCriteria
        : {
            term: searchTerm.trim(),
            role: roleFilter,
            mentor: mentorFilter,
          };

    const offset =
      append ? peopleSearchOffset : 0;

    setIsSearchingPeople(true);
    setPeopleSearchError(null);

    if (!append) {
      setPeopleSearchCriteria(criteria);
      setPeopleSearchResults([]);
      setPeopleSearchOffset(0);
      setHasMorePeople(false);
      setHasSearchedPeople(true);
    }

    try {
      const supabase =
        getSupabaseBrowserClient();

      const {
        data,
        error,
      } = await supabase.rpc(
        "search_people",
        {
          search_term: criteria.term,
          role_filter: criteria.role,
          mentor_filter: criteria.mentor,
          result_limit:
            PEOPLE_SEARCH_PAGE_SIZE + 1,
          result_offset: offset,
        }
      );

      if (error) {
        throw error;
      }

      const returnedProfiles =
        (data ?? []) as Profile[];

      const page =
        returnedProfiles.slice(
          0,
          PEOPLE_SEARCH_PAGE_SIZE
        );

      setHasMorePeople(
        returnedProfiles.length >
          PEOPLE_SEARCH_PAGE_SIZE
      );

      setPeopleSearchOffset(
        offset + page.length
      );

      setPeopleSearchResults(
        (currentResults) => {
          const combined =
            append
              ? [...currentResults, ...page]
              : page;

          return Array.from(
            new Map(
              combined.map((profile) => [
                profile.id,
                profile,
              ])
            ).values()
          );
        }
      );
    } catch (error) {
      setPeopleSearchError(
        getActionErrorMessage(
          error,
          "search people"
        )
      );
    } finally {
      setIsSearchingPeople(false);
    }
  }

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:gap-8 sm:px-6 sm:py-8">
      {message && <p className={getMessageAlertClass(message)}>{message}</p>}

      {isLoading ? (
        <p className="text-sm text-gray-600">Loading connections...</p>
      ) : (
        <>
          <ConnectionSection
            title={`Active mentorships · ${activeMentorships.length}`}
          >
            {activeMentorships.length === 0 ? (
              <EmptyState text="No active mentorships yet." />
            ) : (
              activeMentorships.map(
                renderMentorshipCard
              )
            )}
          </ConnectionSection>

          <ConnectionSection title="Mentorship requests">
            {incomingMentorshipRequests.length === 0 ? (
              <EmptyState text="No incoming mentorship requests yet." />
            ) : (
              incomingMentorshipRequests.map((request) => {
                const mentee =
                  profileById.get(request.mentee_id);

                return (
                  <article
                    key={request.id}
                    className="flex flex-col gap-4 rounded-xl border bg-white p-4"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row">
                      <ProfileAvatar
                        avatarPath={mentee?.avatar_url}
                        displayName={mentee?.display_name}
                        size={40}
                      />

                      <div className="min-w-0">
                        <Link
                          className="font-semibold hover:underline"
                          href={`/profile/${request.mentee_id}`}
                        >
                          {mentee?.display_name ??
                            "Unknown profile"}
                        </Link>

                        <p className="mt-1 text-sm text-gray-600">
                          {request.mentorship_field}
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-3 text-sm sm:grid-cols-2">
                      <div>
                        <h3 className="font-semibold">
                          Objective
                        </h3>
                        <p className="mt-1 whitespace-pre-wrap text-gray-700">
                          {request.objective}
                        </p>
                      </div>

                      <div>
                        <h3 className="font-semibold">
                          Motivation
                        </h3>
                        <p className="mt-1 whitespace-pre-wrap text-gray-700">
                          {request.motivation}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full border px-3 py-1">
                        {formatMentorshipDuration(
                          request.requested_duration
                        )}
                      </span>

                      <span className="rounded-full border px-3 py-1">
                        {formatMentorshipFrequency(
                          request.requested_frequency
                        )}
                      </span>

                      <span className="rounded-full border px-3 py-1 font-semibold">
                        {formatRequestPayment(request)}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        className="min-h-10 rounded-xl bg-gray-950 px-3 py-2 text-sm font-medium text-white transition hover:bg-gray-800 disabled:opacity-50"
                        disabled={isWorking}
                        onClick={() =>
                          respondToMentorshipRequest(
                            request.id,
                            "accept"
                          )
                        }
                        type="button"
                      >
                        Accept
                      </button>

                      <button
                        className="rounded-lg border px-3 py-2 text-sm font-medium disabled:opacity-50"
                        disabled={isWorking}
                        onClick={() =>
                          respondToMentorshipRequest(
                            request.id,
                            "decline"
                          )
                        }
                        type="button"
                      >
                        Decline
                      </button>

                      <button
                        className="rounded-lg border px-3 py-2 text-sm font-medium disabled:opacity-50"
                        disabled={isWorking}
                        onClick={() => {
                          setCounterproposalRequestId(
                            counterproposalRequestId === request.id
                              ? null
                              : request.id
                          );
                          setCounterproposalDuration(
                            request.requested_duration
                          );
                          setCounterproposalFrequency(
                            request.requested_frequency
                          );
                          setCounterproposalMessage("");
                          setMessage(null);
                        }}
                        type="button"
                      >
                        {counterproposalRequestId === request.id
                          ? "Cancel changes"
                          : "Propose changes"}
                      </button>
                    </div>

                    {counterproposalRequestId === request.id && (
                      <div className="grid gap-3 rounded-xl border bg-gray-50 p-4">
                        <h3 className="font-semibold">
                          Counterproposal
                        </h3>

                        <div className="grid gap-3 sm:grid-cols-2">
                          <label className="flex flex-col gap-2 text-sm font-medium">
                            Duration
                            <select
                              className="rounded-lg border bg-white px-3 py-2 font-normal"
                              disabled={isWorking}
                              onChange={(event) =>
                                setCounterproposalDuration(
                                  event.target.value as
                                    | "3_months"
                                    | "6_months"
                                    | "1_year"
                                    | "ongoing"
                                )
                              }
                              value={counterproposalDuration}
                            >
                              <option value="3_months">
                                3 months
                              </option>
                              <option value="6_months">
                                6 months
                              </option>
                              <option value="1_year">
                                1 year
                              </option>
                              <option value="ongoing">
                                Ongoing
                              </option>
                            </select>
                          </label>

                          <label className="flex flex-col gap-2 text-sm font-medium">
                            Frequency
                            <select
                              className="rounded-lg border bg-white px-3 py-2 font-normal"
                              disabled={isWorking}
                              onChange={(event) =>
                                setCounterproposalFrequency(
                                  event.target.value as
                                    | "weekly"
                                    | "fortnightly"
                                    | "monthly"
                                    | "flexible"
                                )
                              }
                              value={counterproposalFrequency}
                            >
                              <option value="weekly">
                                Weekly
                              </option>
                              <option value="fortnightly">
                                Fortnightly
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

                        <label className="flex flex-col gap-2 text-sm font-medium">
                          Message
                          <textarea
                            className="min-h-24 rounded-lg border bg-white px-3 py-2 font-normal"
                            disabled={isWorking}
                            maxLength={1000}
                            onChange={(event) =>
                              setCounterproposalMessage(
                                event.target.value
                              )
                            }
                            placeholder="Explain the proposed duration or meeting frequency."
                            value={counterproposalMessage}
                          />
                        </label>

                        <div>
                          <button
                            className="min-h-10 rounded-xl bg-gray-950 px-3 py-2 text-sm font-medium text-white transition hover:bg-gray-800 disabled:opacity-50"
                            disabled={
                              isWorking ||
                              counterproposalMessage.trim().length === 0
                            }
                            onClick={() =>
                              respondToMentorshipRequest(
                                request.id,
                                "counterpropose"
                              )
                            }
                            type="button"
                          >
                            Send counterproposal
                          </button>
                        </div>
                      </div>
                    )}
                  </article>
                );
              })
            )}
          </ConnectionSection>

          <ConnectionSection
            title={`Mentorship payments · ${paymentOrders.length}`}
          >
            {paymentOrders.length === 0 ? (
              <EmptyState text="No mentorship payments yet." />
            ) : (
              paymentOrders.map((order) => {
                const isMentee =
                  order.mentee_id === currentUserId;
                const otherProfileId = isMentee
                  ? order.mentor_id
                  : order.mentee_id;
                const otherProfile =
                  profileById.get(otherProfileId);

                return (
                  <article
                    key={order.id}
                    className="flex flex-col gap-4 rounded-xl border bg-white p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <ProfileAvatar
                          avatarPath={otherProfile?.avatar_url}
                          displayName={otherProfile?.display_name}
                          size={40}
                        />

                        <div className="min-w-0">
                          <Link
                            className="font-semibold hover:underline"
                            href={`/profile/${otherProfileId}`}
                          >
                            {otherProfile?.display_name ??
                              "Unknown profile"}
                          </Link>

                          <p className="mt-1 text-sm text-gray-600">
                            {order.mentorship_field}
                          </p>

                          <p className="mt-1 text-xs text-gray-500">
                            {isMentee
                              ? "You are the mentee"
                              : "You are the mentor"}
                          </p>
                        </div>
                      </div>

                      <span className="shrink-0 rounded-full border px-3 py-1 text-xs font-medium capitalize">
                        {order.status.replaceAll(
                          "_",
                          " "
                        )}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full border px-3 py-1 font-semibold">
                        {formatPaymentAmount(
                          order.gross_amount_minor,
                          order.currency
                        )}
                      </span>
                      <span className="rounded-full border px-3 py-1">
                        {formatMentorshipDuration(
                          order.agreed_duration
                        )}
                      </span>
                      <span className="rounded-full border px-3 py-1">
                        {formatMentorshipFrequency(
                          order.agreed_frequency
                        )}
                      </span>
                    </div>

                    {order.status ===
                      "awaiting_payment" && (
                      <div className="rounded-xl border bg-gray-50 p-3 text-sm text-gray-700">
                        <p>
                          Payment is required before this
                          mentorship becomes active.
                        </p>
                        <p className="mt-1 text-xs text-gray-500">
                          Payment window ends{" "}
                          {new Intl.DateTimeFormat(
                            undefined,
                            {
                              dateStyle: "medium",
                              timeStyle: "short",
                            }
                          ).format(
                            new Date(
                              order.payment_expires_at
                            )
                          )}
                          .
                        </p>
                      </div>
                    )}

                    {order.status ===
                      "review_required" && (
                      <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                        Payment was received but requires
                        review before mentorship activation.
                      </p>
                    )}

                    {order.status === "paid" &&
                      order.mentorship_id && (
                        <Link
                          className="w-fit rounded-xl bg-gray-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800"
                          href={`/mentorships/${order.mentorship_id}`}
                        >
                          Open mentorship
                        </Link>
                      )}

                    {order.status ===
                      "awaiting_payment" &&
                      isMentee && (
                        <button
                          className="w-fit rounded-xl bg-gray-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800 disabled:opacity-50"
                          disabled={isWorking}
                          onClick={() =>
                            void startMentorshipPayment(
                              order
                            )
                          }
                          type="button"
                        >
                          {isWorking
                            ? "Opening secure checkout..."
                            : `Pay ${formatPaymentAmount(
                                order.gross_amount_minor,
                                order.currency
                              )}`}
                        </button>
                      )}

                    {order.status ===
                      "awaiting_payment" &&
                      !isMentee && (
                        <p className="text-sm text-gray-600">
                          Waiting for the mentee to complete
                          payment. The mentorship will only
                          activate after server verification.
                        </p>
                      )}
                  </article>
                );
              })
            )}
          </ConnectionSection>

          <ConnectionSection title="Outgoing mentorship requests">
            {outgoingMentorshipRequests.length === 0 ? (
              <EmptyState text="No outgoing mentorship requests pending." />
            ) : (
              outgoingMentorshipRequests.map((request) => {
                const mentor =
                  profileById.get(request.mentor_id);

                return (
                  <article
                    key={request.id}
                    className="flex flex-col gap-3 rounded-xl border bg-white p-4"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row">
                      <ProfileAvatar
                        avatarPath={mentor?.avatar_url}
                        displayName={mentor?.display_name}
                        size={40}
                      />

                      <div>
                        <Link
                          className="font-semibold hover:underline"
                          href={`/profile/${request.mentor_id}`}
                        >
                          {mentor?.display_name ??
                            "Unknown profile"}
                        </Link>

                        <p className="mt-1 text-sm text-gray-600">
                          {request.mentorship_field}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full border px-3 py-1">
                        {formatMentorshipDuration(
                          request.proposed_duration ??
                            request.requested_duration
                        )}
                      </span>

                      <span className="rounded-full border px-3 py-1">
                        {formatMentorshipFrequency(
                          request.proposed_frequency ??
                            request.requested_frequency
                        )}
                      </span>

                      <span className="rounded-full border px-3 py-1 capitalize">
                        {request.status.replace("_", " ")}
                      </span>

                      <span className="rounded-full border px-3 py-1 font-semibold">
                        {formatRequestPayment(request)}
                      </span>
                    </div>

                    {request.proposal_message && (
                      <div className="rounded-xl border bg-gray-50 p-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                          Mentor proposal
                        </p>
                        <p className="mt-1 whitespace-pre-wrap text-sm text-gray-700">
                          {request.proposal_message}
                        </p>
                      </div>
                    )}

                    {request.status === "change_proposed" && (
                      <div className="flex flex-wrap gap-2">
                        <button
                          className="min-h-10 rounded-xl bg-gray-950 px-3 py-2 text-sm font-medium text-white transition hover:bg-gray-800 disabled:opacity-50"
                          disabled={isWorking}
                          onClick={() =>
                            respondToMentorshipRequest(
                              request.id,
                              "accept"
                            )
                          }
                          type="button"
                        >
                          Accept proposal
                        </button>

                        <button
                          className="rounded-lg border px-3 py-2 text-sm font-medium disabled:opacity-50"
                          disabled={isWorking}
                          onClick={() =>
                            respondToMentorshipRequest(
                              request.id,
                              "decline"
                            )
                          }
                          type="button"
                        >
                          Decline proposal
                        </button>
                      </div>
                    )}
                  </article>
                );
              })
            )}
          </ConnectionSection>

          <section className="flex flex-col gap-3">
            <button
              aria-expanded={isMentorshipHistoryOpen}
              className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border bg-white px-4 py-3 text-left transition hover:bg-gray-50"
              onClick={() =>
                setIsMentorshipHistoryOpen(
                  (current) => !current
                )
              }
              type="button"
            >
              <span className="text-lg font-semibold sm:text-xl">
                Mentorship history · {historicalMentorships.length}
              </span>

              <svg
                aria-hidden="true"
                className={`h-5 w-5 shrink-0 transition-transform ${
                  isMentorshipHistoryOpen
                    ? "rotate-180"
                    : ""
                }`}
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path
                  d="m6 9 6 6 6-6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>

            {isMentorshipHistoryOpen && (
              <div className="max-h-[28rem] space-y-3 overflow-y-auto pr-1">
                {historicalMentorships.length === 0 ? (
                  <EmptyState text="No completed or closed mentorships yet." />
                ) : (
                  historicalMentorships.map(
                    renderMentorshipCard
                  )
                )}
              </div>
            )}
          </section>

          <ConnectionSection title="Incoming requests">
            {incomingRequests.length === 0 ? (
              <EmptyState text="No incoming requests yet." />
            ) : (
              incomingRequests.map((connection) => {
                const profile = profileById.get(connection.requester_id);
                return (
                  <ConnectionCard key={connection.id} profile={profile}>
                    <div className="flex flex-wrap gap-2">
                      <button
                        className="min-h-10 rounded-xl bg-gray-950 px-3 py-2 text-sm font-medium text-white transition hover:bg-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:opacity-50"
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

          <ConnectionSection
            title={`Your connections · ${acceptedConnections.length}`}
          >
            {acceptedConnections.length === 0 ? (
              <EmptyState text="No connections yet." />
            ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_150px]">
                  <label className="flex flex-col gap-2 text-sm font-medium">
                    Search
                    <input
                      className="rounded-lg border px-3 py-2 font-normal"
                      onChange={(event) =>
                        setConnectionSearch(event.target.value)
                      }
                      placeholder="Name, field, or skill"
                      type="search"
                      value={connectionSearch}
                    />
                  </label>

                  <label className="flex flex-col gap-2 text-sm font-medium">
                    Sort
                    <select
                      className="rounded-lg border px-3 py-2 font-normal"
                      onChange={(event) =>
                        setConnectionSort(
                          event.target.value as "newest" | "oldest"
                        )
                      }
                      value={connectionSort}
                    >
                      <option value="newest">Newest</option>
                      <option value="oldest">Oldest</option>
                    </select>
                  </label>
                </div>

                <p className="text-xs text-gray-500">
                  {visibleAcceptedConnections.length}{" "}
                  {visibleAcceptedConnections.length === 1
                    ? "connection"
                    : "connections"}{" "}
                  shown
                </p>

                {visibleAcceptedConnections.length === 0 ? (
                  <EmptyState text="No connections match your search." />
                ) : (
                  <div className="max-h-48 space-y-3 overflow-y-auto pr-1">
                    {visibleAcceptedConnections.map((connection) => {
                      const profile = getOtherProfile(connection);
                      const profileSkills = profile
                        ? skillsByProfileId.get(profile.id) ?? []
                        : [];

                      return (
                        <ConnectionCard
                          key={connection.id}
                          profile={profile}
                          skills={profileSkills}
                          showBio={false}
                          showMentorAvailability={false}
                        >
                          <div className="flex items-center gap-2">
                            <Link
                              aria-label={`Message ${profile?.display_name ?? "connection"}`}
                              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-blue-200 text-blue-600 transition hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
                              href={`/messages?connection=${encodeURIComponent(connection.id)}`}
                              title="Message"
                            >
                              <svg
                                aria-hidden="true"
                                className="h-5 w-5"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth="2"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M8 10h8M8 14h5m-7 6 3.5-3H18a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h.5L6 20Z"
                                />
                              </svg>
                            </Link>

                            <button
                              aria-label={`Disconnect from ${profile?.display_name ?? "connection"}`}
                              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-red-200 text-red-600 transition hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2 disabled:opacity-50"
                              disabled={isWorking}
                              onClick={() =>
                                disconnectConnection(connection.id)
                              }
                              title="Disconnect"
                              type="button"
                            >
                              <img
                                alt=""
                                aria-hidden="true"
                                className="h-5 w-5 object-contain"
                                src="/icons/disconnect-icon.png"
                              />
                            </button>
                          </div>
                        </ConnectionCard>
                      );
                    })}
                  </div>
                )}
              </>
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
            <form
              className="rounded-xl border bg-white p-4"
              onSubmit={(event) => {
                event.preventDefault();
                void searchPeople(false);
              }}
            >
              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_180px_auto] md:items-end">
                <label className="flex flex-col gap-2 text-sm font-medium">
                  Search people
                  <input
                    className="rounded-lg border px-3 py-2 font-normal"
                    onChange={(event) =>
                      setSearchTerm(
                        event.target.value
                      )
                    }
                    placeholder="Search by name, field, or skill..."
                    type="search"
                    value={searchTerm}
                  />
                </label>

                <label className="flex flex-col gap-2 text-sm font-medium">
                  Role type
                  <select
                    className="rounded-lg border px-3 py-2 font-normal"
                    onChange={(event) =>
                      setRoleFilter(
                        event.target.value
                      )
                    }
                    value={roleFilter}
                  >
                    <option value="all">
                      All role types
                    </option>
                    <option value="student">
                      Student
                    </option>
                    <option value="professional">
                      Professional
                    </option>
                    <option value="institution">
                      Institution
                    </option>
                  </select>
                </label>

                <label className="flex flex-col gap-2 text-sm font-medium">
                  Mentor status
                  <select
                    className="rounded-lg border px-3 py-2 font-normal"
                    onChange={(event) =>
                      setMentorFilter(
                        event.target.value
                      )
                    }
                    value={mentorFilter}
                  >
                    <option value="all">
                      Everyone
                    </option>
                    <option value="mentors">
                      Available mentors
                    </option>
                    <option value="non-mentors">
                      Not mentoring
                    </option>
                  </select>
                </label>

                <button
                  className="min-h-10 rounded-xl bg-gray-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800 disabled:opacity-50"
                  disabled={isSearchingPeople}
                  type="submit"
                >
                  {isSearchingPeople
                    ? "Searching..."
                    : "Search"}
                </button>
              </div>

              <p className="mt-3 text-xs text-gray-500">
                {hasSearchedPeople
                  ? `${peopleSearchResults.length} ${
                      peopleSearchResults.length === 1
                        ? "result"
                        : "results"
                    } loaded`
                  : "Search FieldsConnect by name, field, skill, role type, or mentor availability."}
              </p>

              {peopleSearchError && (
                <p className="mt-2 text-sm text-red-700">
                  {peopleSearchError}
                </p>
              )}
            </form>

            {!hasSearchedPeople ? (
              <EmptyState text="Search for people to view matching profiles." />
            ) : peopleSearchResults.length === 0 ? (
              <EmptyState text="No matching people found." />
            ) : (
              <>
                {peopleSearchResults.map(
                  (profile) => (
                    <ConnectionCard
                      key={profile.id}
                      profile={profile}
                    >
                      <button
                        className="min-h-10 rounded-xl bg-gray-950 px-3 py-2 text-sm font-medium text-white transition hover:bg-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:opacity-50"
                        disabled={isWorking}
                        onClick={() =>
                          sendRequest(
                            profile.id
                          )
                        }
                      >
                        Connect
                      </button>
                    </ConnectionCard>
                  )
                )}

                {hasMorePeople && (
                  <button
                    className="min-h-10 w-full rounded-xl border bg-white px-4 py-2 text-sm font-medium transition hover:bg-gray-50 disabled:opacity-50 sm:w-fit"
                    disabled={isSearchingPeople}
                    onClick={() =>
                      void searchPeople(true)
                    }
                    type="button"
                  >
                    {isSearchingPeople
                      ? "Loading..."
                      : "Load more"}
                  </button>
                )}
              </>
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
      <h2 className="text-lg font-semibold sm:text-xl">{title}</h2>
      <div className="grid gap-3">{children}</div>
    </section>
  );
}

function ConnectionCard({
  profile,
  skills = [],
  showBio = true,
  showMentorAvailability = true,
  children,
}: {
  profile?: Profile;
  skills?: string[];
  showBio?: boolean;
  showMentorAvailability?: boolean;
  children: React.ReactNode;
}) {
  const identity = (
    <>
      <ProfileAvatar avatarPath={profile?.avatar_url} displayName={profile?.display_name} size={40} />
      <div>
        <h3 className="text-sm font-semibold leading-snug sm:text-base">
          {profile?.display_name ?? "Unknown profile"}
        </h3>
        <p className="text-xs leading-snug text-gray-600 sm:text-sm">
          {[profile?.role_type, profile?.field].filter(Boolean).join(" - ") || "No field added yet"}
        </p>
        {showBio && profile?.bio && (
          <p className="mt-2 line-clamp-3 max-w-2xl text-sm leading-snug text-gray-700">
            {profile.bio}
          </p>
        )}

        {skills.length > 0 && (
          <p className="mt-2 text-xs text-gray-500">
            {skills.slice(0, 4).join(" · ")}
          </p>
        )}

        {showMentorAvailability && profile?.mentor_available && (
          <p className="mt-2 text-xs font-medium sm:text-sm">
            Available as mentor
          </p>
        )}
      </div>
    </>
  );

  return (
    <article className="flex min-w-0 flex-col justify-between gap-4 rounded-xl border bg-white p-4 md:flex-row md:items-center">
      {profile ? (
        <Link className="flex min-w-0 gap-3 rounded-lg hover:bg-gray-50" href={`/profile/${profile.id}`}>
          {identity}
        </Link>
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row">{identity}</div>
      )}
      <div>{children}</div>
    </article>
  );
}

function formatPaymentAmount(
  amountMinor: number,
  currency: string
) {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency,
  }).format(amountMinor / 100);
}

function formatRequestPayment(
  request: MentorshipRequest
) {
  const useProposed =
    request.status === "change_proposed" &&
    request.proposed_payment_mode !== null;

  const paymentMode = useProposed
    ? request.proposed_payment_mode
    : request.requested_payment_mode;
  const amountMinor = useProposed
    ? request.proposed_price_amount_minor
    : request.requested_price_amount_minor;
  const currency = useProposed
    ? request.proposed_currency
    : request.requested_currency;

  if (
    paymentMode !== "paid" ||
    amountMinor === null ||
    currency === null
  ) {
    return "Free";
  }

  return formatPaymentAmount(
    amountMinor,
    currency
  );
}

function formatMentorshipDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
  }).format(new Date(`${value}T00:00:00`));
}

function formatMentorshipDuration(
  duration:
    | "3_months"
    | "6_months"
    | "1_year"
    | "ongoing"
) {
  const labels = {
    "3_months": "3 months",
    "6_months": "6 months",
    "1_year": "1 year",
    ongoing: "Full-time / ongoing",
  };

  return labels[duration];
}

function formatMentorshipFrequency(
  frequency:
    | "weekly"
    | "fortnightly"
    | "monthly"
    | "flexible"
) {
  const labels = {
    weekly: "Weekly",
    fortnightly: "Every two weeks",
    monthly: "Monthly",
    flexible: "Flexible",
  };

  return labels[frequency];
}

function EmptyState({ text }: { text: string }) {
  return <p className="rounded-xl border border-dashed p-4 text-sm text-gray-600">{text}</p>;
}
