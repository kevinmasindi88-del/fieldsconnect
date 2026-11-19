"use client";

import { useEffect } from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/browser";

type OwnComment = {
  id: string;
  body: string;
  created_at: string;
};

export function TimelineCommentDeleteEnhancer() {
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
        .from("comments")
        .select("id, body, created_at")
        .eq("author_id", userId)
        .is("deleted_at", null)
        .order("created_at", { ascending: true });

      if (error || cancelled) return;

      const ownComments = (data ?? []) as OwnComment[];
      const usedCommentIds = new Set<string>();
      const commentCards = Array.from(
        document.querySelectorAll<HTMLElement>("main article > div.border-t > div.rounded-lg.border")
      );

      for (const card of commentCards) {
        if (card.querySelector("[data-delete-comment-button='true']")) continue;

        const bodyElement = Array.from(card.querySelectorAll<HTMLParagraphElement>("p")).find((paragraph) =>
          paragraph.className.includes("whitespace-pre-wrap") && paragraph.className.includes("text-gray-700")
        );
        const body = bodyElement?.textContent ?? "";

        const matchedComment = ownComments.find(
          (comment) => !usedCommentIds.has(comment.id) && comment.body === body
        );

        if (!matchedComment) continue;
        usedCommentIds.add(matchedComment.id);

        const likeButton = Array.from(card.querySelectorAll<HTMLButtonElement>("button")).find((button) =>
          ["Like", "Unlike"].some((label) => button.textContent?.trim().startsWith(label))
        );

        if (!likeButton) continue;

        const actions = likeButton.parentElement;
        if (!actions) continue;

        actions.classList.add("flex", "items-center", "gap-2");

        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.dataset.deleteCommentButton = "true";
        deleteButton.dataset.commentId = matchedComment.id;
        deleteButton.className =
          "mt-2 rounded-lg border px-2 py-1 text-xs font-medium text-red-700 disabled:opacity-50";
        deleteButton.textContent = "Delete";
        actions.appendChild(deleteButton);
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
      const button = target.closest<HTMLButtonElement>("[data-delete-comment-button='true']");
      if (!button) return;

      const commentId = button.dataset.commentId;
      if (!commentId) return;

      const confirmed = window.confirm("Delete this comment? This action cannot be undone.");
      if (!confirmed) return;

      button.disabled = true;
      button.textContent = "Deleting...";

      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase.rpc("soft_delete_own_comment", {
        target_comment_id: commentId,
      });

      if (error) {
        window.alert(error.message || "Unable to delete the comment.");
        button.disabled = false;
        button.textContent = "Delete";
        return;
      }

      if (!data) {
        window.alert("The comment could not be deleted. It may no longer exist or may not belong to this account.");
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
