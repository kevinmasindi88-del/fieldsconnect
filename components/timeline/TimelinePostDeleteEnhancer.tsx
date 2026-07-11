"use client";

import { useEffect } from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/browser";

type OwnPost = {
  id: string;
  body: string;
  created_at: string;
};

export function TimelinePostDeleteEnhancer() {
  useEffect(() => {
    if (!isSupabaseConfigured()) return;

    let cancelled = false;
    let queued = false;

    async function enhanceDeleteButtons() {
      const supabase = getSupabaseBrowserClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user.id;

      if (!userId || cancelled) return;

      const { data, error } = await supabase
        .from("posts")
        .select("id, body, created_at")
        .eq("author_id", userId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      if (error || cancelled) return;

      const ownPosts = (data ?? []) as OwnPost[];
      const usedPostIds = new Set<string>();
      const postArticles = Array.from(document.querySelectorAll<HTMLElement>("main article"));

      for (const article of postArticles) {
        const editButton = Array.from(article.querySelectorAll<HTMLButtonElement>("button")).find(
          (button) => button.textContent?.trim() === "Edit"
        );

        if (!editButton) continue;

        const actionContainer = editButton.parentElement;
        if (!actionContainer || actionContainer.querySelector("[data-delete-post-button='true']")) continue;

        const bodyElement = Array.from(article.querySelectorAll<HTMLParagraphElement>("p")).find((paragraph) =>
          paragraph.className.includes("whitespace-pre-wrap") && paragraph.className.includes("text-gray-800")
        );
        const body = bodyElement?.textContent ?? "";

        const matchedPost = ownPosts.find(
          (post) => !usedPostIds.has(post.id) && post.body === body
        );

        if (!matchedPost) continue;
        usedPostIds.add(matchedPost.id);

        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.dataset.deletePostButton = "true";
        deleteButton.dataset.postId = matchedPost.id;
        deleteButton.className =
          "rounded-lg border px-3 py-1 text-xs font-medium text-red-700 disabled:opacity-50";
        deleteButton.textContent = "Delete";
        actionContainer.appendChild(deleteButton);
      }
    }

    function queueEnhancement() {
      if (queued) return;
      queued = true;
      window.requestAnimationFrame(() => {
        queued = false;
        void enhanceDeleteButtons();
      });
    }

    async function handleClick(event: MouseEvent) {
      const target = event.target as HTMLElement;
      const button = target.closest<HTMLButtonElement>("[data-delete-post-button='true']");
      if (!button) return;

      const postId = button.dataset.postId;
      if (!postId) return;

      const confirmed = window.confirm(
        "Delete this post? It will be removed from the timeline along with access to its comments and reactions."
      );
      if (!confirmed) return;

      button.disabled = true;
      button.textContent = "Deleting...";

      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase.rpc("soft_delete_own_post", {
        target_post_id: postId,
      });

      if (error) {
        window.alert(error.message || "Unable to delete the post.");
        button.disabled = false;
        button.textContent = "Delete";
        return;
      }

      if (!data) {
        window.alert("The post could not be deleted. It may no longer exist or may not belong to this account.");
        button.disabled = false;
        button.textContent = "Delete";
        return;
      }

      window.location.reload();
    }

    void enhanceDeleteButtons();

    const observer = new MutationObserver(queueEnhancement);
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener("click", handleClick);

    return () => {
      cancelled = true;
      observer.disconnect();
      document.removeEventListener("click", handleClick);
    };
  }, []);

  return null;
}
