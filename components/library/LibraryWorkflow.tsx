"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/browser";

const STORAGE_BUCKET = "library-documents";
const MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024;

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
  file_size_bytes: number;
  mime_type: string;
  storage_bucket: string;
  storage_path: string;
  visibility: "public" | "connections";
  is_published: boolean;
  created_at: string;
};

export function LibraryWorkflow() {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [documents, setDocuments] = useState<LibraryDocument[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"public" | "connections">("connections");
  const [isPublished, setIsPublished] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isWorking, setIsWorking] = useState(false);

  const profileById = useMemo(() => {
    return new Map(profiles.map((profile) => [profile.id, profile]));
  }, [profiles]);

  const ownDocuments = documents.filter((document) => document.owner_id === currentUserId);
  const networkDocuments = documents.filter((document) => document.owner_id !== currentUserId);

  async function loadData() {
    setMessage(null);

    if (!isSupabaseConfigured()) {
      setMessage("Supabase is not configured yet. Library uploads will work once environment variables are set.");
      setIsLoading(false);
      return;
    }

    try {
      const supabase = getSupabaseBrowserClient();
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

      if (sessionError) throw sessionError;

      const userId = sessionData.session?.user.id;

      if (!userId) {
        setMessage("Please log in before using the library.");
        setIsLoading(false);
        return;
      }

      setCurrentUserId(userId);

      const [
        { data: profileData, error: profileError },
        { data: documentData, error: documentError },
      ] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, display_name, role_type, field")
          .is("deleted_at", null),
        supabase
          .from("library_documents")
          .select(
            "id, owner_id, title, description, file_name, file_size_bytes, mime_type, storage_bucket, storage_path, visibility, is_published, created_at"
          )
          .is("deleted_at", null)
          .order("created_at", { ascending: false }),
      ]);

      if (profileError) throw profileError;
      if (documentError) throw documentError;

      setProfiles((profileData ?? []) as Profile[]);
      setDocuments((documentData ?? []) as LibraryDocument[]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load library.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  async function uploadDocument(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!currentUserId || !selectedFile || !title.trim() || !isSupabaseConfigured()) return;

    if (selectedFile.size > MAX_FILE_SIZE_BYTES) {
      setMessage("File is too large. Maximum file size is 8 MB.");
      return;
    }

    setIsWorking(true);
    setMessage(null);

    const supabase = getSupabaseBrowserClient();
    const safeFileName = selectedFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `${currentUserId}/${crypto.randomUUID()}-${safeFileName}`;

    try {
      const { error: uploadError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(storagePath, selectedFile, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { error: insertError } = await supabase.from("library_documents").insert({
        owner_id: currentUserId,
        title: title.trim(),
        description: description.trim() || null,
        file_name: selectedFile.name,
        file_size_bytes: selectedFile.size,
        mime_type: selectedFile.type || "application/octet-stream",
        storage_bucket: STORAGE_BUCKET,
        storage_path: storagePath,
        visibility,
        is_published: isPublished,
      });

      if (insertError) {
        await supabase.storage.from(STORAGE_BUCKET).remove([storagePath]);
        throw insertError;
      }

      setTitle("");
      setDescription("");
      setVisibility("connections");
      setIsPublished(false);
      setSelectedFile(null);
      setMessage("Document uploaded.");
      await loadData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to upload document.");
    } finally {
      setIsWorking(false);
    }
  }

  async function togglePublished(document: LibraryDocument) {
    setIsWorking(true);
    setMessage(null);

    try {
      const supabase = getSupabaseBrowserClient();

      const { error } = await supabase
        .from("library_documents")
        .update({ is_published: !document.is_published })
        .eq("id", document.id);

      if (error) throw error;

      setMessage(document.is_published ? "Document unpublished." : "Document published.");
      await loadData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update document.");
    } finally {
      setIsWorking(false);
    }
  }

  async function toggleVisibility(document: LibraryDocument) {
    setIsWorking(true);
    setMessage(null);

    try {
      const supabase = getSupabaseBrowserClient();
      const nextVisibility = document.visibility === "public" ? "connections" : "public";

      const { error } = await supabase
        .from("library_documents")
        .update({ visibility: nextVisibility })
        .eq("id", document.id);

      if (error) throw error;

      setMessage("Document visibility updated.");
      await loadData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update visibility.");
    } finally {
      setIsWorking(false);
    }
  }

  async function openDocument(document: LibraryDocument) {
    setIsWorking(true);
    setMessage(null);

    try {
      const supabase = getSupabaseBrowserClient();

      const { data, error } = await supabase.storage
        .from(document.storage_bucket)
        .createSignedUrl(document.storage_path, 60);

      if (error) throw error;

      if (data?.signedUrl) {
        window.open(data.signedUrl, "_blank", "noopener,noreferrer");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to open document.");
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-8 p-8">
      <div>
        <h1 className="text-3xl font-semibold">Library</h1>
        <p className="mt-2 text-sm text-gray-600">
          Upload and share documents with the network. Files are limited to 8 MB. Messaging attachments are out of scope.
        </p>
      </div>

      {message && <p className="rounded-lg border p-3 text-sm text-gray-700">{message}</p>}

      <form onSubmit={uploadDocument} className="flex flex-col gap-4 rounded-xl border p-4">
        <h2 className="text-xl font-semibold">Upload document</h2>

        <label className="flex flex-col gap-2 text-sm font-medium">
          Title
          <input
            className="rounded-lg border px-3 py-2"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Example: CV template, bursary guide, study notes"
            required
          />
        </label>

        <label className="flex flex-col gap-2 text-sm font-medium">
          Description
          <textarea
            className="min-h-24 rounded-lg border px-3 py-2"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Briefly describe what this document is for."
          />
        </label>

        <label className="flex flex-col gap-2 text-sm font-medium">
          File
          <input
            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
            className="rounded-lg border px-3 py-2"
            type="file"
            onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
            required
          />
          <span className="text-xs text-gray-500">Maximum size: 8 MB.</span>
        </label>

        <label className="flex flex-col gap-2 text-sm font-medium">
          Visibility
          <select
            className="w-fit rounded-lg border px-3 py-2"
            value={visibility}
            onChange={(event) => setVisibility(event.target.value as "public" | "connections")}
          >
            <option value="connections">Connections only</option>
            <option value="public">Public</option>
          </select>
        </label>

        <label className="flex gap-3 text-sm">
          <input
            type="checkbox"
            checked={isPublished}
            onChange={() => setIsPublished((current) => !current)}
          />
          Publish this document now.
        </label>

        <button
          className="w-fit rounded-lg bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          disabled={!title.trim() || !selectedFile || isWorking}
          type="submit"
        >
          Upload document
        </button>
      </form>

      {isLoading ? (
        <p className="text-sm text-gray-600">Loading library...</p>
      ) : (
        <>
          <DocumentSection title="My documents">
            {ownDocuments.length === 0 ? (
              <EmptyState text="You have not uploaded documents yet." />
            ) : (
              ownDocuments.map((document) => (
                <DocumentCard
                  key={document.id}
                  document={document}
                  owner={profileById.get(document.owner_id)}
                  isWorking={isWorking}
                  onOpen={() => openDocument(document)}
                >
                  <button
                    className="rounded-lg border px-3 py-2 text-sm font-medium disabled:opacity-50"
                    disabled={isWorking}
                    onClick={() => togglePublished(document)}
                    type="button"
                  >
                    {document.is_published ? "Unpublish" : "Publish"}
                  </button>
                  <button
                    className="rounded-lg border px-3 py-2 text-sm font-medium disabled:opacity-50"
                    disabled={isWorking}
                    onClick={() => toggleVisibility(document)}
                    type="button"
                  >
                    Make {document.visibility === "public" ? "connections only" : "public"}
                  </button>
                </DocumentCard>
              ))
            )}
          </DocumentSection>

          <DocumentSection title="Published library">
            {networkDocuments.length === 0 ? (
              <EmptyState text="No published documents found yet." />
            ) : (
              networkDocuments.map((document) => (
                <DocumentCard
                  key={document.id}
                  document={document}
                  owner={profileById.get(document.owner_id)}
                  isWorking={isWorking}
                  onOpen={() => openDocument(document)}
                />
              ))
            )}
          </DocumentSection>
        </>
      )}
    </section>
  );
}

function DocumentSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xl font-semibold">{title}</h2>
      <div className="grid gap-3">{children}</div>
    </section>
  );
}

function DocumentCard({
  document,
  owner,
  isWorking,
  onOpen,
  children,
}: {
  document: LibraryDocument;
  owner?: Profile;
  isWorking: boolean;
  onOpen: () => void;
  children?: React.ReactNode;
}) {
  return (
    <article className="flex flex-col justify-between gap-4 rounded-xl border p-4 md:flex-row md:items-center">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-semibold">{document.title}</h3>
          <span className="rounded-full border px-2 py-1 text-xs">
            {document.is_published ? "Published" : "Unpublished"}
          </span>
          <span className="rounded-full border px-2 py-1 text-xs">
            {document.visibility === "public" ? "Public" : "Connections"}
          </span>
        </div>

        <p className="mt-2 text-sm text-gray-600">
          {owner?.display_name ?? "Unknown profile"}
          {owner?.field ? ` - ${owner.field}` : ""}
        </p>

        {document.description && <p className="mt-2 max-w-2xl text-sm text-gray-700">{document.description}</p>}

        <p className="mt-2 text-xs text-gray-500">
          {document.file_name} - {formatBytes(document.file_size_bytes)}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          disabled={isWorking}
          onClick={onOpen}
          type="button"
        >
          Open
        </button>
        {children}
      </div>
    </article>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p className="rounded-xl border border-dashed p-4 text-sm text-gray-600">{text}</p>;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
