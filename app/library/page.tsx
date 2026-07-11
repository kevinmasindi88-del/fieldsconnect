"use client";

import { useEffect } from "react";
import { LibraryWorkflow } from "@/components/library/LibraryWorkflow";

export default function LibraryPage() {
  useEffect(() => {
    function enhancePublicLibrary() {
      const heading = Array.from(document.querySelectorAll<HTMLHeadingElement>("h2")).find(
        (item) => ["Published library", "Public Library"].includes(item.textContent?.trim() ?? "")
      );

      if (!heading) return;

      if (heading.textContent?.trim() !== "Public Library") {
        heading.textContent = "Public Library";
      }

      const section = heading.closest<HTMLElement>("section");
      if (!section) return;

      const searchInput = Array.from(section.querySelectorAll<HTMLInputElement>('input[type="text"], input:not([type])')).find(
        (input) => input.placeholder?.toLowerCase().includes("search sop")
      );

      if (searchInput && !section.querySelector("[data-public-library-search-button='true']")) {
        const searchLabel = searchInput.closest("label");
        const button = document.createElement("button");
        button.type = "button";
        button.dataset.publicLibrarySearchButton = "true";
        button.className = "rounded-lg bg-black px-4 py-2 text-sm font-medium text-white";
        button.textContent = "Search";

        button.addEventListener("click", () => {
          searchInput.dispatchEvent(new Event("input", { bubbles: true }));
          searchInput.dispatchEvent(new Event("change", { bubbles: true }));

          window.requestAnimationFrame(() => {
            const viewButton = Array.from(section.querySelectorAll<HTMLButtonElement>("button")).find((candidate) =>
              candidate.textContent?.trim().startsWith("View resource list")
            );

            if (viewButton && !viewButton.disabled) {
              viewButton.click();
            }

            section.scrollIntoView({ behavior: "smooth", block: "start" });
          });
        });

        searchInput.addEventListener("keydown", (event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            button.click();
          }
        });

        if (searchLabel) {
          const row = document.createElement("div");
          row.className = "flex flex-col gap-2 sm:flex-row sm:items-end";
          searchLabel.parentElement?.insertBefore(row, searchLabel);
          row.append(searchLabel, button);
          searchLabel.classList.add("flex-1");
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
        const lastOption = Array.from(recencySelect.options).find((option) =>
          ["Last 90 days", "90 days or longer"].includes(option.textContent?.trim() ?? "")
        );

        if (lastOption && lastOption.textContent?.trim() !== "90 days or longer") {
          lastOption.textContent = "90 days or longer";
        }
      }
    }

    enhancePublicLibrary();
    const observer = new MutationObserver(enhancePublicLibrary);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, []);

  return (
    <main className="min-h-screen">
      <LibraryWorkflow />
    </main>
  );
}
