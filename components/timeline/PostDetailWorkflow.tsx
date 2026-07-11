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

export function PostDetailWorkflow({ postId }: { postId: string }) {
  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
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

        const [
          { data: postData, error: postError },
          { data: commentData, error: commentError },
          { data: profileData, error: profileError },
        ] = await Promise.all([
          supabase
            .from("posts")
            .select("id, author_id, body, visibility, created_at, edited_at")
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
        ]);

        if (postError) throw postError;
        if (commentError) throw commentError;
        if (profileError) throw profileError;

        setPost((postData as Post | null) ?? null);
        setComments((commentData ?? []) as Comment[]);
        setProfiles((profileData ?? []) as Profile[]);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to load this post.");
      } finally {
        setIsLoading(false);
      }
    }

    void loadPost();
  }, [postId]);

  if (isLoading) {
    return <main className="mx-auto w-full max-w-4xl p-8 text-sm text-gray-600">Loading post...</main>;
  }

  if (message) {
    return (
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-4 p-8">
        <p className="rounded-xl border p-4 text-sm text-gray-700">{message}</p>
        <Link className="w-fit rounded-lg border px-3 py-2 text-sm font-medium" href="/">
          Back to timeline
        </Link>
      </main>
    );
  }

  if (!post) {
    return (
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-4 p-8">
        <p className="rounded-xl border p-4 text-sm text-gray-700">This post is unavailable or you do not have access to it.</p>
        <Link className="w-fit rounded-lg border px-3 py-2 text-sm font-medium" href="/">
          Back to timeline
        </Link>
      </main>
    );
  }

  const author = profileById.get(post.author_id);

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-8">
      <Link className="w-fit rounded-lg border px-3 py-2 text-sm font-medium" href="/">
        Back to timeline
      </Link>

      <article className="flex flex-col gap-4 rounded-xl border p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <ProfileAvatar avatarPath={author?.avatar_url ?? null} displayName={author?.display_name ?? null} size={40} />
            <div>
              <p className="font-semibold">{author?.display_name ?? "Unknown profile"}</p>
              <p className="text-sm text-gray-600">
                {author ? [author.role_type, author.field].filter(Boolean).join(" - ") || "Profile" : "Profile"}
              </p>
            </div>
          </div>
          <span className="rounded-full border px-3 py-1 text-xs">
            {post.visibility === "public" ? "Public" : "Connections"}
          </span>
        </div>

        <div>
          <p className="whitespace-pre-wrap text-sm text-gray-800">{post.body}</p>
          {post.edited_at && <p className="mt-1 text-xs text-gray-500">Edited</p>}
        </div>

        <div className="flex flex-col gap-3 border-t pt-4">
          <p className="text-sm font-medium">{comments.length} comments</p>
          {comments.map((comment) => {
            const commenter = profileById.get(comment.author_id);
            return (
              <div key={comment.id} className="flex gap-3 rounded-lg border p-3">
                <ProfileAvatar
                  avatarPath={commenter?.avatar_url ?? null}
                  displayName={commenter?.display_name ?? null}
                  size={28}
                />
                <div>
                  <p className="text-sm font-medium">{commenter?.display_name ?? "Unknown profile"}</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-gray-700">{comment.body}</p>
                </div>
              </div>
            );
          })}
        </div>
      </article>
    </main>
  );
}
