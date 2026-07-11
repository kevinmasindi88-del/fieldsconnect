"use client";

import { useEffect } from "react";

const PREVIEW_COMMENT_COUNT = 3;

export function TimelineCommentsEnhancer() {
  useEffect(() => {
    let queued = false;

    function enhanceTimelineComments() {
      const articles = Array.from(document.querySelectorAll("article"));

      for (const article of articles) {
        const commentsSection = Array.from(article.children).find((child) =>
          child.className.includes("border-t") && child.className.includes("pt-4")
        ) as HTMLElement | undefined;

        if (!commentsSection) continue;

        const actionRow = Array.from(article.children).find((child) =>
          child.className.includes("items-center") && child.className.includes("gap-3")
        ) as HTMLElement | undefined;

        if (!actionRow) continue;

        const commentsTrigger = Array.from(actionRow.children).find((child) =>
          child.textContent?.trim().toLowerCase().endsWith("comments")
        ) as HTMLElement | undefined;

        if (!commentsTrigger) continue;

        if (!article.dataset.commentsEnhanced) {
          article.dataset.commentsEnhanced = "true";
          article.dataset.commentsOpen = "false";
          article.dataset.commentsViewAll = "false";
        }

        if (!commentsTrigger.dataset.commentsTrigger) {
          commentsTrigger.dataset.commentsTrigger = "true";
          commentsTrigger.setAttribute("role", "button");
          commentsTrigger.setAttribute("tabindex", "0");
          commentsTrigger.setAttribute("aria-expanded", "false");
          commentsTrigger.classList.add(
            "cursor-pointer",
            "rounded-lg",
            "px-3",
            "py-2",
            "font-medium",
            "hover:bg-gray-50"
          );
        }

        applyCommentVisibility(article, commentsSection, commentsTrigger);
      }
    }

    function queueEnhancement() {
      if (queued) return;
      queued = true;
      window.requestAnimationFrame(() => {
        queued = false;
        enhanceTimelineComments();
      });
    }

    function handleClick(event: MouseEvent) {
      const target = event.target as HTMLElement;
      const trigger = target.closest<HTMLElement>("[data-comments-trigger='true']");

      if (trigger) {
        const article = trigger.closest<HTMLElement>("article");
        if (!article) return;

        article.dataset.commentsOpen =
          article.dataset.commentsOpen === "true" ? "false" : "true";
        article.dataset.commentsViewAll = "false";

        const commentsSection = Array.from(article.children).find((child) =>
          child.className.includes("border-t") && child.className.includes("pt-4")
        ) as HTMLElement | undefined;

        if (commentsSection) {
          applyCommentVisibility(article, commentsSection, trigger);
        }
        return;
      }

      const viewAllButton = target.closest<HTMLElement>("[data-comments-view-all='true']");
      if (viewAllButton) {
        const article = viewAllButton.closest<HTMLElement>("article");
        if (!article) return;

        article.dataset.commentsViewAll = "true";
        const commentsSection = viewAllButton.closest<HTMLElement>("[data-comments-section='true']");
        const commentsTrigger = article.querySelector<HTMLElement>("[data-comments-trigger='true']");

        if (commentsSection && commentsTrigger) {
          applyCommentVisibility(article, commentsSection, commentsTrigger);
        }
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Enter" && event.key !== " ") return;

      const target = event.target as HTMLElement;
      if (target.matches("[data-comments-trigger='true']")) {
        event.preventDefault();
        target.click();
      }
    }

    enhanceTimelineComments();

    const observer = new MutationObserver(queueEnhancement);
    observer.observe(document.body, { childList: true, subtree: true });

    document.addEventListener("click", handleClick);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      observer.disconnect();
      document.removeEventListener("click", handleClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return null;
}

function applyCommentVisibility(
  article: HTMLElement,
  commentsSection: HTMLElement,
  commentsTrigger: HTMLElement
) {
  const isOpen = article.dataset.commentsOpen === "true";
  const isViewingAll = article.dataset.commentsViewAll === "true";

  commentsSection.dataset.commentsSection = "true";
  commentsSection.style.display = isOpen ? "flex" : "none";
  commentsTrigger.setAttribute("aria-expanded", String(isOpen));

  if (!isOpen) return;

  const form = commentsSection.querySelector("form");
  const commentItems = Array.from(commentsSection.children).filter(
    (child) => child !== form && !(child as HTMLElement).dataset.commentsViewAll
  ) as HTMLElement[];

  commentItems.forEach((comment, index) => {
    comment.style.display = isViewingAll || index < PREVIEW_COMMENT_COUNT ? "flex" : "none";
  });

  let viewAllButton = commentsSection.querySelector<HTMLButtonElement>(
    "[data-comments-view-all='true']"
  );

  if (commentItems.length > PREVIEW_COMMENT_COUNT && !isViewingAll) {
    if (!viewAllButton) {
      viewAllButton = document.createElement("button");
      viewAllButton.type = "button";
      viewAllButton.dataset.commentsViewAll = "true";
      viewAllButton.className =
        "w-fit rounded-lg border px-3 py-2 text-sm font-medium hover:bg-gray-50";
      viewAllButton.textContent = `View all ${commentItems.length} comments`;
      commentsSection.insertBefore(viewAllButton, form);
    } else {
      viewAllButton.textContent = `View all ${commentItems.length} comments`;
      viewAllButton.style.display = "block";
    }
  } else if (viewAllButton) {
    viewAllButton.style.display = "none";
  }

  if (isViewingAll) {
    commentsSection.style.maxHeight = "28rem";
    commentsSection.style.overflowY = "auto";
    commentsSection.style.paddingRight = "0.25rem";
  } else {
    commentsSection.style.maxHeight = "none";
    commentsSection.style.overflowY = "visible";
    commentsSection.style.paddingRight = "0";
  }
}
