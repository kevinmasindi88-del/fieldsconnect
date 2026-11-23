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
