"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/browser";

type Profile = {
  id: string;
  display_name: string;
  role_type: string;
  field: string | null;
};

type LibraryDocument = {
  id: string;
  owner_id: string;
  title: string;
  description: string | null;
  file_name: string;
  is_published: boolean;
  created_at: string;
};

type DiscoveryDocument = LibraryDocument & {
  ownerName: string;
  ownerRole: string;
  ownerField: string;
};

export function LibraryDiscoveryFilters() {
  const [documents, setDocuments] = useState<DiscoveryDocument[]>([]);
  const [search, setSearch] = useState("");
  const [field, setField] = useState("all");
  const [roleType, setRoleType] = useState("all");
  const [recency, setRecency] = useState("all");
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;

    async function loadDiscoveryData() {
      const supabase = getSupabaseBrowserClient();
      const [{ data: profileData }, { data: documentData }] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, display_name, role_type, field")
          .is("deleted_at", null),
        supabase
          .from("library_documents")
          .select("id, owner_id, title, description, file_name, is_published, created_at")
          .is("deleted_at", null)
          .eq("is_published", true),
      ]);

      const profiles = (profileData ?? []) as Profile[];
      const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
      const discoveryDocuments = ((documentData ?? []) as LibraryDocument[]).map((document) => {
        const owner = profileById.get(document.owner_id);
        return {
          ...document,
          ownerName: owner?.display_name ?? "Unknown profile",
          ownerRole: owner?.role_type ?? "",
          ownerField: owner?.field ?? "",
        };
      });

      setDocuments(discoveryDocuments);
      setIsReady(true);
    }

    void loadDiscoveryData();
  }, []);

  const fields = useMemo(
    () => Array.from(new Set(documents.map((document) => document.ownerField).filter(Boolean))).sort(),
    [documents]
  );

  const roles = useMemo(
    () => Array.from(new Set(documents.map((document) => document.ownerRole).filter(Boolean))).sort(),
    [documents]
  );

  const filteredDocuments = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const now = Date.now();

    return documents.filter((document) => {
      const matchesSearch =
        !normalizedSearch ||
        [
          document.title,
          document.description ?? "",
          document.file_name,
          document.ownerName,
          document.ownerField,
          document.ownerRole,
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalizedSearch);

      const matchesField = field === "all" || document.ownerField === field;
      const matchesRole = roleType === "all" || document.ownerRole === roleType;

      let matchesRecency = true;
      if (recency !== "all") {
        const ageInDays = (now - new Date(document.created_at).getTime()) / 86_400_000;
        matchesRecency = ageInDays <= Number(recency);
      }

      return matchesSearch && matchesField && matchesRole && matchesRecency;
    });
  }, [documents, field, recency, roleType, search]);

  useEffect(() => {
    if (!isReady) return;

    const visibleKeys = new Set(
      filteredDocuments.map((document) => `${document.title}\u0000${document.file_name}`)
    );

    function applyFilters() {
      const publishedHeading = Array.from(document.querySelectorAll("h2")).find(
        (heading) => heading.textContent?.trim() === "Published library"
      );
      const section = publishedHeading?.closest("section");
      if (!section) return;

      const cards = Array.from(section.querySelectorAll<HTMLElement>("article"));
      let visibleCount = 0;

      for (const card of cards) {
        const title = card.querySelector("h3")?.textContent?.trim() ?? "";
        const fileLine = Array.from(card.querySelectorAll("p")).find((paragraph) =>
          paragraph.className.includes("text-xs")
        )?.textContent ?? "";
        const matchingDocument = documents.find(
          (document) => document.title === title && fileLine.includes(document.file_name)
        );
        const shouldShow = matchingDocument
          ? visibleKeys.has(`${matchingDocument.title}\u0000${matchingDocument.file_name}`)
          : false;

        card.style.display = shouldShow ? "flex" : "none";
        if (shouldShow) visibleCount += 1;
      }

      let emptyState = section.querySelector<HTMLElement>("[data-library-filter-empty='true']");
      if (visibleCount === 0) {
        if (!emptyState) {
          emptyState = document.createElement("p");
          emptyState.dataset.libraryFilterEmpty = "true";
          emptyState.className = "rounded-xl border border-dashed p-4 text-sm text-gray-600";
          emptyState.textContent = "No published documents match your search and filters.";
          section.querySelector("div")?.appendChild(emptyState);
        }
        emptyState.style.display = "block";
      } else if (emptyState) {
        emptyState.style.display = "none";
      }
    }

    applyFilters();
    const observer = new MutationObserver(applyFilters);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, [documents, filteredDocuments, isReady]);

  function clearFilters() {
    setSearch("");
    setField("all");
    setRoleType("all");
    setRecency("all");
  }

  return (
    <section className="mx-auto mt-6 flex w-full max-w-5xl flex-col gap-4 rounded-xl border p-4">
      <div>
        <h2 className="text-xl font-semibold">Explore the public library</h2>
        <p className="mt-1 text-sm text-gray-600">
          Search across all published resources or narrow the library by field, role type, and recency.
        </p>
      </div>

      <label className="flex flex-col gap-2 text-sm font-medium">
        Search library
        <input
          className="rounded-lg border px-3 py-2"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search SOP templates, bursary guides, CV examples..."
          type="search"
        />
      </label>

      <div className="grid gap-3 md:grid-cols-3">
        <label className="flex flex-col gap-2 text-sm font-medium">
          Field
          <select className="rounded-lg border px-3 py-2" value={field} onChange={(event) => setField(event.target.value)}>
            <option value="all">All fields</option>
            {fields.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-2 text-sm font-medium">
          Role type
          <select className="rounded-lg border px-3 py-2" value={roleType} onChange={(event) => setRoleType(event.target.value)}>
            <option value="all">All role types</option>
            {roles.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-2 text-sm font-medium">
          Recency
          <select className="rounded-lg border px-3 py-2" value={recency} onChange={(event) => setRecency(event.target.value)}>
            <option value="all">Any time</option>
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="365">Last year</option>
          </select>
        </label>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-600">
          {filteredDocuments.length} {filteredDocuments.length === 1 ? "resource" : "resources"} found
        </p>
        <button className="rounded-lg border px-3 py-2 text-sm font-medium" onClick={clearFilters} type="button">
          Clear filters
        </button>
      </div>
    </section>
  );
}
