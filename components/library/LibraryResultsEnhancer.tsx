"use client";

import { useEffect } from "react";

export function LibraryResultsEnhancer() {
  useEffect(() => {
    let queued = false;

    function enhanceResults() {
      const headings = Array.from(document.querySelectorAll<HTMLHeadingElement>("h2"));
      const heading = headings.find((item) => item.textContent?.trim() === "Published library");
      const section = heading?.closest<HTMLElement>("section");

      if (!section || section.dataset.resultsEnhanced === "true") return;

      const list = section.querySelector<HTMLElement>(":scope > div");
      if (!list) return;

      const cards = Array.from(list.querySelectorAll<HTMLElement>(":scope > article"));
      if (cards.length === 0) return;

      section.dataset.resultsEnhanced = "true";

      const controls = document.createElement("div");
      controls.className = "flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-gray-50 p-4";

      const summary = document.createElement("p");
      summary.className = "text-sm text-gray-700";
      summary.textContent = `${cards.length} resource${cards.length === 1 ? "" : "s"} found`;

      const button = document.createElement("button");
      button.type = "button";
      button.className = "rounded-lg bg-black px-4 py-2 text-sm font-medium text-white";
      button.textContent = `View ${cards.length === 1 ? "resource" : "resources"}`;
      button.setAttribute("aria-expanded", "false");

      list.hidden = true;

      button.addEventListener("click", () => {
        const willOpen = list.hidden;
        list.hidden = !willOpen;
        button.textContent = willOpen ? "Hide resources" : `View ${cards.length === 1 ? "resource" : "resources"}`;
        button.setAttribute("aria-expanded", String(willOpen));

        if (willOpen) {
          window.requestAnimationFrame(() => {
            list.scrollIntoView({ behavior: "smooth", block: "start" });
          });
        }
      });

      controls.append(summary, button);
      heading.insertAdjacentElement("afterend", controls);
    }

    function queueEnhancement() {
      if (queued) return;
      queued = true;
      window.requestAnimationFrame(() => {
        queued = false;
        enhanceResults();
      });
    }

    enhanceResults();

    const observer = new MutationObserver(queueEnhancement);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, []);

  return null;
}
