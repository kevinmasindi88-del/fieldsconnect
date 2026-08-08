"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/browser";
import { ProfileAvatar } from "@/components/profile/ProfileAvatar";
import { ReportMenu } from "@/components/moderation/ReportMenu";
import {
  getActionErrorMessage,
  getMessageAlertClass,
} from "@/lib/action-errors";

type Profile = {
  id: string;
  display_name: string;
  role_type: string;
  field: string | null;
  avatar_url: string | null;
};

type Post = {
  id: string;
  author_id: string;
  body: string;
  visibility: "public" | "connections";
  created_at: string;
  edited_at: string | null;
};

type Comment = {
  id: string;
  post_id: string;
  author_id: string;
  body: string;
  created_at: string;
};

type Reaction = {
  id: string;
  post_id: string;
  profile_id: string;
  reaction_type: string;
};

type CommentReaction = {
  id: string;
  comment_id: string;
  profile_id: string;
  reaction_type: string;
};

const postEmojis = [
  "😀",
  "😂",
  "😊",
  "😍",
  "🤔",
  "👏",
  "👍",
  "🔥",
  "🎉",
  "💡",
  "🚀",
  "❤️",
];

export function TimelineWorkflow() {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [commentReactions, setCommentReactions] = useState<CommentReaction[]>([]);
  const [postBody, setPostBody] = useState("");
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [visibility, setVisibility] = useState<"public" | "connections">("public");
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editingPostBody, setEditingPostBody] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isWorking, setIsWorking] = useState(false);
  const [reactingPostId, setReactingPostId] = useState<string | null>(null);
  const [reactingCommentId, setReactingCommentId] = useState<string | null>(null);

  const profileById = useMemo(() => {
    return new Map(profiles.map((profile) => [profile.id, profile]));
  }, [profiles]);

  async function loadPosts() {
    if (!isSupabaseConfigured()) return;

    const supabase = getSupabaseBrowserClient();

    const { data, error } = await supabase
      .from("posts")
      .select("id, author_id, body, visibility, created_at, edited_at")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Unable to refresh timeline posts:", error);
      return;
    }

    setPosts((data ?? []) as Post[]);
  }

  async function loadComments() {
    if (!isSupabaseConfigured()) return;

    const supabase = getSupabaseBrowserClient();

    const { data, error } = await supabase
      .from("comments")
      .select("id, post_id, author_id, body, created_at")
      .is("deleted_at", null)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Unable to refresh timeline comments:", error);
      return;
    }

    setComments((data ?? []) as Comment[]);
  }

  async function loadReactions() {
    if (!isSupabaseConfigured()) return;

    const supabase = getSupabaseBrowserClient();

    const { data, error } = await supabase
      .from("reactions")
      .select("id, post_id, profile_id, reaction_type");

    if (error) {
      console.error("Unable to refresh post reactions:", error);
      return;
    }

    setReactions((data ?? []) as Reaction[]);
  }

  async function loadCommentReactions() {
    if (!isSupabaseConfigured()) return;

    const supabase = getSupabaseBrowserClient();

    const { data, error } = await supabase
      .from("comment_reactions")
      .select("id, comment_id, profile_id, reaction_type");

    if (error) {
      console.error("Unable to refresh comment reactions:", error);
      return;
    }

    setCommentReactions((data ?? []) as CommentReaction[]);
  }

  async function loadData() {
    setMessage(null);

    if (!isSupabaseConfigured()) {
      setMessage("Supabase is not configured yet. Timeline will work once environment variables are set.");
      setIsLoading(false);
      return;
    }

    try {
      const supabase = getSupabaseBrowserClient();
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;

      const userId = sessionData.session?.user.id;
      if (!userId) {
        setMessage("Please log in before using the timeline.");
        setIsLoading(false);
        return;
      }

      setCurrentUserId(userId);

      const [
        { data: profileData, error: profileError },
        { data: postData, error: postError },
        { data: commentData, error: commentError },
        { data: reactionData, error: reactionError },
        { data: commentReactionData, error: commentReactionError },
      ] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, display_name, role_type, field, avatar_url")
          .is("deleted_at", null),
        supabase
          .from("posts")
          .select("id, author_id, body, visibility, created_at, edited_at")
          .is("deleted_at", null)
          .order("created_at", { ascending: false }),
        supabase
          .from("comments")
          .select("id, post_id, author_id, body, created_at")
          .is("deleted_at", null)
          .order("created_at", { ascending: true }),
        supabase.from("reactions").select("id, post_id, profile_id, reaction_type"),
        supabase.from("comment_reactions").select("id, comment_id, profile_id, reaction_type"),
      ]);

      if (profileError) throw profileError;
      if (postError) throw postError;
      if (commentError) throw commentError;
      if (reactionError) throw reactionError;
      if (commentReactionError) throw commentReactionError;

      setProfiles((profileData ?? []) as Profile[]);
      setPosts((postData ?? []) as Post[]);
      setComments((commentData ?? []) as Comment[]);
      setReactions((reactionData ?? []) as Reaction[]);
      setCommentReactions((commentReactionData ?? []) as CommentReaction[]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load timeline.");
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
      .channel(`timeline-live:${currentUserId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "posts",
        },
        () => {
          void loadPosts();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "comments",
        },
        () => {
          void loadComments();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "reactions",
        },
        () => {
          void loadReactions();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "comment_reactions",
        },
        () => {
          void loadCommentReactions();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [currentUserId]);

  useEffect(() => {
    if (!currentUserId || !isSupabaseConfigured()) return;

    const intervalId = window.setInterval(() => {
      void Promise.all([
        loadPosts(),
        loadComments(),
      ]);
    }, 3000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [currentUserId]);

  async function createPost(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!currentUserId || !postBody.trim() || !isSupabaseConfigured()) return;

    setIsWorking(true);
    setMessage(null);

    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.from("posts").insert({
        author_id: currentUserId,
        body: postBody.trim(),
        visibility,
      });
      if (error) throw error;

      setPostBody("");
      setVisibility("public");
      await loadData();
    } catch (error) {
      setMessage(getActionErrorMessage(error, "create post"));
    } finally {
      setIsWorking(false);
    }
  }

  async function toggleLike(postId: string) {
    if (
      !currentUserId ||
      !isSupabaseConfigured() ||
      reactingPostId === postId
    ) {
      return;
    }

    setReactingPostId(postId);
    setMessage(null);

    const existing = reactions.find(
      (reaction) =>
        reaction.post_id === postId &&
        reaction.profile_id === currentUserId
    );

    try {
      const supabase = getSupabaseBrowserClient();

      if (existing) {
        setReactions((current) =>
          current.filter((reaction) => reaction.id !== existing.id)
        );

        const { error } = await supabase
          .from("reactions")
          .delete()
          .eq("id", existing.id);

        if (error) {
          setReactions((current) => [...current, existing]);
          throw error;
        }
      } else {
        const optimisticId = `optimistic-${postId}-${currentUserId}`;

        const optimisticReaction: Reaction = {
          id: optimisticId,
          post_id: postId,
          profile_id: currentUserId,
          reaction_type: "like",
        };

        setReactions((current) => [...current, optimisticReaction]);

        const { data: createdReaction, error } = await supabase
          .from("reactions")
          .insert({
            post_id: postId,
            profile_id: currentUserId,
            reaction_type: "like",
          })
          .select("id, post_id, profile_id, reaction_type")
          .single();

        if (error) {
          setReactions((current) =>
            current.filter((reaction) => reaction.id !== optimisticId)
          );
          throw error;
        }

        setReactions((current) =>
          current.map((reaction) =>
            reaction.id === optimisticId
              ? (createdReaction as Reaction)
              : reaction
          )
        );

        const post = posts.find((item) => item.id === postId);

        if (post && post.author_id !== currentUserId) {
          const actor = profileById.get(currentUserId);

          const { error: notificationError } = await supabase
            .from("notifications")
            .insert({
              recipient_id: post.author_id,
              actor_id: currentUserId,
              notification_type: "post_liked",
              entity_type: "post",
              entity_id: post.id,
              title: "Someone liked your post",
              body: `${actor?.display_name ?? "Someone"} liked your post.`,
            });

          if (notificationError) {
            console.error(
              "Unable to create post-like notification:",
              notificationError
            );
          }
        }
      }
    } catch (error) {
      setMessage(getActionErrorMessage(error, "update reaction"));
    } finally {
      setReactingPostId(null);
    }
  }

  async function toggleCommentLike(commentId: string) {
    if (
      !currentUserId ||
      !isSupabaseConfigured() ||
      reactingCommentId === commentId
    ) {
      return;
    }

    setReactingCommentId(commentId);
    setMessage(null);

    const existing = commentReactions.find(
      (reaction) =>
        reaction.comment_id === commentId &&
        reaction.profile_id === currentUserId
    );

    try {
      const supabase = getSupabaseBrowserClient();

      if (existing) {
        setCommentReactions((current) =>
          current.filter((reaction) => reaction.id !== existing.id)
        );

        const { error } = await supabase
          .from("comment_reactions")
          .delete()
          .eq("id", existing.id);

        if (error) {
          setCommentReactions((current) => [...current, existing]);
          throw error;
        }
      } else {
        const optimisticId = `optimistic-${commentId}-${currentUserId}`;

        const optimisticReaction: CommentReaction = {
          id: optimisticId,
          comment_id: commentId,
          profile_id: currentUserId,
          reaction_type: "like",
        };

        setCommentReactions((current) => [
          ...current,
          optimisticReaction,
        ]);

        const { data: createdReaction, error } = await supabase
          .from("comment_reactions")
          .insert({
            comment_id: commentId,
            profile_id: currentUserId,
            reaction_type: "like",
          })
          .select("id, comment_id, profile_id, reaction_type")
          .single();

        if (error) {
          setCommentReactions((current) =>
            current.filter((reaction) => reaction.id !== optimisticId)
          );
          throw error;
        }

        setCommentReactions((current) =>
          current.map((reaction) =>
            reaction.id === optimisticId
              ? (createdReaction as CommentReaction)
              : reaction
          )
        );
      }
    } catch (error) {
      setMessage(
        getActionErrorMessage(error, "update comment reaction")
      );
    } finally {
      setReactingCommentId(null);
    }
  }

  async function addComment(event: React.FormEvent<HTMLFormElement>, postId: string) {
    event.preventDefault();
    const body = commentDrafts[postId]?.trim();
    if (!currentUserId || !body || !isSupabaseConfigured()) return;

    setIsWorking(true);
    setMessage(null);

    try {
      const supabase = getSupabaseBrowserClient();
      const { data: createdComment, error } = await supabase
        .from("comments")
        .insert({ post_id: postId, author_id: currentUserId, body })
        .select("id")
        .single();
      if (error) throw error;

      const post = posts.find((item) => item.id === postId);
      if (post && post.author_id !== currentUserId) {
        const actor = profileById.get(currentUserId);
        const { error: notificationError } = await supabase.from("notifications").insert({
          recipient_id: post.author_id,
          actor_id: currentUserId,
          notification_type: "post_commented",
          entity_type: "comment",
          entity_id: createdComment.id,
          title: "New comment on your post",
          body: `${actor?.display_name ?? "Someone"} commented on your post.`,
        });
        if (notificationError) console.error("Unable to create post-comment notification:", notificationError);
      }

      setCommentDrafts((current) => ({ ...current, [postId]: "" }));
      await loadData();
    } catch (error) {
      setMessage(getActionErrorMessage(error, "add comment"));
    } finally {
      setIsWorking(false);
    }
  }

  function startEditingPost(post: Post) {
    setEditingPostId(post.id);
    setEditingPostBody(post.body);
    setMessage(null);
  }

  function cancelEditingPost() {
    setEditingPostId(null);
    setEditingPostBody("");
  }

  async function saveEditedPost(postId: string) {
    if (!currentUserId || !editingPostBody.trim() || !isSupabaseConfigured()) return;

    setIsWorking(true);
    setMessage(null);

    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase
        .from("posts")
        .update({ body: editingPostBody.trim(), edited_at: new Date().toISOString() })
        .eq("id", postId)
        .eq("author_id", currentUserId);
      if (error) throw error;

      cancelEditingPost();
      await loadData();
    } catch (error) {
      setMessage(getActionErrorMessage(error, "edit post"));
    } finally {
      setIsWorking(false);
    }
  }

  function getPostComments(postId: string) {
    return comments.filter((comment) => comment.post_id === postId);
  }

  function getPostLikeCount(postId: string) {
    return reactions.filter((reaction) => reaction.post_id === postId).length;
  }

  function hasLiked(postId: string) {
    return reactions.some((reaction) => reaction.post_id === postId && reaction.profile_id === currentUserId);
  }

  function getCommentLikeCount(commentId: string) {
    return commentReactions.filter((reaction) => reaction.comment_id === commentId).length;
  }

  function hasLikedComment(commentId: string) {
    return commentReactions.some(
      (reaction) => reaction.comment_id === commentId && reaction.profile_id === currentUserId
    );
  }

  return (
    <section className="mx-auto flex w-full max-w-4xl flex-col gap-5 px-4 py-6 sm:gap-6 sm:px-6 sm:py-8">
      {message && <p className={getMessageAlertClass(message)}>{message}</p>}

      <form onSubmit={createPost} className="flex flex-col gap-4 rounded-xl border bg-white p-4">
        <label className="flex flex-col gap-2 text-sm font-medium">
          What's new?
          <textarea
            className="min-h-28 rounded-lg border px-3 py-2"
            value={postBody}
            onChange={(event) => setPostBody(event.target.value)}
            placeholder="Share an update..."
          />
        </label>

        <label className="flex flex-col gap-2 text-sm font-medium">
          Visibility
          <select
            className="w-fit rounded-lg border px-3 py-2"
            value={visibility}
            onChange={(event) => setVisibility(event.target.value as "public" | "connections")}
          >
            <option value="public">Public</option>
            <option value="connections">Connections only</option>
          </select>
        </label>

        <div className="flex items-end justify-between gap-3">
          <div className="relative flex items-center gap-2">
            <button
              aria-expanded={isEmojiPickerOpen}
              aria-label="Add emoji"
              className={[
                "inline-flex h-10 w-10 items-center justify-center rounded-xl border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2",
                isEmojiPickerOpen
                  ? "border-gray-950 bg-gray-950 text-white"
                  : "border-gray-300 bg-white text-gray-950 hover:border-gray-500 hover:bg-gray-50",
              ].join(" ")}
              onClick={() => setIsEmojiPickerOpen((current) => !current)}
              title="Add emoji"
              type="button"
            >
              <svg
                aria-hidden="true"
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  cx="12"
                  cy="12"
                  r="9"
                  stroke="currentColor"
                  strokeWidth="1.8"
                />
                <circle cx="9" cy="10" r="1" fill="currentColor" />
                <circle cx="15" cy="10" r="1" fill="currentColor" />
                <path
                  d="M8.5 14c.9 1.3 2.1 2 3.5 2s2.6-.7 3.5-2"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeWidth="1.8"
                />
              </svg>
            </button>

            {isEmojiPickerOpen && (
              <div className="absolute left-0 top-full z-10 mt-2 grid w-max grid-cols-[repeat(6,2.5rem)] gap-1 rounded-xl border border-gray-200 bg-white p-2 shadow-lg sm:left-full sm:top-1/2 sm:ml-2 sm:mt-0 sm:-translate-y-1/2">
                {postEmojis.map((emoji) => (
                  <button
                    aria-label={`Add ${emoji}`}
                    className="flex h-10 w-10 items-center justify-center rounded-lg text-xl transition hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                    key={emoji}
                    onClick={() => {
                      setPostBody((current) => `${current}${emoji}`);
                      setIsEmojiPickerOpen(false);
                    }}
                    type="button"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            className="min-h-10 rounded-xl bg-gray-950 px-5 py-2 text-sm font-medium text-white transition hover:bg-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:opacity-50"
            disabled={!postBody.trim() || isWorking}
            type="submit"
          >
            Post
          </button>
        </div>
      </form>

      {isLoading ? (
        <p className="text-sm text-gray-600">Loading timeline...</p>
      ) : posts.length === 0 ? (
        <p className="rounded-xl border border-dashed p-4 text-sm text-gray-600">No posts yet. Create the first timeline post.</p>
      ) : (
        posts.map((post) => {
          const author = profileById.get(post.author_id);
          const postComments = getPostComments(post.id);
          const liked = hasLiked(post.id);
          const isOwnPost = post.author_id === currentUserId;
          const isEditing = editingPostId === post.id;

          return (
            <article key={post.id} className="flex min-w-0 flex-col gap-4 rounded-xl border bg-white p-4">
              <div>
                <div className="flex flex-col justify-between gap-2 md:flex-row md:items-center">
                  {author ? (
                    <Link className="flex items-center gap-3 rounded-lg hover:bg-gray-50" href={`/profile/${author.id}`}>
                      <ProfileAvatar avatarPath={author.avatar_url} displayName={author.display_name} size={40} />
                      <div>
                        <h2 className="font-semibold">{author.display_name}</h2>
                        <p className="text-sm text-gray-600">
                          {[author.role_type, author.field].filter(Boolean).join(" - ") || "Profile"}
                        </p>
                      </div>
                    </Link>
                  ) : (
                    <div className="flex items-center gap-3">
                      <ProfileAvatar avatarPath={null} displayName={null} size={40} />
                      <div>
                        <h2 className="font-semibold">Unknown profile</h2>
                        <p className="text-sm text-gray-600">Profile</p>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <span className="w-fit rounded-full border px-3 py-1 text-xs">
                      {post.visibility === "public" ? "Public" : "Connections"}
                    </span>
                    {isOwnPost && !isEditing ? (
                      <button
                        className="rounded-lg border px-3 py-1 text-xs font-medium"
                        disabled={isWorking}
                        onClick={() => startEditingPost(post)}
                        type="button"
                      >
                        Edit
                      </button>
                    ) : (
                      currentUserId && (
                        <ReportMenu
                          targetType="post"
                          targetId={post.id}
                          reportedUserId={post.author_id}
                          label="post"
                          disabled={isWorking}
                        />
                      )
                    )}
                  </div>
                </div>

                {isEditing ? (
                  <div className="mt-4 flex flex-col gap-3">
                    <textarea
                      className="min-h-28 rounded-lg border px-3 py-2 text-sm"
                      value={editingPostBody}
                      onChange={(event) => setEditingPostBody(event.target.value)}
                    />
                    <div className="flex gap-2">
                      <button
                        className="min-h-10 rounded-xl bg-gray-950 px-3 py-2 text-sm font-medium text-white transition hover:bg-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:opacity-50"
                        disabled={!editingPostBody.trim() || isWorking}
                        onClick={() => saveEditedPost(post.id)}
                        type="button"
                      >
                        Save
                      </button>
                      <button
                        className="rounded-lg border px-3 py-2 text-sm font-medium"
                        disabled={isWorking}
                        onClick={cancelEditingPost}
                        type="button"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="mt-4 whitespace-pre-wrap text-sm text-gray-800">{post.body}</p>
                    {post.edited_at && <p className="mt-1 text-xs text-gray-500">Edited</p>}
                  </>
                )}
              </div>

              <div className="flex items-center gap-3">
                <button
                  aria-label={liked ? "Unlike post" : "Like post"}
                  aria-pressed={liked}
                  className={[
                    "inline-flex min-h-10 items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:opacity-50",
                    liked
                      ? "border-blue-200 bg-blue-50 text-blue-700"
                      : "border-gray-200 bg-white text-gray-600 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700",
                  ].join(" ")}
                  disabled={reactingPostId === post.id}
                  onClick={() => toggleLike(post.id)}
                  title={liked ? "Unlike" : "Like"}
                  type="button"
                >
                  <svg
                    aria-hidden="true"
                    className="h-5 w-5"
                    fill={liked ? "currentColor" : "none"}
                    viewBox="0 0 24 24"
                  >
                    <path
                      d="M7 10v10H4V10h3Zm4.2-7c.8 0 1.5.7 1.5 1.5v3.1h4.8c1.4 0 2.4 1.3 2 2.6l-2.1 7.3c-.3.9-1.1 1.5-2.1 1.5H9V9.7l2-4.7c.1-.3.2-.7.2-1V3Z"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1.8"
                    />
                  </svg>

                  <span>{getPostLikeCount(post.id)}</span>
                </button>
                <span className="text-sm text-gray-600">{postComments.length} comments</span>
              </div>

              <div className="flex flex-col gap-3 border-t pt-4">
                {postComments.map((comment) => {
                  const commenter = profileById.get(comment.author_id);
                  const commentLiked = hasLikedComment(comment.id);
                  const isOwnComment = comment.author_id === currentUserId;

                  return (
                    <div key={comment.id} className="flex gap-3 rounded-lg border p-3">
                      {commenter ? (
                        <Link className="shrink-0 rounded-full" href={`/profile/${commenter.id}`}>
                          <ProfileAvatar avatarPath={commenter.avatar_url} displayName={commenter.display_name} size={28} />
                        </Link>
                      ) : (
                        <ProfileAvatar avatarPath={null} displayName={null} size={28} />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            {commenter ? (
                              <Link className="text-sm font-medium hover:underline" href={`/profile/${commenter.id}`}>
                                {commenter.display_name}
                              </Link>
                            ) : (
                              <p className="text-sm font-medium">Unknown profile</p>
                            )}
                            <p className="mt-1 whitespace-pre-wrap text-sm text-gray-700">{comment.body}</p>
                          </div>
                          {!isOwnComment && currentUserId && (
                            <ReportMenu
                              targetType="comment"
                              targetId={comment.id}
                              reportedUserId={comment.author_id}
                              label="comment"
                              disabled={isWorking}
                            />
                          )}
                        </div>
                        <button
                          aria-label={
                            commentLiked
                              ? "Unlike comment"
                              : "Like comment"
                          }
                          aria-pressed={commentLiked}
                          className={[
                            "mt-2 inline-flex min-h-9 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:opacity-50",
                            commentLiked
                              ? "border-blue-200 bg-blue-50 text-blue-700"
                              : "border-gray-200 bg-white text-gray-600 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700",
                          ].join(" ")}
                          disabled={reactingCommentId === comment.id}
                          onClick={() => toggleCommentLike(comment.id)}
                          title={commentLiked ? "Unlike" : "Like"}
                          type="button"
                        >
                          <svg
                            aria-hidden="true"
                            className="h-4 w-4"
                            fill={commentLiked ? "currentColor" : "none"}
                            viewBox="0 0 24 24"
                          >
                            <path
                              d="M7 10v10H4V10h3Zm4.2-7c.8 0 1.5.7 1.5 1.5v3.1h4.8c1.4 0 2.4 1.3 2 2.6l-2.1 7.3c-.3.9-1.1 1.5-2.1 1.5H9V9.7l2-4.7c.1-.3.2-.7.2-1V3Z"
                              stroke="currentColor"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="1.8"
                            />
                          </svg>

                          <span>{getCommentLikeCount(comment.id)}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}

                <form onSubmit={(event) => addComment(event, post.id)} className="flex flex-col gap-3 sm:flex-row">
                  <input
                    className="min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm"
                    value={commentDrafts[post.id] ?? ""}
                    onChange={(event) =>
                      setCommentDrafts((current) => ({ ...current, [post.id]: event.target.value }))
                    }
                    placeholder="Write a comment..."
                  />
                  <button
                    className="min-h-10 rounded-xl bg-gray-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:opacity-50"
                    disabled={!commentDrafts[post.id]?.trim() || isWorking}
                    type="submit"
                  >
                    Comment
                  </button>
                </form>
              </div>
            </article>
          );
        })
      )}
    </section>
  );
}
