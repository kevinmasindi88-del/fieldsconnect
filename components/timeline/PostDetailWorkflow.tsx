"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/browser";
import { ProfileAvatar } from "@/components/profile/ProfileAvatar";
import { FcLogoAvatar } from "@/components/branding/FcLogoAvatar";
import { PostRichContent, MentionedText } from "@/components/timeline/PostRichContent";
import { TrashIcon } from "@/components/timeline/ActionIcons";

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
  image_path: string | null;
  link_url: string | null;
};

type FcNewsPublication = {
  post_id: string;
  fc_news_id: string;
  title: string;
  published_at: string;
};

type Comment = {
  id: string;
  post_id: string;
  author_id: string;
  body: string;
  created_at: string;
};

type PostMention = {
  post_id: string;
  mentioned_profile_id: string;
};

type CommentMention = {
  comment_id: string;
  mentioned_profile_id: string;
};

export function PostDetailWorkflow({ postId }: { postId: string }) {
  const [post, setPost] = useState<Post | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isDeletingCommentId, setIsDeletingCommentId] = useState<string | null>(null);
  const [fcNewsPublication, setFcNewsPublication] =
    useState<FcNewsPublication | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [postMentions, setPostMentions] = useState<PostMention[]>([]);
  const [commentMentions, setCommentMentions] = useState<CommentMention[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const profileById = useMemo(
    () => new Map(profiles.map((profile) => [profile.id, profile])),
    [profiles]
  );

  useEffect(() => {
    async function loadPost() {
      if (!isSupabaseConfigured()) {
        setMessage("Supabase is not configured yet.");
        setIsLoading(false);
        return;
      }

      try {
        const supabase = getSupabaseBrowserClient();
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) throw sessionError;
        if (!sessionData.session?.user) {
          setMessage("Please log in before viewing this post.");
          return;
        }
        setCurrentUserId(sessionData.session.user.id);

        const [
          { data: postData, error: postError },
          { data: commentData, error: commentError },
          { data: profileData, error: profileError },
          { data: postMentionData, error: postMentionError },
        ] = await Promise.all([
          supabase
            .from("posts")
            .select("id, author_id, body, visibility, created_at, edited_at, image_path, link_url")
            .eq("id", postId)
            .is("deleted_at", null)
            .maybeSingle(),
          supabase
            .from("comments")
            .select("id, post_id, author_id, body, created_at")
            .eq("post_id", postId)
            .is("deleted_at", null)
            .order("created_at", { ascending: true }),
          supabase
            .from("profiles")
            .select("id, display_name, role_type, field, avatar_url")
            .is("deleted_at", null),
          supabase
            .from("post_mentions")
            .select("post_id, mentioned_profile_id")
            .eq("post_id", postId),
        ]);

        if (postError) throw postError;
        if (commentError) throw commentError;
        if (profileError) throw profileError;
        if (postMentionError) throw postMentionError;

        const commentIds = (commentData ?? []).map((comment) => comment.id);
        let mentionData: CommentMention[] = [];
        if (commentIds.length > 0) {
          const { data, error } = await supabase.from("comment_mentions")
            .select("comment_id, mentioned_profile_id")
            .in("comment_id", commentIds);
          if (error) throw error;
          mentionData = (data ?? []) as CommentMention[];
        }
        setCommentMentions(mentionData);

        const publicationResult = await supabase
          .from("fc_news_publications")
          .select("post_id, fc_news_id, title, published_at")
          .eq("post_id", postId)
          .maybeSingle();

        if (publicationResult.error) {
          throw publicationResult.error;
        }

        setFcNewsPublication(
          (publicationResult.data as FcNewsPublication | null) ?? null
        );

        setPost((postData as Post | null) ?? null);
        setComments((commentData ?? []) as Comment[]);
        setProfiles((profileData ?? []) as Profile[]);
        setPostMentions(
          (postMentionData ?? []) as PostMention[]
        );
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to load this post.");
      } finally {
        setIsLoading(false);
      }
    }

    void loadPost();
  }, [postId]);

  useEffect(() => {
    if (isLoading || !post || !window.location.hash.startsWith("#comment-")) return;
    const anchor = decodeURIComponent(window.location.hash.slice(1));
    window.requestAnimationFrame(() => document.getElementById(anchor)?.scrollIntoView({ behavior: "smooth", block: "center" }));
  }, [isLoading, post, comments.length]);

  async function deleteOwnComment(commentId: string) {
    if (!currentUserId || isDeletingCommentId || !isSupabaseConfigured()) return;
    if (!comments.some((comment) => comment.id === commentId && comment.author_id === currentUserId)) return;
    if (!window.confirm("Delete your comment?")) return;
    setIsDeletingCommentId(commentId);
    setMessage(null);
    try {
      const { data: deleted, error } = await getSupabaseBrowserClient()
        .rpc("soft_delete_own_comment", { target_comment_id: commentId });
      if (error) throw error;
      if (!deleted) throw new Error("The comment was not deleted. It may have already been removed.");
      setComments((current) => current.filter((comment) => comment.id !== commentId));
      setCommentMentions((current) => current.filter((mention) => mention.comment_id !== commentId));
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Could not delete your comment.");
    } finally {
      setIsDeletingCommentId(null);
    }
  }

  if (isLoading) {
    return <main className="mx-auto w-full max-w-4xl px-4 py-6 text-sm text-gray-600 sm:p-8">Loading post...</main>;
  }

  if (message) {
    return (
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-4 py-6 sm:p-8">
        <p className="rounded-xl border p-4 text-sm text-gray-700">{message}</p>
        <Link className="w-full rounded-lg border px-3 py-2 text-center text-sm font-medium sm:w-fit" href="/">
          Back to timeline
        </Link>
      </main>
    );
  }

  if (!post) {
    return (
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-4 py-6 sm:p-8">
        <p className="rounded-xl border p-4 text-sm text-gray-700">This post is unavailable or you do not have access to it.</p>
        <Link className="w-full rounded-lg border px-3 py-2 text-center text-sm font-medium sm:w-fit" href="/">
          Back to timeline
        </Link>
      </main>
    );
  }

  const author = profileById.get(post.author_id);

  const mentionedProfiles = postMentions
    .map((mention) =>
      profileById.get(mention.mentioned_profile_id)
    )
    .filter((profile): profile is Profile => Boolean(profile));

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-4 py-6 sm:gap-6 sm:p-8">
      <Link className="w-full rounded-lg border px-3 py-2 text-center text-sm font-medium sm:w-fit" href="/">
        Back to timeline
      </Link>

      <article className="flex flex-col gap-4 rounded-xl border p-3 sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {fcNewsPublication ? (
            <div className="flex min-w-0 items-center gap-3">
              <FcLogoAvatar size={40} />
              <div className="min-w-0">
                <p className="font-semibold">FC News</p>
                <p className="text-sm text-gray-600">
                  Official FieldsConnect update
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <ProfileAvatar avatarPath={author?.avatar_url ?? null} displayName={author?.display_name ?? null} size={40} />
              <div>
                <p className="font-semibold">{author?.display_name ?? "Unknown profile"}</p>
                <p className="text-sm text-gray-600">
                  {author ? [author.role_type, author.field].filter(Boolean).join(" - ") || "Profile" : "Profile"}
                </p>
              </div>
            </div>
          )}
          <span className="rounded-full border px-3 py-1 text-xs">
            {post.visibility === "public" ? "Public" : "Connections"}
          </span>
        </div>

        <div>
          {fcNewsPublication && (
            <h1 className="mb-2 break-words text-lg font-semibold leading-snug text-gray-950 sm:text-xl">
              {fcNewsPublication.title}
            </h1>
          )}
          <PostRichContent body={post.body} imagePath={post.image_path} linkUrl={post.link_url} mentionedProfiles={mentionedProfiles.map((person) => ({ id: person.id, display_name: person.display_name }))} />
          {mentionedProfiles.some((person) => !post.body.includes(`@${person.display_name}`)) && (
            <div className="mt-2 flex flex-wrap gap-2">
              {mentionedProfiles.filter((person) => !post.body.includes(`@${person.display_name}`)).map((profile) => (
                <Link className="text-sm font-medium text-blue-700 hover:underline" key={profile.id} href={`/profile/${profile.id}`}>@{profile.display_name}</Link>
              ))}
            </div>
          )}
          {!fcNewsPublication && post.edited_at && <p className="mt-1 text-xs text-gray-500">Edited</p>}
        </div>

        <div className="flex flex-col gap-3 border-t pt-4">
          <p className="text-sm font-medium">{comments.length} comments</p>
          {comments.map((comment) => {
            const commenter = profileById.get(comment.author_id);
            return (
              <div key={comment.id} id={`comment-${comment.id}`} className="flex scroll-mt-24 gap-3 rounded-lg border p-3">
                <ProfileAvatar
                  avatarPath={commenter?.avatar_url ?? null}
                  displayName={commenter?.display_name ?? null}
                  size={28}
                />
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium">{commenter?.display_name ?? "Unknown profile"}</p>
                    {comment.author_id === currentUserId && (
                      <button
                        type="button"
                        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-red-600 transition hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 disabled:opacity-50"
                        disabled={Boolean(isDeletingCommentId)}
                        onClick={() => void deleteOwnComment(comment.id)}
                        aria-label="Delete your comment"
                        title="Delete comment"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-gray-700">
                    <MentionedText
                      text={comment.body}
                      mentions={commentMentions
                        .filter((mention) => mention.comment_id === comment.id)
                        .map((mention) => profileById.get(mention.mentioned_profile_id))
                        .filter((person): person is Profile => Boolean(person))
                        .map((person) => ({ id: person.id, display_name: person.display_name }))}
                    />
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </article>
    </main>
  );
}
