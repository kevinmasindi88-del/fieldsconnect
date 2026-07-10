"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/browser";
import { ProfileAvatar } from "@/components/profile/ProfileAvatar";

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

export function TimelineWorkflow() {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [commentReactions, setCommentReactions] = useState<CommentReaction[]>([]);
  const [postBody, setPostBody] = useState("");
  const [visibility, setVisibility] = useState<"public" | "connections">("public");
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editingPostBody, setEditingPostBody] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isWorking, setIsWorking] = useState(false);

  const profileById = useMemo(() => {
    return new Map(profiles.map((profile) => [profile.id, profile]));
  }, [profiles]);

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
        supabase
          .from("reactions")
          .select("id, post_id, profile_id, reaction_type"),
        supabase
          .from("comment_reactions")
          .select("id, comment_id, profile_id, reaction_type"),
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
      setMessage(error instanceof Error ? error.message : "Unable to create post.");
    } finally {
      setIsWorking(false);
    }
  }

  async function toggleLike(postId: string) {
    if (!currentUserId || !isSupabaseConfigured()) return;

    setIsWorking(true);
    setMessage(null);

    try {
      const supabase = getSupabaseBrowserClient();

      const existing = reactions.find(
        (reaction) => reaction.post_id === postId && reaction.profile_id === currentUserId
      );

      if (existing) {
        const { error } = await supabase.from("reactions").delete().eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("reactions").insert({
          post_id: postId,
          profile_id: currentUserId,
          reaction_type: "like",
        });

        if (error) throw error;

        const post = posts.find((item) => item.id === postId);

        if (post && post.author_id !== currentUserId) {
          const actor = profileById.get(currentUserId);

          const { error: notificationError } = await supabase.from("notifications").insert({
            recipient_id: post.author_id,
            actor_id: currentUserId,
            notification_type: "post_liked",
            entity_type: "post",
            entity_id: post.id,
            title: "Someone liked your post",
            body: `${actor?.display_name ?? "Someone"} liked your post.`,
          });

          if (notificationError) {
            console.error("Unable to create post-like notification:", notificationError);
          }
        }
      }

      await loadData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update reaction.");
    } finally {
      setIsWorking(false);
    }
  }

  async function toggleCommentLike(commentId: string) {
    if (!currentUserId || !isSupabaseConfigured()) return;

    setIsWorking(true);
    setMessage(null);

    try {
      const supabase = getSupabaseBrowserClient();
      const existing = commentReactions.find(
        (reaction) => reaction.comment_id === commentId && reaction.profile_id === currentUserId
      );

      if (existing) {
        const { error } = await supabase.from("comment_reactions").delete().eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("comment_reactions").insert({
          comment_id: commentId,
          profile_id: currentUserId,
          reaction_type: "like",
        });

        if (error) throw error;
      }

      await loadData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update comment reaction.");
    } finally {
      setIsWorking(false);
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
        .insert({
          post_id: postId,
          author_id: currentUserId,
          body,
        })
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

        if (notificationError) {
          console.error("Unable to create post-comment notification:", notificationError);
        }
      }

      setCommentDrafts((current) => ({ ...current, [postId]: "" }));
      await loadData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to add comment.");
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
        .update({
          body: editingPostBody.trim(),
          edited_at: new Date().toISOString(),
        })
        .eq("id", postId)
        .eq("author_id", currentUserId);

      if (error) throw error;

      cancelEditingPost();
      await loadData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to edit post.");
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
    <section className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-8">
      <div>
        <h1 className="text-3xl font-semibold">Timeline</h1>
        <p className="mt-2 text-sm text-gray-600">
          Share updates, comment, and react to posts and replies.
        </p>
      </div>

      {message && <p className="rounded-lg border p-3 text-sm text-gray-700">{message}</p>}

      <form onSubmit={createPost} className="flex flex-col gap-4 rounded-xl border p-4">
        <label className="flex flex-col gap-2 text-sm font-medium">
          New post
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

        <button
          className="w-fit rounded-lg bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          disabled={!postBody.trim() || isWorking}
          type="submit"
        >
          Post
        </button>
      </form>

      {isLoading ? (
        <p className="text-sm text-gray-600">Loading timeline...</p>
      ) : posts.length === 0 ? (
        <p className="rounded-xl border border-dashed p-4 text-sm text-gray-600">
          No posts yet. Create the first timeline post.
        </p>
      ) : (
        posts.map((post) => {
          const author = profileById.get(post.author_id);
          const postComments = getPostComments(post.id);
          const liked = hasLiked(post.id);
          const isOwnPost = post.author_id === currentUserId;
          const isEditing = editingPostId === post.id;

          return (
            <article key={post.id} className="flex flex-col gap-4 rounded-xl border p-4">
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
                    {isOwnPost && !isEditing && (
                      <button
                        className="rounded-lg border px-3 py-1 text-xs font-medium"
                        disabled={isWorking}
                        onClick={() => startEditingPost(post)}
                        type="button"
                      >
                        Edit
                      </button>
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
                        className="rounded-lg bg-black px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
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
                  className="rounded-lg border px-3 py-2 text-sm font-medium disabled:opacity-50"
                  disabled={isWorking}
                  onClick={() => toggleLike(post.id)}
                  type="button"
                >
                  {liked ? "Unlike" : "Like"} ({getPostLikeCount(post.id)})
                </button>
                <span className="text-sm text-gray-600">{postComments.length} comments</span>
              </div>

              <div className="flex flex-col gap-3 border-t pt-4">
                {postComments.map((comment) => {
                  const commenter = profileById.get(comment.author_id);
                  const commentLiked = hasLikedComment(comment.id);

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
                        {commenter ? (
                          <Link className="text-sm font-medium hover:underline" href={`/profile/${commenter.id}`}>
                            {commenter.display_name}
                          </Link>
                        ) : (
                          <p className="text-sm font-medium">Unknown profile</p>
                        )}
                        <p className="mt-1 whitespace-pre-wrap text-sm text-gray-700">{comment.body}</p>
                        <button
                          className="mt-2 rounded-lg border px-2 py-1 text-xs font-medium disabled:opacity-50"
                          disabled={isWorking}
                          onClick={() => toggleCommentLike(comment.id)}
                          type="button"
                        >
                          {commentLiked ? "Unlike" : "Like"} ({getCommentLikeCount(comment.id)})
                        </button>
                      </div>
                    </div>
                  );
                })}

                <form onSubmit={(event) => addComment(event, post.id)} className="flex gap-3">
                  <input
                    className="flex-1 rounded-lg border px-3 py-2 text-sm"
                    value={commentDrafts[post.id] ?? ""}
                    onChange={(event) =>
                      setCommentDrafts((current) => ({ ...current, [post.id]: event.target.value }))
                    }
                    placeholder="Write a comment..."
                  />
                  <button
                    className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
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
