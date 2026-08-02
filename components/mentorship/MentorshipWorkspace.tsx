"use client";

import Link from "next/link";
import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { ProfileAvatar } from "@/components/profile/ProfileAvatar";
import {
  getSupabaseBrowserClient,
  isSupabaseConfigured,
} from "@/lib/supabase/browser";

type Profile = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  field: string | null;
  role_type: string;
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
    | "ending"
    | "paused"
    | "completion_requested"
    | "completed"
    | "cancelled"
    | "ended_early";
  start_date: string;
  expected_end_date: string | null;
  paused_at: string | null;
  paused_by: string | null;
  pause_reason: string | null;
  resumed_at: string | null;
  completion_requested_by: string | null;
  completion_requested_at: string | null;
  completion_request_note: string | null;
  completion_responded_by: string | null;
  completion_responded_at: string | null;
  completion_response_note: string | null;
  completed_at: string | null;
  ended_early_at: string | null;
  ended_early_by: string | null;
  end_reason: string | null;
};

type MentorshipUpdate = {
  id: string;
  mentorship_id: string;
  author_id: string;
  update_type:
    | "progress"
    | "discussion"
    | "reflection"
    | "decision";
  body: string;
  created_at: string;
  updated_at: string;
  edited_at: string | null;
};

type MentorshipMilestone = {
  id: string;
  mentorship_id: string;
  created_by: string;
  title: string;
  description: string | null;
  target_date: string | null;
  status:
    | "planned"
    | "in_progress"
    | "completed"
    | "cancelled";
  completed_by: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

type MentorshipActionItem = {
  id: string;
  mentorship_id: string;
  created_by: string;
  assigned_to: string;
  milestone_id: string | null;
  title: string;
  description: string | null;
  due_date: string | null;
  status:
    | "open"
    | "in_progress"
    | "awaiting_review"
    | "revision_requested"
    | "completed"
    | "cancelled";
  completion_summary: string | null;
  completion_submitted_at: string | null;
  completion_rating: number | null;
  completion_review: string | null;
  completion_reviewed_at: string | null;
  completion_reviewed_by: string | null;
  completed_by: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

type MentorshipWorkspaceProps = {
  mentorshipId: string;
};

export function MentorshipWorkspace({
  mentorshipId,
}: MentorshipWorkspaceProps) {
  const [currentUserId, setCurrentUserId] =
    useState<string | null>(null);

  const [mentorship, setMentorship] =
    useState<Mentorship | null>(null);

  const [profiles, setProfiles] =
    useState<Profile[]>([]);

  const [updates, setUpdates] =
    useState<MentorshipUpdate[]>([]);

  const [milestones, setMilestones] =
    useState<MentorshipMilestone[]>([]);

  const [actionItems, setActionItems] =
    useState<MentorshipActionItem[]>([]);

  const [updateType, setUpdateType] =
    useState<MentorshipUpdate["update_type"]>(
      "progress"
    );

  const [updateBody, setUpdateBody] =
    useState("");

  const [milestoneTitle, setMilestoneTitle] =
    useState("");

  const [
    milestoneDescription,
    setMilestoneDescription,
  ] = useState("");

  const [
    milestoneTargetDate,
    setMilestoneTargetDate,
  ] = useState("");

  const [actionItemTitle, setActionItemTitle] =
    useState("");

  const [
    actionItemDescription,
    setActionItemDescription,
  ] = useState("");

  const [
    actionItemDueDate,
    setActionItemDueDate,
  ] = useState("");

  const [
    actionItemAssignee,
    setActionItemAssignee,
  ] = useState("");

  const [
    actionItemMilestoneId,
    setActionItemMilestoneId,
  ] = useState("");

  const [message, setMessage] =
    useState<string | null>(null);

  const [pauseReason, setPauseReason] =
    useState("");

  const [
    completionRequestNote,
    setCompletionRequestNote,
  ] = useState("");

  const [
    completionResponseNote,
    setCompletionResponseNote,
  ] = useState("");

  const [earlyEndingReason, setEarlyEndingReason] =
    useState("");

  const [
    lifecycleAction,
    setLifecycleAction,
  ] = useState<string | null>(null);

  const [isLoading, setIsLoading] =
    useState(true);

  const [isSubmittingUpdate, setIsSubmittingUpdate] =
    useState(false);

  const [
    isSubmittingMilestone,
    setIsSubmittingMilestone,
  ] = useState(false);

  const [
    updatingMilestoneId,
    setUpdatingMilestoneId,
  ] = useState<string | null>(null);

  const [
    isSubmittingActionItem,
    setIsSubmittingActionItem,
  ] = useState(false);

  const [
    selectedActionItemId,
    setSelectedActionItemId,
  ] = useState<string | null>(null);

  const [
    updatingActionItemId,
    setUpdatingActionItemId,
  ] = useState<string | null>(null);

  const profileById = useMemo(
    () =>
      new Map(
        profiles.map((profile) => [
          profile.id,
          profile,
        ])
      ),
    [profiles]
  );

  const mentor = mentorship
    ? profileById.get(mentorship.mentor_id)
    : undefined;

  const mentee = mentorship
    ? profileById.get(mentorship.mentee_id)
    : undefined;

  const participantProfiles = useMemo(
    () => {
      if (!mentorship) {
        return [];
      }

      return [
        profileById.get(mentorship.mentor_id),
        profileById.get(mentorship.mentee_id),
      ].filter(
        (profile): profile is Profile =>
          Boolean(profile)
      );
    },
    [mentorship, profileById]
  );

  const currentUserRole =
    mentorship && currentUserId
      ? mentorship.mentor_id === currentUserId
        ? "mentor"
        : mentorship.mentee_id === currentUserId
          ? "mentee"
          : null
      : null;

  const selectedActionItem =
    selectedActionItemId
      ? actionItems.find(
          (item) =>
            item.id === selectedActionItemId
        ) ?? null
      : null;

  const loadWorkspace = useCallback(
    async (showLoader = false) => {
      if (!isSupabaseConfigured()) {
        setMessage("Supabase is not configured yet.");
        setIsLoading(false);
        return;
      }

      if (showLoader) {
        setIsLoading(true);
      }

      try {
        const supabase =
          getSupabaseBrowserClient();

        const {
          data: sessionData,
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) {
          throw sessionError;
        }

        const userId =
          sessionData.session?.user.id;

        if (!userId) {
          setCurrentUserId(null);
          setMentorship(null);
          setMessage(
            "Please log in before viewing this mentorship."
          );
          return;
        }

        setCurrentUserId(userId);

        const {
          data: mentorshipData,
          error: mentorshipError,
        } = await supabase
          .from("mentorships")
          .select(
            "id, request_id, mentor_id, mentee_id, mentorship_field, agreed_duration, agreed_frequency, objective, status, start_date, expected_end_date, paused_at, paused_by, pause_reason, resumed_at, completion_requested_by, completion_requested_at, completion_request_note, completion_responded_by, completion_responded_at, completion_response_note, completed_at, ended_early_at, ended_early_by, end_reason"
          )
          .eq("id", mentorshipId)
          .maybeSingle();

        if (mentorshipError) {
          throw mentorshipError;
        }

        if (!mentorshipData) {
          setMentorship(null);
          setProfiles([]);
          setUpdates([]);
          setMilestones([]);
          setActionItems([]);
          setMessage(
            "This mentorship is unavailable or you do not have access to it."
          );
          return;
        }

        const loadedMentorship =
          mentorshipData as Mentorship;

        const [
          profileResult,
          updatesResult,
          milestonesResult,
          actionItemsResult,
        ] = await Promise.all([
          supabase
            .from("profiles")
            .select(
              "id, display_name, avatar_url, field, role_type"
            )
            .in("id", [
              loadedMentorship.mentor_id,
              loadedMentorship.mentee_id,
            ]),

          supabase
            .from("mentorship_updates")
            .select(
              "id, mentorship_id, author_id, update_type, body, created_at, updated_at, edited_at"
            )
            .eq("mentorship_id", mentorshipId)
            .order("created_at", {
              ascending: false,
            }),

          supabase
            .from("mentorship_milestones")
            .select(
              "id, mentorship_id, created_by, title, description, target_date, status, completed_by, completed_at, created_at, updated_at"
            )
            .eq("mentorship_id", mentorshipId)
            .order("created_at", {
              ascending: false,
            }),

          supabase
            .from("mentorship_action_items")
            .select(
              "id, mentorship_id, created_by, assigned_to, milestone_id, title, description, due_date, status, completion_summary, completion_submitted_at, completion_rating, completion_review, completion_reviewed_at, completion_reviewed_by, completed_by, completed_at, created_at, updated_at"
            )
            .eq("mentorship_id", mentorshipId)
            .order("created_at", {
              ascending: false,
            }),
        ]);

        if (profileResult.error) {
          throw profileResult.error;
        }

        if (updatesResult.error) {
          throw updatesResult.error;
        }

        if (milestonesResult.error) {
          throw milestonesResult.error;
        }

        if (actionItemsResult.error) {
          throw actionItemsResult.error;
        }

        setMentorship(loadedMentorship);
        setProfiles(
          (profileResult.data ?? []) as Profile[]
        );
        setUpdates(
          (updatesResult.data ??
            []) as MentorshipUpdate[]
        );
        setMilestones(
          (milestonesResult.data ??
            []) as MentorshipMilestone[]
        );
        setActionItems(
          (actionItemsResult.data ??
            []) as MentorshipActionItem[]
        );
        setMessage(null);
      } catch (error) {
        setMessage(getErrorMessage(error));
      } finally {
        setIsLoading(false);
      }
    },
    [mentorshipId]
  );

  useEffect(() => {
    void loadWorkspace(true);
  }, [loadWorkspace]);

  useEffect(() => {
    if (
      !isSupabaseConfigured() ||
      !currentUserId ||
      !mentorship
    ) {
      return;
    }

    const supabase =
      getSupabaseBrowserClient();

    const channel = supabase
      .channel(
        `mentorship-workspace:${mentorshipId}`
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "mentorships",
          filter: `id=eq.${mentorshipId}`,
        },
        () => {
          void loadWorkspace();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "mentorship_updates",
          filter: `mentorship_id=eq.${mentorshipId}`,
        },
        () => {
          void loadWorkspace();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "mentorship_milestones",
          filter: `mentorship_id=eq.${mentorshipId}`,
        },
        () => {
          void loadWorkspace();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "mentorship_action_items",
          filter: `mentorship_id=eq.${mentorshipId}`,
        },
        () => {
          void loadWorkspace();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [
    currentUserId,
    loadWorkspace,
    mentorship,
    mentorshipId,
  ]);

  async function submitUpdate(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (
      !currentUserId ||
      !mentorship
    ) {
      return;
    }

    const trimmedBody =
      updateBody.trim();

    if (trimmedBody.length < 2) {
      setMessage(
        "The update must contain at least 2 characters."
      );
      return;
    }

    setIsSubmittingUpdate(true);
    setMessage(null);

    try {
      const supabase =
        getSupabaseBrowserClient();

      const { error } = await supabase
        .from("mentorship_updates")
        .insert({
          mentorship_id: mentorship.id,
          author_id: currentUserId,
          update_type: updateType,
          body: trimmedBody,
        });

      if (error) {
        throw error;
      }

      setUpdateBody("");
      setUpdateType("progress");
      setMessage("Mentorship update added.");

      await loadWorkspace();
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setIsSubmittingUpdate(false);
    }
  }

  async function submitMilestone(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (
      !currentUserId ||
      !mentorship
    ) {
      return;
    }

    const trimmedTitle =
      milestoneTitle.trim();

    const trimmedDescription =
      milestoneDescription.trim();

    if (trimmedTitle.length < 2) {
      setMessage(
        "The milestone title must contain at least 2 characters."
      );
      return;
    }

    setIsSubmittingMilestone(true);
    setMessage(null);

    try {
      const supabase =
        getSupabaseBrowserClient();

      const { error } = await supabase
        .from("mentorship_milestones")
        .insert({
          mentorship_id: mentorship.id,
          created_by: currentUserId,
          title: trimmedTitle,
          description:
            trimmedDescription || null,
          target_date:
            milestoneTargetDate || null,
          status: "planned",
        });

      if (error) {
        throw error;
      }

      setMilestoneTitle("");
      setMilestoneDescription("");
      setMilestoneTargetDate("");
      setMessage("Milestone added.");

      await loadWorkspace();
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setIsSubmittingMilestone(false);
    }
  }

  const isWorkspaceReadOnly =
    Boolean(
      mentorship &&
        (
          mentorship.status === "completed" ||
          mentorship.status === "cancelled" ||
          mentorship.status === "ended_early"
        )
    );

  const canManageMilestones =
    Boolean(
      currentUserId &&
        mentorship &&
        !isWorkspaceReadOnly &&
        currentUserId === mentorship.mentor_id
    );

  async function updateMilestoneStatus(
    milestone: MentorshipMilestone,
    nextStatus: MentorshipMilestone["status"]
  ) {
    if (!currentUserId) {
      setMessage(
        "Please log in before updating this milestone."
      );
      return;
    }

    if (!canManageMilestones) {
      setMessage(
        "Only the mentor may manage milestones."
      );
      return;
    }

    setUpdatingMilestoneId(milestone.id);
    setMessage(null);

    try {
      const supabase =
        getSupabaseBrowserClient();

      const { error } = await supabase
        .from("mentorship_milestones")
        .update({
          status: nextStatus,
        })
        .eq("id", milestone.id);

      if (error) {
        throw error;
      }

      setMessage(
        nextStatus === "in_progress"
          ? "Milestone started."
          : nextStatus === "completed"
            ? "Milestone completed."
            : "Milestone cancelled."
      );

      await loadWorkspace();
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setUpdatingMilestoneId(null);
    }
  }

  async function submitActionItem(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (
      !currentUserId ||
      !mentorship
    ) {
      return;
    }

    const trimmedTitle =
      actionItemTitle.trim();

    const trimmedDescription =
      actionItemDescription.trim();

    if (trimmedTitle.length < 2) {
      setMessage(
        "The action-item title must contain at least 2 characters."
      );
      return;
    }

    if (!actionItemAssignee) {
      setMessage(
        "Select the participant responsible for this action item."
      );
      return;
    }

    setIsSubmittingActionItem(true);
    setMessage(null);

    try {
      const supabase =
        getSupabaseBrowserClient();

      const { error } = await supabase
        .from("mentorship_action_items")
        .insert({
          mentorship_id: mentorship.id,
          created_by: currentUserId,
          assigned_to: actionItemAssignee,
          milestone_id:
            actionItemMilestoneId || null,
          title: trimmedTitle,
          description:
            trimmedDescription || null,
          due_date:
            actionItemDueDate || null,
          status: "open",
        });

      if (error) {
        throw error;
      }

      setActionItemTitle("");
      setActionItemDescription("");
      setActionItemDueDate("");
      setActionItemAssignee("");
      setActionItemMilestoneId("");
      setMessage("Action item added.");

      await loadWorkspace();
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setIsSubmittingActionItem(false);
    }
  }

  async function updateActionItemWorkflow(
    item: MentorshipActionItem,
    changes: Partial<{
      status: MentorshipActionItem["status"];
      completion_summary: string | null;
      completion_rating: number | null;
      completion_review: string | null;
    }>,
    successMessage: string
  ) {
    if (!currentUserId) {
      setMessage(
        "Please log in before updating this action item."
      );
      return;
    }

    setUpdatingActionItemId(item.id);
    setMessage(null);

    try {
      const supabase =
        getSupabaseBrowserClient();

      const { error } = await supabase
        .from("mentorship_action_items")
        .update(changes)
        .eq("id", item.id);

      if (error) {
        throw error;
      }

      setMessage(successMessage);
      await loadWorkspace();
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setUpdatingActionItemId(null);
    }
  }

  async function runLifecycleAction(
    action:
      | "pause"
      | "resume"
      | "request_completion"
      | "approve_completion"
      | "decline_completion"
      | "end_early"
  ) {
    if (!mentorship || !currentUserId) {
      return;
    }

    setLifecycleAction(action);
    setMessage(null);

    try {
      const supabase =
        getSupabaseBrowserClient();

      if (action === "pause") {
        if (
          currentUserId !== mentorship.mentor_id
        ) {
          setMessage(
            "Only the mentor may pause the mentorship."
          );
          return;
        }

        const reason = pauseReason.trim();

        if (reason.length < 5) {
          setMessage(
            "Enter a pause reason of at least 5 characters."
          );
          return;
        }

        const { error } = await supabase.rpc(
          "pause_mentorship",
          {
            target_mentorship_id:
              mentorship.id,
            pause_note: reason,
          }
        );

        if (error) {
          throw error;
        }

        setPauseReason("");
        setMessage("Mentorship paused.");
      }

      if (action === "resume") {
        if (
          currentUserId !== mentorship.mentor_id
        ) {
          setMessage(
            "Only the mentor may resume the mentorship."
          );
          return;
        }

        const { error } = await supabase.rpc(
          "resume_mentorship",
          {
            target_mentorship_id:
              mentorship.id,
          }
        );

        if (error) {
          throw error;
        }

        setMessage("Mentorship resumed.");
      }

      if (action === "request_completion") {
        const unfinishedMilestones =
          milestones.filter(
            (milestone) =>
              milestone.status !== "completed" &&
              milestone.status !== "cancelled"
          ).length;

        const unfinishedActionItems =
          actionItems.filter(
            (item) =>
              item.status !== "completed" &&
              item.status !== "cancelled"
          ).length;

        if (
          unfinishedMilestones > 0 ||
          unfinishedActionItems > 0
        ) {
          setMessage(
            `Completion is blocked by ${unfinishedMilestones} unfinished milestone(s) and ${unfinishedActionItems} unfinished action item(s).`
          );
          return;
        }

        const note =
          completionRequestNote.trim();

        if (note.length < 5) {
          setMessage(
            "Enter a completion note of at least 5 characters."
          );
          return;
        }

        const { error } = await supabase.rpc(
          "request_mentorship_completion",
          {
            target_mentorship_id:
              mentorship.id,
            request_note: note,
          }
        );

        if (error) {
          throw error;
        }

        setCompletionRequestNote("");
        setMessage(
          "Mentorship completion requested."
        );
      }

      if (
        action === "approve_completion" ||
        action === "decline_completion"
      ) {
        const note =
          completionResponseNote.trim();

        if (
          action === "decline_completion" &&
          note.length < 2
        ) {
          setMessage(
            "Enter a reason before declining completion."
          );
          return;
        }

        const { error } = await supabase.rpc(
          "respond_to_mentorship_completion",
          {
            target_mentorship_id:
              mentorship.id,
            response_action:
              action === "approve_completion"
                ? "approve"
                : "decline",
            response_note: note || null,
          }
        );

        if (error) {
          throw error;
        }

        setCompletionResponseNote("");
        setMessage(
          action === "approve_completion"
            ? "Mentorship completion approved."
            : "Mentorship completion declined."
        );
      }

      if (action === "end_early") {
        const reason =
          earlyEndingReason.trim();

        if (reason.length < 10) {
          setMessage(
            "Enter an early-ending reason of at least 10 characters."
          );
          return;
        }

        const { error } = await supabase.rpc(
          "end_mentorship_early",
          {
            target_mentorship_id:
              mentorship.id,
            ending_reason: reason,
          }
        );

        if (error) {
          throw error;
        }

        setEarlyEndingReason("");
        setMessage(
          "Mentorship ended early."
        );
      }

      await loadWorkspace();

      setMessage(
        action === "pause"
          ? "Mentorship paused."
          : action === "resume"
            ? "Mentorship resumed."
            : action === "request_completion"
              ? "Mentorship completion requested."
              : action === "approve_completion"
                ? "Mentorship completion approved."
                : action === "decline_completion"
                  ? "Mentorship completion declined."
                  : "Mentorship ended early."
      );
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setLifecycleAction(null);
    }
  }

  const unfinishedMilestoneCount =
    milestones.filter(
      (milestone) =>
        milestone.status !== "completed" &&
        milestone.status !== "cancelled"
    ).length;

  const unfinishedActionItemCount =
    actionItems.filter(
      (item) =>
        item.status !== "completed" &&
        item.status !== "cancelled"
    ).length;

  if (isLoading) {
    return (
      <section className="mx-auto w-full max-w-6xl px-4 py-8 text-sm text-gray-600 sm:px-6">
        Loading mentorship workspace...
      </section>
    );
  }

  if (!mentorship) {
    return (
      <section className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-4 py-8 sm:px-6">
        <Link
          className="w-fit text-sm font-medium text-blue-700 underline"
          href="/connections"
        >
          Back to connections
        </Link>

        <p className="rounded-xl border p-4 text-sm text-gray-700">
          {message ??
            "This mentorship is unavailable or you do not have access to it."}
        </p>
      </section>
    );
  }

  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:gap-8 sm:px-6 sm:py-8">
      <div>
        <Link
          className="text-sm font-medium text-blue-700 underline"
          href="/connections"
        >
          Back to connections
        </Link>

        <div className="mt-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
          <div>
            <p className="text-sm font-medium text-blue-700">
              Private mentorship workspace
            </p>

            <h1 className="mt-1 text-3xl font-semibold">
              {mentorship.mentorship_field}
            </h1>

            <p className="mt-2 text-sm text-gray-600">
              You are participating as the{" "}
              <span className="font-semibold">
                {currentUserRole}
              </span>
              .
            </p>
          </div>

          <span className="w-fit rounded-full border px-3 py-1 text-sm font-medium capitalize">
            {formatStatus(mentorship.status)}
          </span>
        </div>
      </div>

      {message && (
        <p className="rounded-xl border bg-white p-4 text-sm text-gray-700">
          {message}
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <ParticipantCard
          label="Mentor"
          profile={mentor}
        />

        <ParticipantCard
          label="Mentee"
          profile={mentee}
        />
      </div>

      <section className="rounded-2xl border bg-white p-5">
        <h2 className="text-xl font-semibold">
          Mentorship agreement
        </h2>

        <div className="mt-4 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <SummaryItem
            label="Duration"
            value={formatDuration(
              mentorship.agreed_duration
            )}
          />

          <SummaryItem
            label="Frequency"
            value={formatFrequency(
              mentorship.agreed_frequency
            )}
          />

          <SummaryItem
            label="Start date"
            value={formatDate(
              mentorship.start_date
            )}
          />

          <SummaryItem
            label="Expected end"
            value={
              mentorship.expected_end_date
                ? formatDate(
                    mentorship.expected_end_date
                  )
                : "Ongoing"
            }
          />
        </div>

        <div className="mt-5">
          <h3 className="text-sm font-semibold">
            Shared objective
          </h3>

          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-gray-700">
            {mentorship.objective}
          </p>
        </div>
      </section>

      {isWorkspaceReadOnly && (
        <div className="rounded-2xl border bg-gray-50 p-5">
          <h2 className="font-semibold">
            Read-only mentorship record
          </h2>

          <p className="mt-2 text-sm leading-6 text-gray-600">
            This mentorship has ended. Its updates,
            milestones, action items, completion evidence
            and reviews remain available as a permanent
            record, but no further workspace changes can
            be made.
          </p>
        </div>
      )}

      <LifecyclePanel
        completionRequestNote={
          completionRequestNote
        }
        completionResponseNote={
          completionResponseNote
        }
        currentUserId={currentUserId}
        earlyEndingReason={
          earlyEndingReason
        }
        lifecycleAction={lifecycleAction}
        mentorship={mentorship}
        pauseReason={pauseReason}
        runLifecycleAction={
          runLifecycleAction
        }
        setCompletionRequestNote={
          setCompletionRequestNote
        }
        setCompletionResponseNote={
          setCompletionResponseNote
        }
        setEarlyEndingReason={
          setEarlyEndingReason
        }
        setPauseReason={setPauseReason}
        unfinishedActionItemCount={
          unfinishedActionItemCount
        }
        unfinishedMilestoneCount={
          unfinishedMilestoneCount
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(300px,0.7fr)]">
        <section className="rounded-2xl border bg-white p-5">
          <h2 className="text-xl font-semibold">
            Shared updates
          </h2>

          <p className="mt-1 text-sm text-gray-600">
            Record progress, discussion points,
            reflections and agreed decisions.
          </p>

          {!isWorkspaceReadOnly && (
          <form
            className="mt-5 grid gap-4"
            onSubmit={submitUpdate}
          >
            <label className="grid gap-2 text-sm font-medium">
              Update type

              <select
                className="rounded-xl border px-4 py-3 font-normal"
                disabled={isSubmittingUpdate}
                onChange={(event) =>
                  setUpdateType(
                    event.target
                      .value as MentorshipUpdate["update_type"]
                  )
                }
                value={updateType}
              >
                <option value="progress">
                  Progress
                </option>
                <option value="discussion">
                  Discussion
                </option>
                <option value="reflection">
                  Reflection
                </option>
                <option value="decision">
                  Decision
                </option>
              </select>
            </label>

            <label className="grid gap-2 text-sm font-medium">
              Update

              <textarea
                className="min-h-32 resize-y rounded-xl border px-4 py-3 font-normal leading-6 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                disabled={isSubmittingUpdate}
                maxLength={5000}
                minLength={2}
                onChange={(event) =>
                  setUpdateBody(event.target.value)
                }
                placeholder="Record progress, a discussion point, reflection or agreed decision."
                required
                value={updateBody}
              />
            </label>

            <button
              className="min-h-11 w-fit rounded-xl bg-gray-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={
                isSubmittingUpdate ||
                updateBody.trim().length < 2
              }
              type="submit"
            >
              {isSubmittingUpdate
                ? "Adding update..."
                : "Add update"}
            </button>
          </form>
          )}

          <div className="mt-6 space-y-3">
            {updates.length === 0 ? (
              <EmptyState text="No shared updates yet." />
            ) : (
              updates.map((update) => {
                const author =
                  profileById.get(
                    update.author_id
                  );

                return (
                  <article
                    className="rounded-xl border p-4"
                    key={update.id}
                  >
                    <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
                      <div className="flex gap-3">
                        <ProfileAvatar
                          avatarPath={
                            author?.avatar_url
                          }
                          displayName={
                            author?.display_name
                          }
                          size={36}
                        />

                        <div>
                          <p className="font-semibold">
                            {author?.display_name ??
                              "Unknown participant"}
                          </p>

                          <p className="mt-1 text-xs text-gray-500">
                            {formatDateTime(
                              update.created_at
                            )}
                            {update.edited_at
                              ? " · Edited"
                              : ""}
                          </p>
                        </div>
                      </div>

                      <span className="w-fit rounded-full border px-3 py-1 text-xs font-medium capitalize">
                        {formatStatus(
                          update.update_type
                        )}
                      </span>
                    </div>

                    <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-gray-700">
                      {update.body}
                    </p>
                  </article>
                );
              })
            )}
          </div>
        </section>

        <div className="space-y-6">
          {canManageMilestones && (
            <section className="rounded-2xl border bg-white p-5">
            <h2 className="text-xl font-semibold">
              Add milestone
            </h2>

            <p className="mt-1 text-sm text-gray-600">
              Define a shared outcome or progress marker
              for the mentorship.
            </p>

            <form
              className="mt-5 grid gap-4"
              onSubmit={submitMilestone}
            >
              <label className="grid gap-2 text-sm font-medium">
                Title

                <input
                  className="rounded-xl border px-4 py-3 font-normal outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                  disabled={isSubmittingMilestone}
                  maxLength={160}
                  minLength={2}
                  onChange={(event) =>
                    setMilestoneTitle(
                      event.target.value
                    )
                  }
                  placeholder="Complete first mentoring review"
                  required
                  value={milestoneTitle}
                />
              </label>

              <label className="grid gap-2 text-sm font-medium">
                Description

                <textarea
                  className="min-h-24 resize-y rounded-xl border px-4 py-3 font-normal leading-6 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                  disabled={isSubmittingMilestone}
                  maxLength={3000}
                  onChange={(event) =>
                    setMilestoneDescription(
                      event.target.value
                    )
                  }
                  placeholder="Optional details about the expected outcome."
                  value={milestoneDescription}
                />
              </label>

              <label className="grid gap-2 text-sm font-medium">
                Target date

                <input
                  className="rounded-xl border px-4 py-3 font-normal outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                  disabled={isSubmittingMilestone}
                  onChange={(event) =>
                    setMilestoneTargetDate(
                      event.target.value
                    )
                  }
                  type="date"
                  value={milestoneTargetDate}
                />
              </label>

              <button
                className="min-h-11 w-fit rounded-xl bg-gray-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={
                  isSubmittingMilestone ||
                  milestoneTitle.trim().length < 2
                }
                type="submit"
              >
                {isSubmittingMilestone
                  ? "Adding milestone..."
                  : "Add milestone"}
              </button>
            </form>
            </section>
          )}


          {!isWorkspaceReadOnly && (
          <section className="rounded-2xl border bg-white p-5">
            <h2 className="text-xl font-semibold">
              Add action item
            </h2>

            <p className="mt-1 text-sm text-gray-600">
              Assign a clear task to either participant.
            </p>

            <form
              className="mt-5 grid gap-4"
              onSubmit={submitActionItem}
            >
              <label className="grid gap-2 text-sm font-medium">
                Title

                <input
                  className="rounded-xl border px-4 py-3 font-normal outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                  disabled={isSubmittingActionItem}
                  maxLength={200}
                  minLength={2}
                  onChange={(event) =>
                    setActionItemTitle(
                      event.target.value
                    )
                  }
                  placeholder="Review the agreed learning material"
                  required
                  value={actionItemTitle}
                />
              </label>

              <label className="grid gap-2 text-sm font-medium">
                Description

                <textarea
                  className="min-h-24 resize-y rounded-xl border px-4 py-3 font-normal leading-6 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                  disabled={isSubmittingActionItem}
                  maxLength={3000}
                  onChange={(event) =>
                    setActionItemDescription(
                      event.target.value
                    )
                  }
                  placeholder="Optional instructions or context."
                  value={actionItemDescription}
                />
              </label>

              <label className="grid gap-2 text-sm font-medium">
                Assign to

                <select
                  className="rounded-xl border px-4 py-3 font-normal outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                  disabled={isSubmittingActionItem}
                  onChange={(event) =>
                    setActionItemAssignee(
                      event.target.value
                    )
                  }
                  required
                  value={actionItemAssignee}
                >
                  <option value="">
                    Select participant
                  </option>

                  {participantProfiles.map(
                    (profile) => (
                      <option
                        key={profile.id}
                        value={profile.id}
                      >
                        {profile.display_name}
                        {profile.id ===
                        mentorship.mentor_id
                          ? " — Mentor"
                          : " — Mentee"}
                      </option>
                    )
                  )}
                </select>
              </label>

              <label className="grid gap-2 text-sm font-medium">
                Linked milestone

                <select
                  className="rounded-xl border px-4 py-3 font-normal outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                  disabled={isSubmittingActionItem}
                  onChange={(event) =>
                    setActionItemMilestoneId(
                      event.target.value
                    )
                  }
                  value={actionItemMilestoneId}
                >
                  <option value="">
                    No linked milestone
                  </option>

                  {milestones.map((milestone) => (
                    <option
                      key={milestone.id}
                      value={milestone.id}
                    >
                      {milestone.title}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2 text-sm font-medium">
                Due date

                <input
                  className="rounded-xl border px-4 py-3 font-normal outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                  disabled={isSubmittingActionItem}
                  onChange={(event) =>
                    setActionItemDueDate(
                      event.target.value
                    )
                  }
                  type="date"
                  value={actionItemDueDate}
                />
              </label>

              <button
                className="min-h-11 w-fit rounded-xl bg-gray-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={
                  isSubmittingActionItem ||
                  actionItemTitle.trim().length < 2 ||
                  !actionItemAssignee
                }
                type="submit"
              >
                {isSubmittingActionItem
                  ? "Adding action item..."
                  : "Add action item"}
              </button>
            </form>
          </section>
          )}

          <MentorshipWorkboard
            actionItems={actionItems}
            canManageMilestones={
              canManageMilestones
            }
            currentUserId={
              isWorkspaceReadOnly
                ? null
                : currentUserId
            }
            isReadOnly={isWorkspaceReadOnly}
            milestones={milestones}
            profileById={profileById}
            selectedActionItem={
              selectedActionItem
            }
            setSelectedActionItemId={
              setSelectedActionItemId
            }
            updateActionItemWorkflow={
              updateActionItemWorkflow
            }
            updateMilestoneStatus={
              updateMilestoneStatus
            }
            updatingActionItemId={
              updatingActionItemId
            }
            updatingMilestoneId={
              updatingMilestoneId
            }
          />
        </div>
      </div>
    </section>
  );
}

function ParticipantCard({
  label,
  profile,
}: {
  label: string;
  profile?: Profile;
}) {
  return (
    <article className="rounded-2xl border bg-white p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        {label}
      </p>

      <div className="mt-3 flex gap-3">
        <ProfileAvatar
          avatarPath={profile?.avatar_url}
          displayName={profile?.display_name}
          size={44}
        />

        <div className="min-w-0">
          {profile ? (
            <Link
              className="font-semibold hover:underline"
              href={`/profile/${profile.id}`}
            >
              {profile.display_name}
            </Link>
          ) : (
            <p className="font-semibold">
              Unknown participant
            </p>
          )}

          <p className="mt-1 text-sm capitalize text-gray-600">
            {profile?.role_type ??
              "Profile unavailable"}
          </p>

          {profile?.field && (
            <p className="mt-1 text-sm text-gray-600">
              {profile.field}
            </p>
          )}
        </div>
      </div>
    </article>
  );
}

function SummaryItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        {label}
      </p>

      <p className="mt-1 font-medium">
        {value}
      </p>
    </div>
  );
}

function LifecyclePanel({
  completionRequestNote,
  completionResponseNote,
  currentUserId,
  earlyEndingReason,
  lifecycleAction,
  mentorship,
  pauseReason,
  runLifecycleAction,
  setCompletionRequestNote,
  setCompletionResponseNote,
  setEarlyEndingReason,
  setPauseReason,
  unfinishedActionItemCount,
  unfinishedMilestoneCount,
}: {
  completionRequestNote: string;
  completionResponseNote: string;
  currentUserId: string | null;
  earlyEndingReason: string;
  lifecycleAction: string | null;
  mentorship: Mentorship;
  pauseReason: string;
  runLifecycleAction: (
    action:
      | "pause"
      | "resume"
      | "request_completion"
      | "approve_completion"
      | "decline_completion"
      | "end_early"
  ) => Promise<void>;
  setCompletionRequestNote: (
    value: string
  ) => void;
  setCompletionResponseNote: (
    value: string
  ) => void;
  setEarlyEndingReason: (
    value: string
  ) => void;
  setPauseReason: (value: string) => void;
  unfinishedActionItemCount: number;
  unfinishedMilestoneCount: number;
}) {
  const isTerminal =
    mentorship.status === "completed" ||
    mentorship.status === "cancelled" ||
    mentorship.status === "ended_early";

  const completionRequestedByCurrentUser =
    mentorship.completion_requested_by ===
    currentUserId;

  const canManagePauseResume =
    currentUserId === mentorship.mentor_id;

  const hasUnfinishedWork =
    unfinishedMilestoneCount > 0 ||
    unfinishedActionItemCount > 0;

  return (
    <section className="rounded-2xl border bg-white p-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <h2 className="text-xl font-semibold">
            Mentorship lifecycle
          </h2>

          <p className="mt-1 text-sm text-gray-600">
            Pause, resume, complete or formally end this mentorship.
          </p>
        </div>

        <span className="h-fit rounded-full border px-3 py-1 text-xs capitalize">
          {formatStatus(mentorship.status)}
        </span>
      </div>

      {mentorship.status === "paused" && (
        <div className="mt-4 rounded-xl border border-dashed p-4 text-sm text-gray-700">
          <p className="font-semibold">
            Mentorship paused
          </p>

          {mentorship.pause_reason && (
            <p className="mt-2 whitespace-pre-wrap">
              {mentorship.pause_reason}
            </p>
          )}

          {mentorship.paused_at && (
            <p className="mt-2 text-xs text-gray-500">
              Paused{" "}
              {formatDateTime(
                mentorship.paused_at
              )}
            </p>
          )}

          {canManagePauseResume ? (
            <button
              className="mt-4 min-h-10 rounded-xl bg-gray-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              disabled={
                lifecycleAction !== null
              }
              onClick={() =>
                void runLifecycleAction(
                  "resume"
                )
              }
              type="button"
            >
              {lifecycleAction === "resume"
                ? "Resuming..."
                : "Resume mentorship"}
            </button>
          ) : (
            <p className="mt-4 text-sm text-gray-600">
              The mentor controls when this mentorship is resumed.
            </p>
          )}
        </div>
      )}

      {mentorship.status ===
        "completion_requested" && (
        <div className="mt-4 rounded-xl border border-dashed p-4">
          <p className="text-sm font-semibold">
            Completion requested
          </p>

          {mentorship.completion_request_note && (
            <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">
              {
                mentorship.completion_request_note
              }
            </p>
          )}

          {mentorship.completion_requested_at && (
            <p className="mt-2 text-xs text-gray-500">
              Requested{" "}
              {formatDateTime(
                mentorship.completion_requested_at
              )}
            </p>
          )}

          {completionRequestedByCurrentUser ? (
            <p className="mt-4 text-sm text-gray-600">
              Waiting for the other participant to respond.
            </p>
          ) : (
            <div className="mt-4 grid gap-3">
              <textarea
                className="min-h-24 resize-y rounded-xl border px-4 py-3 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                maxLength={2000}
                onChange={(event) =>
                  setCompletionResponseNote(
                    event.target.value
                  )
                }
                placeholder="Optional approval note, or required reason when declining."
                value={completionResponseNote}
              />

              <div className="flex flex-wrap gap-3">
                <button
                  className="min-h-10 rounded-xl bg-gray-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  disabled={
                    lifecycleAction !== null
                  }
                  onClick={() =>
                    void runLifecycleAction(
                      "approve_completion"
                    )
                  }
                  type="button"
                >
                  Approve completion
                </button>

                <button
                  className="min-h-10 rounded-xl border px-4 py-2 text-sm font-semibold disabled:opacity-50"
                  disabled={
                    lifecycleAction !== null ||
                    completionResponseNote.trim()
                      .length < 2
                  }
                  onClick={() =>
                    void runLifecycleAction(
                      "decline_completion"
                    )
                  }
                  type="button"
                >
                  Decline completion
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {!isTerminal &&
        mentorship.status !== "paused" &&
        mentorship.status !==
          "completion_requested" && (
          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            {canManagePauseResume ? (
              <div className="rounded-xl border p-4">
                <h3 className="font-semibold">
                  Pause mentorship
                </h3>

                <textarea
                  className="mt-3 min-h-24 w-full resize-y rounded-xl border px-4 py-3 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                  maxLength={1000}
                  onChange={(event) =>
                    setPauseReason(
                      event.target.value
                    )
                  }
                  placeholder="Explain why the mentorship should be paused."
                  value={pauseReason}
                />

                <button
                  className="mt-3 min-h-10 rounded-xl border px-4 py-2 text-sm font-semibold disabled:opacity-50"
                  disabled={
                    lifecycleAction !== null ||
                    pauseReason.trim().length < 5
                  }
                  onClick={() =>
                    void runLifecycleAction(
                      "pause"
                    )
                  }
                  type="button"
                >
                  Pause mentorship
                </button>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed p-4">
                <h3 className="font-semibold">
                  Pause mentorship
                </h3>

                <p className="mt-3 text-sm text-gray-600">
                  Only the mentor may pause this mentorship.
                </p>
              </div>
            )}

            <div className="rounded-xl border p-4">
              <h3 className="font-semibold">
                Request completion
              </h3>

              <textarea
                className="mt-3 min-h-24 w-full resize-y rounded-xl border px-4 py-3 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                maxLength={2000}
                onChange={(event) =>
                  setCompletionRequestNote(
                    event.target.value
                  )
                }
                placeholder="Summarise why the mentorship is ready for completion."
                value={completionRequestNote}
              />

              {hasUnfinishedWork && (
                <div className="mt-3 rounded-xl border border-dashed p-3 text-sm text-gray-700">
                  <p className="font-semibold">
                    Completion is not yet available
                  </p>

                  <p className="mt-1">
                    Complete or cancel all remaining work first.
                  </p>

                  <ul className="mt-2 list-inside list-disc text-sm text-gray-600">
                    {unfinishedMilestoneCount > 0 && (
                      <li>
                        {unfinishedMilestoneCount} unfinished{" "}
                        {unfinishedMilestoneCount === 1
                          ? "milestone"
                          : "milestones"}
                      </li>
                    )}

                    {unfinishedActionItemCount > 0 && (
                      <li>
                        {unfinishedActionItemCount} unfinished{" "}
                        {unfinishedActionItemCount === 1
                          ? "action item"
                          : "action items"}
                      </li>
                    )}
                  </ul>
                </div>
              )}

              <button
                className="mt-3 min-h-10 rounded-xl bg-gray-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                disabled={
                  lifecycleAction !== null ||
                  hasUnfinishedWork ||
                  completionRequestNote.trim()
                    .length < 5
                }
                onClick={() =>
                  void runLifecycleAction(
                    "request_completion"
                  )
                }
                type="button"
              >
                Request completion
              </button>
            </div>
          </div>
        )}

      {!isTerminal && (
        <details className="mt-5 rounded-xl border p-4">
          <summary className="cursor-pointer text-sm font-semibold">
            End mentorship early
          </summary>

          <p className="mt-3 text-sm text-gray-600">
            This permanently closes the active mentorship while preserving its history.
          </p>

          <textarea
            className="mt-3 min-h-24 w-full resize-y rounded-xl border px-4 py-3 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
            maxLength={2000}
            onChange={(event) =>
              setEarlyEndingReason(
                event.target.value
              )
            }
            placeholder="Provide a clear reason for ending the mentorship early."
            value={earlyEndingReason}
          />

          <button
            className="mt-3 min-h-10 rounded-xl border px-4 py-2 text-sm font-semibold disabled:opacity-50"
            disabled={
              lifecycleAction !== null ||
              earlyEndingReason.trim().length <
                10
            }
            onClick={() =>
              void runLifecycleAction(
                "end_early"
              )
            }
            type="button"
          >
            End mentorship early
          </button>
        </details>
      )}

      {isTerminal && (
        <p className="mt-4 rounded-xl border border-dashed p-4 text-sm text-gray-600">
          This mentorship is closed and retained as read-only history.
        </p>
      )}
    </section>
  );
}

function MentorshipWorkboard({
  actionItems,
  canManageMilestones,
  currentUserId,
  isReadOnly,
  milestones,
  profileById,
  selectedActionItem,
  setSelectedActionItemId,
  updateActionItemWorkflow,
  updateMilestoneStatus,
  updatingActionItemId,
  updatingMilestoneId,
}: {
  actionItems: MentorshipActionItem[];
  canManageMilestones: boolean;
  currentUserId: string | null;
  isReadOnly: boolean;
  milestones: MentorshipMilestone[];
  profileById: Map<string, Profile>;
  selectedActionItem:
    | MentorshipActionItem
    | null;
  setSelectedActionItemId: (
    actionItemId: string | null
  ) => void;
  updateActionItemWorkflow: (
    item: MentorshipActionItem,
    changes: Partial<{
      status: MentorshipActionItem["status"];
      completion_summary: string | null;
      completion_rating: number | null;
      completion_review: string | null;
    }>,
    successMessage: string
  ) => Promise<void>;
  updateMilestoneStatus: (
    milestone: MentorshipMilestone,
    nextStatus: MentorshipMilestone["status"]
  ) => Promise<void>;
  updatingActionItemId: string | null;
  updatingMilestoneId: string | null;
}) {
  const milestoneById = new Map(
    milestones.map((milestone) => [
      milestone.id,
      milestone,
    ])
  );

  const unlinkedActionItems =
    actionItems.filter(
      (item) => !item.milestone_id
    );

  const finishedActionItemCount =
    actionItems.filter(
      (item) =>
        item.status === "completed" ||
        item.status === "cancelled"
    ).length;

  const remainingActionItemCount =
    actionItems.length -
    finishedActionItemCount;

  const awaitingReviewCount =
    actionItems.filter(
      (item) =>
        item.status === "awaiting_review"
    ).length;

  return (
    <section className="rounded-2xl border bg-white p-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <h2 className="text-xl font-semibold">
            Mentorship workboard
          </h2>

          <p className="mt-1 text-sm text-gray-600">
            Milestones and their linked action items.
          </p>
        </div>

        <span className="w-fit rounded-full border px-3 py-1 text-xs font-medium text-gray-600">
          {remainingActionItemCount} remaining
        </span>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <WorkSummaryCard
          label="Milestones"
          value={milestones.length}
        />

        <WorkSummaryCard
          label="Action items"
          value={actionItems.length}
        />

        <WorkSummaryCard
          label="Awaiting review"
          value={awaitingReviewCount}
        />

        <WorkSummaryCard
          label="Finished"
          value={finishedActionItemCount}
        />
      </div>

      {!canManageMilestones &&
        !isReadOnly && (
          <p className="mt-4 text-sm text-gray-600">
            Milestones are created and managed by the mentor.
          </p>
        )}

      <div className="mt-5 space-y-4">
        {milestones.length === 0 ? (
          <EmptyState text="No milestones yet." />
        ) : (
          milestones.map((milestone) => {
            const linkedActionItems =
              actionItems.filter(
                (item) =>
                  item.milestone_id ===
                  milestone.id
              );

            const finishedLinkedCount =
              linkedActionItems.filter(
                (item) =>
                  item.status === "completed" ||
                  item.status === "cancelled"
              ).length;

            const remainingLinkedCount =
              linkedActionItems.length -
              finishedLinkedCount;

            return (
              <details
                className="group rounded-2xl border bg-gray-50 p-3"

                key={milestone.id}
              >
                <summary className="flex cursor-pointer list-none items-start justify-between gap-4 rounded-xl p-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        aria-hidden="true"
                        className="text-sm text-gray-500 transition group-open:rotate-90"
                      >
                        ▶
                      </span>

                      <h3 className="truncate font-semibold">
                        {milestone.title}
                      </h3>
                    </div>

                    <p className="mt-1 pl-6 text-xs text-gray-500">
                      {finishedLinkedCount}/
                      {linkedActionItems.length} linked action items finished
                    </p>
                  </div>

                  <span className="h-fit shrink-0 rounded-full border bg-white px-2 py-1 text-xs capitalize">
                    {formatStatus(
                      milestone.status
                    )}
                  </span>
                </summary>

                <div className="mt-3 space-y-4 border-t pt-4">
                  <MilestoneList
                    actionItems={
                      linkedActionItems
                    }
                    canManageMilestones={
                      canManageMilestones
                    }
                    isReadOnly={isReadOnly}
                    milestones={[milestone]}
                    updateMilestoneStatus={
                      updateMilestoneStatus
                    }
                    updatingMilestoneId={
                      updatingMilestoneId
                    }
                  />

                  <ActionItemList
                    actionItems={
                      linkedActionItems
                    }
                    currentUserId={
                      currentUserId
                    }
                    milestoneById={
                      milestoneById
                    }
                    profileById={profileById}
                    selectedActionItem={
                      selectedActionItem
                    }
                    setSelectedActionItemId={
                      setSelectedActionItemId
                    }
                    updateActionItemWorkflow={
                      updateActionItemWorkflow
                    }
                    updatingActionItemId={
                      updatingActionItemId
                    }
                  />
                </div>
              </details>
            );
          })
        )}

        <details
          className="group rounded-2xl border bg-gray-50 p-3"

        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-xl p-2">
            <div className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className="text-sm text-gray-500 transition group-open:rotate-90"
              >
                ▶
              </span>

              <h3 className="font-semibold">
                Unlinked action items
              </h3>
            </div>

            <span className="rounded-full border bg-white px-2 py-1 text-xs">
              {unlinkedActionItems.length}
            </span>
          </summary>

          <div className="mt-3 border-t pt-4">
            <ActionItemList
              actionItems={
                unlinkedActionItems
              }
              currentUserId={currentUserId}
              milestoneById={milestoneById}
              profileById={profileById}
              selectedActionItem={
                selectedActionItem
              }
              setSelectedActionItemId={
                setSelectedActionItemId
              }
              updateActionItemWorkflow={
                updateActionItemWorkflow
              }
              updatingActionItemId={
                updatingActionItemId
              }
            />
          </div>
        </details>
      </div>
    </section>
  );
}

function WorkSummaryCard({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-xl border bg-gray-50 p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
        {label}
      </p>

      <p className="mt-1 text-2xl font-semibold">
        {value}
      </p>
    </div>
  );
}

function MilestoneList({
  actionItems,
  canManageMilestones,
  isReadOnly,
  milestones,
  updateMilestoneStatus,
  updatingMilestoneId,
}: {
  actionItems: MentorshipActionItem[];
  canManageMilestones: boolean;
  isReadOnly: boolean;
  milestones: MentorshipMilestone[];
  updateMilestoneStatus: (
    milestone: MentorshipMilestone,
    nextStatus: MentorshipMilestone["status"]
  ) => Promise<void>;
  updatingMilestoneId: string | null;
}) {
  return (
    <section className="rounded-2xl border bg-white p-5">
      <h2 className="text-xl font-semibold">
        Milestones
      </h2>

      {!canManageMilestones &&
        !isReadOnly && (
          <p className="mt-2 text-sm text-gray-600">
            Milestones are created and managed by the mentor.
          </p>
        )}

      <div className="mt-4 space-y-3">
        {milestones.length === 0 ? (
          <EmptyState text="No milestones yet." />
        ) : (
          milestones.map((milestone) => {
            const linkedActionItems =
              actionItems.filter(
                (item) =>
                  item.milestone_id ===
                  milestone.id
              );

            const completedActionCount =
              linkedActionItems.filter(
                (item) =>
                  item.status === "completed" ||
                  item.status === "cancelled"
              ).length;

            const unfinishedActionCount =
              linkedActionItems.length -
              completedActionCount;

            const isUpdating =
              updatingMilestoneId ===
              milestone.id;

            const canComplete =
              milestone.status ===
                "in_progress" &&
              unfinishedActionCount === 0;

            const canCancel =
              milestone.status !==
                "completed" &&
              unfinishedActionCount === 0;

            return (
              <article
                className="rounded-xl border p-4"
                key={milestone.id}
              >
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                  <div>
                    <h3 className="font-semibold">
                      {milestone.title}
                    </h3>

                    {milestone.description && (
                      <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">
                        {
                          milestone.description
                        }
                      </p>
                    )}

                    <div className="mt-3 space-y-1 text-xs text-gray-500">
                      {milestone.target_date && (
                        <p>
                          Target{" "}
                          {formatDate(
                            milestone.target_date
                          )}
                        </p>
                      )}

                      <p>
                        Linked action items:{" "}
                        {linkedActionItems.length}
                      </p>

                      <p>
                        Finished action items:{" "}
                        {completedActionCount}/
                        {linkedActionItems.length}
                      </p>

                      {unfinishedActionCount >
                        0 && (
                        <p>
                          Remaining action items:{" "}
                          {
                            unfinishedActionCount
                          }
                        </p>
                      )}
                    </div>
                  </div>

                  <span className="h-fit rounded-full border px-2 py-1 text-xs capitalize">
                    {formatStatus(
                      milestone.status
                    )}
                  </span>
                </div>

                {canManageMilestones && (
                  <div className="mt-4 flex flex-wrap gap-3">
                    {milestone.status ===
                    "planned" && (
                    <button
                      className="min-h-10 rounded-xl bg-gray-950 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={isUpdating}
                      onClick={() =>
                        void updateMilestoneStatus(
                          milestone,
                          "in_progress"
                        )
                      }
                      type="button"
                    >
                      {isUpdating
                        ? "Starting..."
                        : "Start milestone"}
                    </button>
                  )}

                  {milestone.status ===
                    "in_progress" && (
                    <button
                      className="min-h-10 rounded-xl bg-gray-950 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={
                        isUpdating ||
                        !canComplete
                      }
                      onClick={() =>
                        void updateMilestoneStatus(
                          milestone,
                          "completed"
                        )
                      }
                      title={
                        canComplete
                          ? undefined
                          : "Complete or cancel all linked action items first."
                      }
                      type="button"
                    >
                      {isUpdating
                        ? "Completing..."
                        : "Complete milestone"}
                    </button>
                  )}

                  {milestone.status !==
                    "completed" &&
                    milestone.status !==
                      "cancelled" && (
                      <button
                        className="min-h-10 rounded-xl border px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={
                          isUpdating ||
                          !canCancel
                        }
                        onClick={() =>
                          void updateMilestoneStatus(
                            milestone,
                            "cancelled"
                          )
                        }
                        title={
                          canCancel
                            ? undefined
                            : "Complete or cancel all linked action items first."
                        }
                        type="button"
                      >
                        Cancel milestone
                      </button>
                    )}
                  </div>
                )}

                {unfinishedActionCount > 0 &&
                  milestone.status ===
                    "in_progress" && (
                    <p className="mt-3 rounded-xl border border-dashed p-3 text-sm text-gray-600">
                      Complete or cancel the{" "}
                      {unfinishedActionCount} linked{" "}
                      {unfinishedActionCount === 1
                        ? "action item"
                        : "action items"}{" "}
                      before completing this milestone.
                    </p>
                  )}

                {milestone.status ===
                  "completed" &&
                  milestone.completed_at && (
                    <p className="mt-3 text-xs text-gray-500">
                      Completed{" "}
                      {formatDateTime(
                        milestone.completed_at
                      )}
                    </p>
                  )}
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}

function ActionItemList({
  actionItems,
  currentUserId,
  milestoneById,
  profileById,
  selectedActionItem,
  setSelectedActionItemId,
  updateActionItemWorkflow,
  updatingActionItemId,
}: {
  actionItems: MentorshipActionItem[];
  currentUserId: string | null;
  milestoneById: Map<
    string,
    MentorshipMilestone
  >;
  profileById: Map<string, Profile>;
  selectedActionItem:
    | MentorshipActionItem
    | null;
  setSelectedActionItemId: (
    actionItemId: string | null
  ) => void;
  updateActionItemWorkflow: (
    item: MentorshipActionItem,
    changes: Partial<{
      status: MentorshipActionItem["status"];
      completion_summary: string | null;
      completion_rating: number | null;
      completion_review: string | null;
    }>,
    successMessage: string
  ) => Promise<void>;
  updatingActionItemId: string | null;
}) {
  const [
    completionSummary,
    setCompletionSummary,
  ] = useState("");

  const [reviewRating, setReviewRating] =
    useState("");

  const [reviewComment, setReviewComment] =
    useState("");

  const selectedItemId =
    selectedActionItem?.id ?? null;

  useEffect(() => {
    setCompletionSummary(
      selectedActionItem?.completion_summary ??
        ""
    );

    setReviewRating(
      selectedActionItem?.completion_rating
        ? String(
            selectedActionItem.completion_rating
          )
        : ""
    );

    setReviewComment(
      selectedActionItem?.completion_review ??
        ""
    );
  }, [selectedActionItem]);

  async function startActionItem(
    item: MentorshipActionItem
  ) {
    await updateActionItemWorkflow(
      item,
      {
        status: "in_progress",
      },
      "Action item moved to in progress."
    );
  }

  async function submitCompletion(
    event: FormEvent<HTMLFormElement>,
    item: MentorshipActionItem
  ) {
    event.preventDefault();

    const summary =
      completionSummary.trim();

    if (summary.length < 10) {
      return;
    }

    await updateActionItemWorkflow(
      item,
      {
        status: "awaiting_review",
        completion_summary: summary,
      },
      "Completion summary submitted for review."
    );
  }

  async function reviewCompletion(
    item: MentorshipActionItem,
    decision:
      | "completed"
      | "revision_requested"
  ) {
    const comment =
      reviewComment.trim();

    if (
      decision === "completed" &&
      !reviewRating
    ) {
      return;
    }

    if (
      decision === "revision_requested" &&
      comment.length < 2
    ) {
      return;
    }

    await updateActionItemWorkflow(
      item,
      {
        status: decision,
        completion_rating:
          decision === "completed"
            ? Number(reviewRating)
            : null,
        completion_review:
          comment || null,
      },
      decision === "completed"
        ? "Completion approved and rated."
        : "Revision requested."
    );
  }

  return (
    <section className="rounded-2xl border bg-white p-5">
      <h2 className="text-xl font-semibold">
        Action items
      </h2>

      <div className="mt-4 space-y-3">
        {actionItems.length === 0 ? (
          <EmptyState text="No action items yet." />
        ) : (
          actionItems.map((item) => {
            const assignee =
              profileById.get(item.assigned_to);

            const creator =
              profileById.get(item.created_by);

            const milestone =
              item.milestone_id
                ? milestoneById.get(
                    item.milestone_id
                  )
                : undefined;

            const isAssignedParticipant =
              currentUserId === item.assigned_to;

            const isCreator =
              currentUserId === item.created_by;

            const isSelected =
              selectedItemId === item.id;

            const isUpdating =
              updatingActionItemId === item.id;

            return (
              <article
                className="rounded-xl border p-4"
                key={item.id}
              >
                <button
                  className="w-full text-left"
                  onClick={() =>
                    setSelectedActionItemId(
                      isSelected
                        ? null
                        : item.id
                    )
                  }
                  type="button"
                >
                  <div className="flex justify-between gap-3">
                    <h3 className="font-semibold">
                      {item.title}
                    </h3>

                    <span className="h-fit rounded-full border px-2 py-1 text-xs capitalize">
                      {formatStatus(item.status)}
                    </span>
                  </div>

                  {item.description && (
                    <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">
                      {item.description}
                    </p>
                  )}

                  <div className="mt-3 space-y-1 text-xs text-gray-500">
                    <p>
                      Assigned to{" "}
                      {assignee?.display_name ??
                        "Unavailable participant"}
                    </p>

                    <p>
                      Assigned by{" "}
                      {creator?.display_name ??
                        "Unavailable participant"}
                    </p>

                    <p>
                      Linked milestone:{" "}
                      {milestone?.title ??
                        "None"}
                    </p>

                    {item.due_date && (
                      <p>
                        Due{" "}
                        {formatDate(
                          item.due_date
                        )}
                      </p>
                    )}
                  </div>
                </button>

                {isSelected && (
                  <div className="mt-5 border-t pt-5">
                    {item.completion_summary && (
                      <div className="rounded-xl border bg-gray-50 p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                          Completion summary
                        </p>

                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-gray-700">
                          {
                            item.completion_summary
                          }
                        </p>

                        {item.completion_submitted_at && (
                          <p className="mt-3 text-xs text-gray-500">
                            Submitted{" "}
                            {formatDateTime(
                              item.completion_submitted_at
                            )}
                          </p>
                        )}
                      </div>
                    )}

                    {item.completion_review && (
                      <div className="mt-3 rounded-xl border bg-gray-50 p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                          Completion review
                        </p>

                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-gray-700">
                          {
                            item.completion_review
                          }
                        </p>
                      </div>
                    )}

                    {item.completion_rating && (
                      <p className="mt-3 text-sm font-semibold">
                        Completion rating:{" "}
                        {item.completion_rating}/5
                      </p>
                    )}

                    {isAssignedParticipant &&
                      item.status === "open" && (
                        <button
                          className="mt-4 min-h-11 rounded-xl bg-gray-950 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
                          disabled={isUpdating}
                          onClick={() =>
                            void startActionItem(
                              item
                            )
                          }
                          type="button"
                        >
                          {isUpdating
                            ? "Starting..."
                            : "Start action item"}
                        </button>
                      )}

                    {isAssignedParticipant &&
                      (
                        item.status ===
                          "in_progress" ||
                        item.status ===
                          "revision_requested"
                      ) && (
                        <form
                          className="mt-4 grid gap-3"
                          onSubmit={(event) =>
                            void submitCompletion(
                              event,
                              item
                            )
                          }
                        >
                          {item.status ===
                            "revision_requested" &&
                            item.completion_review && (
                              <p className="rounded-xl border p-3 text-sm text-gray-700">
                                Revision requested:{" "}
                                {
                                  item.completion_review
                                }
                              </p>
                            )}

                          <label className="grid gap-2 text-sm font-medium">
                            Completion summary

                            <textarea
                              className="min-h-32 resize-y rounded-xl border px-4 py-3 font-normal leading-6 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                              disabled={isUpdating}
                              maxLength={5000}
                              minLength={10}
                              onChange={(event) =>
                                setCompletionSummary(
                                  event.target.value
                                )
                              }
                              placeholder="Summarise the work completed, outcome, supporting evidence and any follow-up needed."
                              required
                              value={
                                completionSummary
                              }
                            />
                          </label>

                          <button
                            className="min-h-11 w-fit rounded-xl bg-gray-950 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
                            disabled={
                              isUpdating ||
                              completionSummary
                                .trim()
                                .length < 10
                            }
                            type="submit"
                          >
                            {isUpdating
                              ? "Submitting..."
                              : "Submit for review"}
                          </button>
                        </form>
                      )}

                    {item.status ===
                      "awaiting_review" &&
                      !isCreator && (
                        <p className="mt-4 rounded-xl border border-dashed p-3 text-sm text-gray-600">
                          This completion is awaiting
                          review by the participant who
                          assigned it.
                        </p>
                      )}

                    {isCreator &&
                      item.status ===
                        "awaiting_review" && (
                        <div className="mt-4 grid gap-3">
                          <label className="grid gap-2 text-sm font-medium">
                            Completion rating

                            <select
                              className="rounded-xl border px-4 py-3 font-normal"
                              disabled={isUpdating}
                              onChange={(event) =>
                                setReviewRating(
                                  event.target.value
                                )
                              }
                              value={reviewRating}
                            >
                              <option value="">
                                Select rating
                              </option>

                              <option value="1">
                                1 — Unsatisfactory
                              </option>

                              <option value="2">
                                2 — Needs improvement
                              </option>

                              <option value="3">
                                3 — Satisfactory
                              </option>

                              <option value="4">
                                4 — Very good
                              </option>

                              <option value="5">
                                5 — Excellent
                              </option>
                            </select>
                          </label>

                          <label className="grid gap-2 text-sm font-medium">
                            Review comments

                            <textarea
                              className="min-h-24 resize-y rounded-xl border px-4 py-3 font-normal leading-6"
                              disabled={isUpdating}
                              maxLength={3000}
                              onChange={(event) =>
                                setReviewComment(
                                  event.target.value
                                )
                              }
                              placeholder="Add feedback, recognition or revision instructions."
                              value={reviewComment}
                            />
                          </label>

                          <div className="flex flex-wrap gap-3">
                            <button
                              className="min-h-11 rounded-xl bg-gray-950 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
                              disabled={
                                isUpdating ||
                                !reviewRating
                              }
                              onClick={() =>
                                void reviewCompletion(
                                  item,
                                  "completed"
                                )
                              }
                              type="button"
                            >
                              Approve completion
                            </button>

                            <button
                              className="min-h-11 rounded-xl border px-5 py-3 text-sm font-semibold disabled:opacity-50"
                              disabled={
                                isUpdating ||
                                reviewComment
                                  .trim()
                                  .length < 2
                              }
                              onClick={() =>
                                void reviewCompletion(
                                  item,
                                  "revision_requested"
                                )
                              }
                              type="button"
                            >
                              Request revision
                            </button>
                          </div>
                        </div>
                      )}

                    {item.status ===
                      "completed" && (
                        <p className="mt-4 rounded-xl border p-3 text-sm font-medium text-gray-700">
                          This action item has been
                          reviewed and completed.
                        </p>
                      )}

                    {isUpdating && (
                      <p className="mt-3 text-xs text-gray-500">
                        Updating action item...
                      </p>
                    )}
                  </div>
                )}
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}

function WorkspaceList({
  title,
  items,
  emptyText,
}: {
  title: string;
  items: Array<{
    id: string;
    title: string;
    description: string | null;
    status: string;
    dateLabel: string | null;
  }>;
  emptyText: string;
}) {
  return (
    <section className="rounded-2xl border bg-white p-5">
      <h2 className="text-xl font-semibold">
        {title}
      </h2>

      <div className="mt-4 space-y-3">
        {items.length === 0 ? (
          <EmptyState text={emptyText} />
        ) : (
          items.map((item) => (
            <article
              className="rounded-xl border p-4"
              key={item.id}
            >
              <div className="flex justify-between gap-3">
                <h3 className="font-semibold">
                  {item.title}
                </h3>

                <span className="h-fit rounded-full border px-2 py-1 text-xs capitalize">
                  {item.status}
                </span>
              </div>

              {item.description && (
                <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">
                  {item.description}
                </p>
              )}

              {item.dateLabel && (
                <p className="mt-3 text-xs text-gray-500">
                  {item.dateLabel}
                </p>
              )}
            </article>
          ))
        )}
      </div>
    </section>
  );
}

function EmptyState({
  text,
}: {
  text: string;
}) {
  return (
    <p className="rounded-xl border border-dashed p-4 text-sm text-gray-600">
      {text}
    </p>
  );
}

function formatDuration(
  duration: Mentorship["agreed_duration"]
) {
  const labels: Record<
    Mentorship["agreed_duration"],
    string
  > = {
    "3_months": "3 months",
    "6_months": "6 months",
    "1_year": "1 year",
    ongoing: "Ongoing",
  };

  return labels[duration];
}

function formatFrequency(
  frequency: Mentorship["agreed_frequency"]
) {
  const labels: Record<
    Mentorship["agreed_frequency"],
    string
  > = {
    weekly: "Weekly",
    fortnightly: "Fortnightly",
    monthly: "Monthly",
    flexible: "Flexible",
  };

  return labels[frequency];
}

function formatStatus(value: string) {
  return value.replaceAll("_", " ");
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(
    undefined,
    {
      dateStyle: "medium",
    }
  ).format(
    new Date(`${value}T00:00:00`)
  );
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(
    undefined,
    {
      dateStyle: "medium",
      timeStyle: "short",
    }
  ).format(new Date(value));
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (
      error as {
        message?: unknown;
      }
    ).message === "string"
  ) {
    return (
      error as {
        message: string;
      }
    ).message;
  }

  return "Unable to load the mentorship workspace.";
}