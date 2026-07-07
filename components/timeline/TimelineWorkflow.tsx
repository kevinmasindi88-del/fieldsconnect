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

export function TimelineWorkflow() {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [postBody, setPostBody] = useState("");
  const [visibility, setVisibility] = useState<"public" | "connections">("public");
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
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
      ] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, display_name, role_type, field, avatar_url")
          .is("deleted_at", null),
        supabase
          .from("posts")
          .select("id, author_id, body, visibility, created_at")
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
      ]);

      if (profileError) throw profileError;
      if (postError) throw postError;
      if (commentError) throw commentError;
      if (reactionError) throw reactionError;

      setProfiles((profileData ?? []) as Profile[]);
      setPosts((postData ?? []) as Post[]);
      setComments((commentData ?? []) as Comment[]);
      setReactions((reactionData ?? []) as Reaction[]);
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

  function getPostComments(postId: string) {
    return comments.filter((comment) => comment.post_id === postId);
  }

  function getPostLikeCount(postId: string) {
    return reactions.filter((reaction) => reaction.post_id === postId).length;
  }

  function hasLiked(postId: string) {
    return reactions.some((reaction) => reaction.post_id === postId && reaction.profile_id === currentUserId);
  }

  return (
    <section className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-8">
      <div>
        <h1 className="text-3xl font-semibold">Timeline</h1>
        <p className="mt-2 text-sm text-gray-600">
          Share simple text posts, comment, and like posts. Image uploads and ranking are out of scope for this baseline.
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
                  <span className="w-fit rounded-full border px-3 py-1 text-xs">
                    {post.visibility === "public" ? "Public" : "Connections"}
                  </span>
                </div>

                <p className="mt-4 whitespace-pre-wrap text-sm text-gray-800">{post.body}</p>
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

                  return (
                    <div key={comment.id} className="flex gap-3 rounded-lg border p-3">
                      {commenter ? (
                        <Link className="shrink-0 rounded-full" href={`/profile/${commenter.id}`}>
                          <ProfileAvatar avatarPath={commenter.avatar_url} displayName={commenter.display_name} size={28} />
                        </Link>
                      ) : (
                        <ProfileAvatar avatarPath={null} displayName={null} size={28} />
                      )}
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


