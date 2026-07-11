"use client";

import { useEffect } from "react";

export function ConnectionsHeadingEnhancer() {
  useEffect(() => {
    function updateConnectionsHeading() {
      const headings = Array.from(document.querySelectorAll("h2"));
      const heading = headings.find((item) =>
        ["Accepted connections", "Connections"].some((label) =>
          item.textContent?.trim().startsWith(label)
        )
      );

      if (!heading) return;

      const section = heading.closest("section");
      const connectionCount = section?.querySelectorAll("article").length ?? 0;
      heading.textContent = `Connections (${connectionCount})`;
    }

    updateConnectionsHeading();

    const observer = new MutationObserver(updateConnectionsHeading);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, []);

  return null;
}
