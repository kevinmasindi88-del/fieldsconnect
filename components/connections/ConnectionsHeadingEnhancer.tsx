"use client";

import { useEffect } from "react";

export function ConnectionsHeadingEnhancer() {
  useEffect(() => {
    function updateConnectionsHeading() {
      const headings = Array.from(document.querySelectorAll("h2"));
      const heading = headings.find((item) => {
        const text = item.textContent?.trim() ?? "";
        return text === "Accepted connections" || text.startsWith("Connections (");
      });

      if (!heading) return;

      const section = heading.closest("section");
      const connectionCount = section?.querySelectorAll("article").length ?? 0;
      const nextText = `Connections (${connectionCount})`;

      if (heading.textContent !== nextText) {
        heading.textContent = nextText;
      }
    }

    updateConnectionsHeading();

    const observer = new MutationObserver(updateConnectionsHeading);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, []);

  return null;
}
