"use client";

import { useEffect } from "react";
import { LibraryWorkflow } from "@/components/library/LibraryWorkflow";

export default function LibraryPage() {
  useEffect(() => {
    function renameLibrarySection() {
      const heading = Array.from(document.querySelectorAll<HTMLHeadingElement>("h2")).find(
        (item) => item.textContent?.trim() === "Published library"
      );

      if (heading) heading.textContent = "Public Library";
    }

    renameLibrarySection();
    const observer = new MutationObserver(renameLibrarySection);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, []);

  return (
    <main className="min-h-screen">
      <LibraryWorkflow />
    </main>
  );
}
