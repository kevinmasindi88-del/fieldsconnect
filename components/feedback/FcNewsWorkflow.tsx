"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getSupabaseBrowserClient,
  isSupabaseConfigured,
} from "@/lib/supabase/browser";

type PlatformRole =
  | "user"
  | "moderator"
  | "senior_moderator"
  | "admin";

type FcNewsStatus =
  | "draft"
  | "submitted_for_review"
  | "changes_requested"
  | "approved"
  | "published";

type FcNewsItem = {
  id: string;
  author_id: string;
  title: string;
  body: string;
  status: FcNewsStatus;
  reviewer_id: string | null;
  reviewer_comments: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  approved_at: string | null;
  published_at: string | null;
  published_post_id: string | null;
  created_at: string;
  updated_at: string;
};

type Profile = {
  id: string;
  display_name: string;
};

type FcNewsWorkflowProps = {
  currentUserId: string | null;
  currentRole: PlatformRole;
  isActiveFcTeamMember: boolean;
};

function getErrorMessage(
  error: unknown,
  fallback: string
) {
  if (error instanceof Error) {
    return error.message;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message?: unknown }).message ===
      "string"
  ) {
    return (error as { message: string }).message;
  }

  return fallback;
}

function formatStatus(status: FcNewsStatus) {
  return status
    .split("_")
    .map(
      (word) =>
        word.charAt(0).toUpperCase() +
        word.slice(1)
    )
    .join(" ");
}

function formatDate(value: string | null) {
  if (!value) return null;

  return new Date(value).toLocaleString();
}

export function FcNewsWorkflow({
  currentUserId,
  currentRole,
  isActiveFcTeamMember,
}: FcNewsWorkflowProps) {
  const router = useRouter();

  const [items, setItems] =
    useState<FcNewsItem[]>([]);

  const [profiles, setProfiles] =
    useState<Profile[]>([]);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const [editingId, setEditingId] =
    useState<string | null>(null);

  const [reviewComments, setReviewComments] =
    useState<Record<string, string>>({});

  const [message, setMessage] =
    useState<string | null>(null);

  const [isLoading, setIsLoading] =
    useState(true);

  const [isWorking, setIsWorking] =
    useState(false);

  const canReview =
    currentRole === "senior_moderator" ||
    currentRole === "admin";

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

  const authoredItems = useMemo(
    () =>
      items.filter(
        (item) =>
          item.author_id === currentUserId
      ),
    [currentUserId, items]
  );

  const reviewQueue = useMemo(
    () =>
      items.filter(
        (item) =>
          item.status ===
          "submitted_for_review"
      ),
    [items]
  );

  async function loadNews(options?: {
    background?: boolean;
  }) {
    const background =
      options?.background ?? false;

    if (
      !isSupabaseConfigured() ||
      !currentUserId
    ) {
      setItems([]);
      setProfiles([]);
      setIsLoading(false);
      return;
    }

    if (!background) {
      setIsLoading(true);
    }

    try {
      const supabase =
        getSupabaseBrowserClient();

      const { data, error } = await supabase
        .from("fc_news")
        .select(
          "id, author_id, title, body, status, reviewer_id, reviewer_comments, submitted_at, reviewed_at, approved_at, published_at, published_post_id, created_at, updated_at"
        )
        .order("created_at", {
          ascending: false,
        });

      if (error) throw error;

      const newsItems =
        (data ?? []) as FcNewsItem[];

      setItems(newsItems);

      const profileIds = Array.from(
        new Set(
          newsItems.flatMap((item) => [
            item.author_id,
            ...(item.reviewer_id
              ? [item.reviewer_id]
              : []),
          ])
        )
      );

      if (profileIds.length === 0) {
        setProfiles([]);
        return;
      }

      const profileResult = await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", profileIds)
        .is("deleted_at", null);

      if (profileResult.error) {
        throw profileResult.error;
      }

      setProfiles(
        (profileResult.data ?? []) as Profile[]
      );
    } catch (error) {
      setMessage(
        getErrorMessage(
          error,
          "Unable to load FC News."
        )
      );
    } finally {
      if (!background) {
        setIsLoading(false);
      }
    }
  }

  useEffect(() => {
    void loadNews();
  }, [
    currentUserId,
    currentRole,
    isActiveFcTeamMember,
  ]);

  useEffect(() => {
    if (
      !currentUserId ||
      !isSupabaseConfigured()
    ) {
      return;
    }

    const supabase =
      getSupabaseBrowserClient();

    const channel = supabase
      .channel(
        `fc-news-editorial-live:${currentUserId}`
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "fc_news",
        },
        () => {
          void loadNews({
            background: true,
          });
        }
      )
      .subscribe();

    const intervalId =
      window.setInterval(() => {
        void loadNews({
          background: true,
        });
      }, 3000);

    return () => {
      window.clearInterval(intervalId);
      void supabase.removeChannel(channel);
    };
  }, [
    currentUserId,
    currentRole,
    isActiveFcTeamMember,
  ]);

  async function createNews(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const trimmedTitle = title.trim();
    const trimmedBody = body.trim();

    if (!trimmedTitle || !trimmedBody) {
      setMessage(
        "Enter both a title and FC News content."
      );
      return;
    }

    setIsWorking(true);
    setMessage(null);

    try {
      const supabase =
        getSupabaseBrowserClient();

      const { error } = await supabase.rpc(
        "create_fc_news",
        {
          news_title: trimmedTitle,
          news_body: trimmedBody,
        }
      );

      if (error) throw error;

      setTitle("");
      setBody("");

      setMessage("FC News draft created.");

      await loadNews();
    } catch (error) {
      setMessage(
        getErrorMessage(
          error,
          "Unable to create FC News."
        )
      );
    } finally {
      setIsWorking(false);
    }
  }

  function beginEditing(item: FcNewsItem) {
    setEditingId(item.id);
    setTitle(item.title);
    setBody(item.body);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function cancelEditing() {
    setEditingId(null);
    setTitle("");
    setBody("");
  }

  async function saveEdit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!editingId) return;

    const trimmedTitle = title.trim();
    const trimmedBody = body.trim();

    if (!trimmedTitle || !trimmedBody) {
      setMessage(
        "Enter both a title and FC News content."
      );
      return;
    }

    setIsWorking(true);
    setMessage(null);

    try {
      const supabase =
        getSupabaseBrowserClient();

      const { error } = await supabase.rpc(
        "update_fc_news",
        {
          news_id: editingId,
          news_title: trimmedTitle,
          news_body: trimmedBody,
        }
      );

      if (error) throw error;

      cancelEditing();

      setMessage("FC News draft updated.");

      await loadNews();
    } catch (error) {
      setMessage(
        getErrorMessage(
          error,
          "Unable to update FC News."
        )
      );
    } finally {
      setIsWorking(false);
    }
  }

  async function submitForReview(
    newsId: string
  ) {
    setIsWorking(true);
    setMessage(null);

    try {
      const supabase =
        getSupabaseBrowserClient();

      const { error } = await supabase.rpc(
        "submit_fc_news_for_review",
        {
          news_id: newsId,
        }
      );

      if (error) throw error;

      setMessage(
        "FC News submitted for review."
      );

      await loadNews();
    } catch (error) {
      setMessage(
        getErrorMessage(
          error,
          "Unable to submit FC News for review."
        )
      );
    } finally {
      setIsWorking(false);
    }
  }

  async function reviewNews(
    newsId: string,
    approve: boolean
  ) {
    const comments =
      reviewComments[newsId]?.trim() ?? "";

    if (!approve && !comments) {
      setMessage(
        "Reviewer comments are required when returning FC News for changes."
      );
      return;
    }

    setIsWorking(true);
    setMessage(null);

    try {
      const supabase =
        getSupabaseBrowserClient();

      const { error } = await supabase.rpc(
        "review_fc_news",
        {
          news_id: newsId,
          approve_news: approve,
          review_comments:
            comments || null,
        }
      );

      if (error) throw error;

      setReviewComments((current) => ({
        ...current,
        [newsId]: "",
      }));

      setMessage(
        approve
          ? "FC News approved."
          : "FC News returned to the author with comments."
      );

      await loadNews();
    } catch (error) {
      setMessage(
        getErrorMessage(
          error,
          "Unable to review FC News."
        )
      );
    } finally {
      setIsWorking(false);
    }
  }

  async function publishNews(
    newsId: string
  ) {
    setIsWorking(true);
    setMessage(null);

    try {
      const supabase =
        getSupabaseBrowserClient();

      const { data, error } =
        await supabase.rpc(
          "publish_fc_news",
          {
            news_id: newsId,
          }
        );

      if (error) throw error;

      const postId =
        typeof data === "string"
          ? data
          : null;

      setMessage(
        "FC News has been posted to the timeline."
      );

      await loadNews();

      if (postId) {
        router.push(`/post/${postId}`);
      }
    } catch (error) {
      setMessage(
        getErrorMessage(
          error,
          "Unable to publish FC News."
        )
      );
    } finally {
      setIsWorking(false);
    }
  }

  if (
    !isActiveFcTeamMember &&
    !canReview
  ) {
    return null;
  }

  return (
    <section className="grid gap-4 rounded-2xl border bg-white p-3 sm:gap-6 sm:p-6">
      <div>
        <p className="text-sm font-semibold text-blue-700">
          Official FieldsConnect updates
        </p>

        <h2 className="mt-1 text-lg font-semibold sm:text-xl">
          FC News
        </h2>

        <p className="mt-1 max-w-3xl text-sm leading-6 text-gray-600">
          Draft, review, approve and publish official
          FieldsConnect news. Public posts are shown as
          FC News rather than under the individual author.
        </p>
      </div>

      {message && (
        <p
          aria-live="polite"
          className="rounded-xl border bg-gray-50 p-3 text-sm text-gray-700"
        >
          {message}
        </p>
      )}

      {isActiveFcTeamMember && (
        <form
          className="grid gap-3 rounded-xl border p-3 sm:p-4"
          onSubmit={
            editingId
              ? saveEdit
              : createNews
          }
        >
          <div>
            <h3 className="break-words font-semibold">
              {editingId
                ? "Edit FC News"
                : "Create FC News"}
            </h3>

            <p className="mt-1 text-sm text-gray-600">
              Pilot version supports text-only official
              updates.
            </p>
          </div>

          <label className="grid gap-2 text-sm font-medium">
            Title

            <input
              className="rounded-xl border px-4 py-3 font-normal outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              disabled={isWorking}
              maxLength={160}
              onChange={(event) =>
                setTitle(event.target.value)
              }
              placeholder="FC News title"
              required
              value={title}
            />
          </label>

          <label className="grid gap-2 text-sm font-medium">
            News

            <textarea
              className="min-h-40 resize-y rounded-xl border px-4 py-3 font-normal leading-6 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              disabled={isWorking}
              maxLength={10000}
              onChange={(event) =>
                setBody(event.target.value)
              }
              placeholder="Write the official update..."
              required
              value={body}
            />
          </label>

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <button
              className="min-h-11 w-full rounded-xl bg-gray-950 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50 sm:w-auto"
              disabled={isWorking}
              type="submit"
            >
              {editingId
                ? "Save changes"
                : "Save draft"}
            </button>

            {editingId && (
              <button
                className="min-h-11 rounded-xl border px-5 py-3 text-sm font-semibold disabled:opacity-50"
                disabled={isWorking}
                onClick={cancelEditing}
                type="button"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      )}

      {isActiveFcTeamMember && (
        <section className="grid gap-3">
          <div>
            <h3 className="break-words font-semibold">
              My FC News
            </h3>

            <p className="mt-1 text-sm text-gray-600">
              Your drafts, review decisions and published
              updates.
            </p>
          </div>

          {isLoading ? (
            <p className="text-sm text-gray-600">
              Loading FC News...
            </p>
          ) : authoredItems.length === 0 ? (
            <p className="rounded-xl border border-dashed p-4 text-sm text-gray-600">
              You have not created any FC News yet.
            </p>
          ) : (
            authoredItems.map((item) => (
              <article
                className="grid gap-3 rounded-xl border p-3 sm:p-4"
                key={item.id}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h4 className="break-words font-semibold">
                      {item.title}
                    </h4>

                    <p className="mt-1 text-xs text-gray-500">
                      Created{" "}
                      {formatDate(
                        item.created_at
                      )}
                    </p>
                  </div>

                  <span className="rounded-full border px-3 py-1 text-xs font-medium">
                    {formatStatus(
                      item.status
                    )}
                  </span>
                </div>

                <p className="whitespace-pre-wrap text-sm leading-6 text-gray-700">
                  {item.body}
                </p>

                {item.reviewer_comments && (
                  <div className="rounded-xl bg-amber-50 p-3 text-sm text-gray-800">
                    <p className="break-words font-semibold">
                      Reviewer comments
                    </p>

                    <p className="mt-1 whitespace-pre-wrap">
                      {item.reviewer_comments}
                    </p>

                    {item.reviewer_id && (
                      <p className="mt-2 text-xs text-gray-600">
                        Reviewed by{" "}
                        {profileById.get(
                          item.reviewer_id
                        )?.display_name ??
                          "Reviewer"}
                      </p>
                    )}
                  </div>
                )}

                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  {[
                    "draft",
                    "changes_requested",
                  ].includes(
                    item.status
                  ) && (
                    <>
                      <button
                        className="min-h-11 w-full rounded-xl border px-4 py-2 text-sm font-semibold disabled:opacity-50 sm:w-auto"
                        disabled={isWorking}
                        onClick={() =>
                          beginEditing(item)
                        }
                        type="button"
                      >
                        Edit
                      </button>

                      <button
                        className="min-h-11 w-full rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 sm:w-auto"
                        disabled={isWorking}
                        onClick={() =>
                          void submitForReview(
                            item.id
                          )
                        }
                        type="button"
                      >
                        Submit for review
                      </button>
                    </>
                  )}

                  {item.status ===
                    "approved" && (
                    <button
                      className="min-h-11 w-full rounded-xl bg-gray-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 sm:w-auto"
                      disabled={isWorking}
                      onClick={() =>
                        void publishNews(
                          item.id
                        )
                      }
                      type="button"
                    >
                      Post
                    </button>
                  )}

                  {item.status ===
                    "submitted_for_review" && (
                    <p className="text-sm text-gray-600">
                      Awaiting review.
                    </p>
                  )}

                  {item.status ===
                    "published" &&
                    item.published_post_id && (
                      <button
                        className="min-h-11 w-full rounded-xl border px-4 py-2 text-sm font-semibold sm:w-auto"
                        onClick={() =>
                          router.push(
                            `/post/${item.published_post_id}`
                          )
                        }
                        type="button"
                      >
                        View post
                      </button>
                    )}
                </div>
              </article>
            ))
          )}
        </section>
      )}

      {canReview && (
        <section className="grid gap-3">
          <div>
            <h3 className="break-words font-semibold">
              FC News review queue
            </h3>

            <p className="mt-1 text-sm text-gray-600">
              Approve submitted FC News or return it
              to the author with required comments.
            </p>
          </div>

          {isLoading ? (
            <p className="text-sm text-gray-600">
              Loading review queue...
            </p>
          ) : reviewQueue.length === 0 ? (
            <p className="rounded-xl border border-dashed p-4 text-sm text-gray-600">
              No FC News is awaiting review.
            </p>
          ) : (
            reviewQueue.map((item) => {
              const isOwnSubmission =
                item.author_id ===
                currentUserId;

              return (
                <article
                  className="grid gap-3 rounded-xl border p-3 sm:p-4"
                  key={item.id}
                >
                  <div>
                    <h4 className="break-words font-semibold">
                      {item.title}
                    </h4>

                    <p className="mt-1 text-xs text-gray-500">
                      Author:{" "}
                      {profileById.get(
                        item.author_id
                      )?.display_name ??
                        "FC Team member"}
                    </p>

                    {item.submitted_at && (
                      <p className="mt-1 text-xs text-gray-500">
                        Submitted{" "}
                        {formatDate(
                          item.submitted_at
                        )}
                      </p>
                    )}
                  </div>

                  <p className="whitespace-pre-wrap text-sm leading-6 text-gray-700">
                    {item.body}
                  </p>

                  {isOwnSubmission ? (
                    <p className="rounded-xl bg-gray-50 p-3 text-sm text-gray-600">
                      You cannot review your own FC News submission.
                    </p>
                  ) : (
                    <>
                      <label className="grid gap-2 text-sm font-medium">
                        Review comments

                        <textarea
                          className="min-h-24 resize-y rounded-xl border px-4 py-3 font-normal leading-6 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                          disabled={isWorking}
                          maxLength={5000}
                          onChange={(
                            event
                          ) =>
                            setReviewComments(
                              (
                                current
                              ) => ({
                                ...current,
                                [item.id]:
                                  event
                                    .target
                                    .value,
                              })
                            )
                          }
                          placeholder="Required when returning for changes; optional when approving."
                          value={
                            reviewComments[
                              item.id
                            ] ?? ""
                          }
                        />
                      </label>

                      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                        <button
                          className="min-h-11 w-full rounded-xl border px-4 py-2 text-sm font-semibold disabled:opacity-50 sm:w-auto"
                          disabled={isWorking}
                          onClick={() =>
                            void reviewNews(
                              item.id,
                              false
                            )
                          }
                          type="button"
                        >
                          Return with comments
                        </button>

                        <button
                          className="min-h-11 w-full rounded-xl bg-gray-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 sm:w-auto"
                          disabled={isWorking}
                          onClick={() =>
                            void reviewNews(
                              item.id,
                              true
                            )
                          }
                          type="button"
                        >
                          Approve
                        </button>
                      </div>
                    </>
                  )}
                </article>
              );
            })
          )}
        </section>
      )}
    </section>
  );
}
