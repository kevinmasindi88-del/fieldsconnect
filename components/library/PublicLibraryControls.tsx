"use client";

import { useEffect } from "react";

export function PublicLibraryControls() {
  useEffect(() => {
    let observer: MutationObserver | null = null;
    let timeoutId: number | null = null;

    function enhanceOnce() {
      const heading = Array.from(document.querySelectorAll<HTMLHeadingElement>("h2")).find((item) =>
        ["Published library", "Public Library"].includes(item.textContent?.trim() ?? "")
      );

      const section = heading?.closest<HTMLElement>("section");
      if (!heading || !section) return false;

      if (heading.textContent?.trim() !== "Public Library") {
        heading.textContent = "Public Library";
      }

      const searchInput = Array.from(section.querySelectorAll<HTMLInputElement>("input")).find((input) =>
        input.placeholder?.toLowerCase().includes("search sop")
      );

      if (searchInput && !section.querySelector("[data-public-library-search-button='true']")) {
        const label = searchInput.closest("label");
        const button = document.createElement("button");
        button.type = "button";
        button.dataset.publicLibrarySearchButton = "true";
        button.className = "mt-2 w-fit rounded-lg bg-black px-4 py-2 text-sm font-medium text-white";
        button.textContent = "Search";

        const runSearch = () => {
          const viewButton = Array.from(section.querySelectorAll<HTMLButtonElement>("button")).find((candidate) =>
            candidate.textContent?.trim().startsWith("View resource list") ||
            candidate.textContent?.trim().startsWith("Hide resource list")
          );

          if (viewButton && !viewButton.disabled && viewButton.textContent?.trim().startsWith("View resource list")) {
            viewButton.click();
          }

          section.scrollIntoView({ behavior: "smooth", block: "start" });
        };

        button.addEventListener("click", runSearch);
        searchInput.addEventListener("keydown", (event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            runSearch();
          }
        });

        if (label) {
          label.appendChild(button);
        } else {
          searchInput.insertAdjacentElement("afterend", button);
        }
      }

      const recencySelect = Array.from(section.querySelectorAll<HTMLSelectElement>("select")).find((select) =>
        Array.from(select.options).some((option) =>
          ["Last 90 days", "90 days or longer"].includes(option.textContent?.trim() ?? "")
        )
      );

      if (recencySelect) {
        const option = Array.from(recencySelect.options).find((item) =>
          ["Last 90 days", "90 days or longer"].includes(item.textContent?.trim() ?? "")
        );
        if (option && option.textContent?.trim() !== "90 days or longer") {
          option.textContent = "90 days or longer";
        }
      }

      return true;
    }

    if (!enhanceOnce()) {
      observer = new MutationObserver(() => {
        if (enhanceOnce()) {
          observer?.disconnect();
          observer = null;
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });

      timeoutId = window.setTimeout(() => {
        observer?.disconnect();
        observer = null;
      }, 10000);
    }

    return () => {
      observer?.disconnect();
      if (timeoutId !== null) window.clearTimeout(timeoutId);
    };
  }, []);

  return null;
}
