"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/browser";
import { ReportMenu } from "@/components/moderation/ReportMenu";

import {
  getActionErrorMessage,
  getMessageAlertClass,
} from "@/lib/action-errors";

const LIBRARY_TITLE_MIN_LENGTH = 3;
const LIBRARY_TITLE_MAX_LENGTH = 200;

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

  resource_type: "uploaded_file" | "external_link";

  file_name: string | null;
  file_size_bytes: number | null;
  mime_type: string | null;
  storage_bucket: string | null;
  storage_path: string | null;

  external_url: string | null;
  source_title: string | null;
  source_publisher: string | null;
  source_accessed_on: string | null;
  link_access_confirmed: boolean;

  visibility: "public" | "connections";
  is_published: boolean;
  created_at: string;
};

type RecencyFilter = "all" | "7" | "30" | "90";

export function LibraryWorkflow() {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [documents, setDocuments] = useState<LibraryDocument[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"public" | "connections">("connections");
  const [isPublished, setIsPublished] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [resourceType, setResourceType] =
    useState<"uploaded_file" | "external_link">(
      "uploaded_file"
    );

  const [externalUrl, setExternalUrl] = useState("");
  const [sourceTitle, setSourceTitle] = useState("");
  const [sourcePublisher, setSourcePublisher] =
    useState("");

  const [
    noAccessRestrictionBypassConfirmed,
    setNoAccessRestrictionBypassConfirmed,
  ] = useState(false);

  const [rightsBasis, setRightsBasis] = useState("");
  const [sourceAttribution, setSourceAttribution] = useState("");

  const [
    licencePermissionDetails,
    setLicencePermissionDetails,
  ] = useState("");

  const [
    statutoryExceptionExplanation,
    setStatutoryExceptionExplanation,
  ] = useState("");

  const [privacyConfirmed, setPrivacyConfirmed] =
    useState(false);

  const [securityConfirmed, setSecurityConfirmed] =
    useState(false);

  const [accuracyConfirmed, setAccuracyConfirmed] =
    useState(false);
  const [librarySearch, setLibrarySearch] = useState("");
  const [fieldFilter, setFieldFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [recencyFilter, setRecencyFilter] = useState<RecencyFilter>("all");
  const [isResultListOpen, setIsResultListOpen] = useState(false);
  const [selectedResultId, setSelectedResultId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isWorking, setIsWorking] = useState(false);

  const profileById = useMemo(() => {
    return new Map(profiles.map((profile) => [profile.id, profile]));
  }, [profiles]);

  const ownDocuments = documents.filter((document) => document.owner_id === currentUserId);
  const publishedDocuments = documents.filter(
    (document) => document.owner_id !== currentUserId && document.is_published && document.visibility === "public"
  );

  const availableFields = useMemo(() => {
    const fields = new Set<string>();

    for (const document of publishedDocuments) {
      const field = profileById.get(document.owner_id)?.field;
      if (field) fields.add(field);
    }

    return Array.from(fields).sort((left, right) => left.localeCompare(right));
  }, [profileById, publishedDocuments]);

  const availableRoles = useMemo(() => {
    const roles = new Set<string>();

    for (const document of publishedDocuments) {
      const role = profileById.get(document.owner_id)?.role_type;
      if (role) roles.add(role);
    }

    return Array.from(roles).sort((left, right) => left.localeCompare(right));
  }, [profileById, publishedDocuments]);

  const filteredPublishedDocuments = useMemo(() => {
    const searchTerm = librarySearch.trim().toLowerCase();
    const now = Date.now();

    return publishedDocuments.filter((document) => {
      const owner = profileById.get(document.owner_id);
      const searchableText = [
        document.title,
        document.description,
        document.file_name,
        owner?.display_name,
        owner?.field,
        owner?.role_type,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch = !searchTerm || searchableText.includes(searchTerm);
      const matchesField = fieldFilter === "all" || owner?.field === fieldFilter;
      const matchesRole = roleFilter === "all" || owner?.role_type === roleFilter;
      const matchesRecency =
        recencyFilter === "all" || now - new Date(document.created_at).getTime() <= Number(recencyFilter) * 24 * 60 * 60 * 1000;

      return matchesSearch && matchesField && matchesRole && matchesRecency;
    });
  }, [fieldFilter, librarySearch, profileById, publishedDocuments, recencyFilter, roleFilter]);

  const selectedResult =
    filteredPublishedDocuments.find((document) => document.id === selectedResultId) ?? filteredPublishedDocuments[0] ?? null;

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
            "id, owner_id, title, description, resource_type, file_name, file_size_bytes, mime_type, storage_bucket, storage_path, external_url, source_title, source_publisher, source_accessed_on, link_access_confirmed, visibility, is_published, created_at"
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

  useEffect(() => {
    if (!isSupabaseConfigured()) return;

    const supabase = getSupabaseBrowserClient();

    const channel = supabase
      .channel("library-resource-events")
      .on(
        "broadcast",
        {
          event: "resource-removed",
        },
        ({ payload }) => {
          const resourceId =
            typeof payload?.resourceId === "string"
              ? payload.resourceId
              : null;

          if (!resourceId) return;

          setDocuments((currentDocuments) =>
            currentDocuments.filter(
              (document) => document.id !== resourceId
            )
          );

          setSelectedResultId((currentId) =>
            currentId === resourceId ? null : currentId
          );
        }
      )
      .on(
        "broadcast",
        {
          event: "resource-visibility-changed",
        },
        () => {
          void loadData();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    setSelectedResultId(null);
  }, [fieldFilter, librarySearch, recencyFilter, roleFilter]);

  async function uploadDocument(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (
      !currentUserId ||
      !title.trim() ||
      !isSupabaseConfigured()
    ) {
      return;
    }

    if (
      resourceType === "uploaded_file" &&
      !selectedFile
    ) {
      setMessage("Select a file to upload.");
      return;
    }

    if (resourceType === "external_link") {
      const cleanedUrl = externalUrl.trim();

      if (!cleanedUrl.startsWith("https://")) {
        setMessage(
          "Enter a secure HTTPS link."
        );
        return;
      }

      if (sourceTitle.trim().length < 3) {
        setMessage(
          "Enter the original page or resource title."
        );
        return;
      }

      if (sourcePublisher.trim().length < 2) {
        setMessage(
          "Enter the author, organisation or publisher."
        );
        return;
      }

      if (!noAccessRestrictionBypassConfirmed) {
        setMessage(
          "Confirm that the link does not bypass a login, paywall or technical restriction."
        );
        return;
      }

      if (!privacyConfirmed || !accuracyConfirmed) {
        setMessage(
          "Complete all required online-resource declarations."
        );
        return;
      }

      setIsWorking(true);
      setMessage(null);

      try {
        const supabase = getSupabaseBrowserClient();

        const { error } = await supabase.rpc(
          "create_library_external_link",
          {
            resource_title: title.trim(),
            resource_description:
              description.trim() || null,
            resource_external_url: cleanedUrl,
            resource_source_title:
              sourceTitle.trim(),
            resource_source_publisher:
              sourcePublisher.trim(),
            resource_visibility: visibility,
            publish_now: isPublished,
            no_access_restriction_bypass_confirmed:
              noAccessRestrictionBypassConfirmed,
            privacy_confirmed: privacyConfirmed,
            accuracy_confirmed: accuracyConfirmed,
          }
        );

        if (error) throw error;

        setTitle("");
        setDescription("");
        setVisibility("connections");
        setIsPublished(false);

        setExternalUrl("");
        setSourceTitle("");
        setSourcePublisher("");

        setNoAccessRestrictionBypassConfirmed(false);
        setPrivacyConfirmed(false);
        setAccuracyConfirmed(false);

        setMessage("Online resource shared.");
        await loadData();
      } catch (error) {
        setMessage(
          getActionErrorMessage(
            error,
            "share online resource"
          )
        );
      } finally {
        setIsWorking(false);
      }

      return;
    }

    if (!selectedFile) {
      setMessage("Select a file to upload.");
      return;
    }

    if (selectedFile.size > MAX_FILE_SIZE_BYTES) {
      setMessage("File is too large. Maximum file size is 8 MB.");
      return;
    }

    if (!rightsBasis) {
      setMessage(
        "Select the legal basis for sharing this resource."
      );
      return;
    }

    if (
      rightsBasis !== "original_owner" &&
      sourceAttribution.trim().length < 3
    ) {
      setMessage(
        "Provide the source and attribution for this resource."
      );
      return;
    }

    if (
      [
        "written_permission",
        "open_licence",
      ].includes(rightsBasis) &&
      licencePermissionDetails.trim().length < 3
    ) {
      setMessage(
        "Provide the applicable permission or licence details."
      );
      return;
    }

    if (
      rightsBasis === "statutory_exception" &&
      statutoryExceptionExplanation.trim().length < 10
    ) {
      setMessage(
        "Explain the legal exception relied upon."
      );
      return;
    }

    if (
      !privacyConfirmed ||
      !securityConfirmed ||
      !accuracyConfirmed
    ) {
      setMessage(
        "Complete all required uploader declarations."
      );
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

      const { error: insertError } = await supabase.rpc(
        "create_library_document_with_declaration",
        {
          document_title: title.trim(),
          document_description:
            description.trim() || null,
          original_file_name: selectedFile.name,
          document_file_size_bytes: selectedFile.size,
          document_mime_type:
            selectedFile.type ||
            "application/octet-stream",
          document_storage_bucket: STORAGE_BUCKET,
          document_storage_path: storagePath,
          document_visibility: visibility,
          publish_now: isPublished,

          declared_rights_basis: rightsBasis,
          declared_source_attribution:
            sourceAttribution.trim() || null,
          declared_licence_permission_details:
            licencePermissionDetails.trim() || null,
          declared_statutory_exception_explanation:
            statutoryExceptionExplanation.trim() || null,

          declared_privacy_confirmed:
            privacyConfirmed,
          declared_security_confirmed:
            securityConfirmed,
          declared_accuracy_confirmed:
            accuracyConfirmed,
        }
      );

      if (insertError) {
        await supabase.storage.from(STORAGE_BUCKET).remove([storagePath]);
        throw insertError;
      }

      setTitle("");
      setDescription("");
      setVisibility("connections");
      setIsPublished(false);
      setSelectedFile(null);

      setRightsBasis("");
      setSourceAttribution("");
      setLicencePermissionDetails("");
      setStatutoryExceptionExplanation("");

      setPrivacyConfirmed(false);
      setSecurityConfirmed(false);
      setAccuracyConfirmed(false);

      setMessage(
        rightsBasis === "statutory_exception"
          ? "Document uploaded for review."
          : "Document uploaded."
      );
      await loadData();
    } catch (error) {
      setMessage(getActionErrorMessage(error, "upload document"));
    } finally {
      setIsWorking(false);
    }
  }

  async function broadcastLibraryVisibilityChanged(
    resourceId: string
  ) {
    const supabase = getSupabaseBrowserClient();

    const channel = supabase.channel(
      "library-resource-events"
    );

    await new Promise<void>((resolve) => {
      let completed = false;

      const finish = () => {
        if (completed) return;

        completed = true;
        void supabase.removeChannel(channel);
        resolve();
      };

      const timeoutId = window.setTimeout(finish, 4000);

      channel.subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          try {
            await channel.send({
              type: "broadcast",
              event: "resource-visibility-changed",
              payload: {
                resourceId,
              },
            });
          } finally {
            window.clearTimeout(timeoutId);
            finish();
          }
        }

        if (
          status === "CHANNEL_ERROR" ||
          status === "TIMED_OUT" ||
          status === "CLOSED"
        ) {
          window.clearTimeout(timeoutId);
          finish();
        }
      });
    });
  }

  async function broadcastLibraryResourceRemoved(
    resourceId: string
  ) {
    const supabase = getSupabaseBrowserClient();

    const channel = supabase.channel(
      "library-resource-events"
    );

    await new Promise<void>((resolve) => {
      let completed = false;

      const finish = () => {
        if (completed) return;

        completed = true;
        void supabase.removeChannel(channel);
        resolve();
      };

      const timeoutId = window.setTimeout(finish, 4000);

      channel.subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          try {
            await channel.send({
              type: "broadcast",
              event: "resource-removed",
              payload: {
                resourceId,
              },
            });
          } finally {
            window.clearTimeout(timeoutId);
            finish();
          }
        }

        if (
          status === "CHANNEL_ERROR" ||
          status === "TIMED_OUT" ||
          status === "CLOSED"
        ) {
          window.clearTimeout(timeoutId);
          finish();
        }
      });
    });
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

      await broadcastLibraryVisibilityChanged(document.id);

      setMessage(
        document.is_published
          ? "Document unpublished."
          : "Document published."
      );

      await loadData();
    } catch (error) {
      setMessage(getActionErrorMessage(error, "update document"));
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

      await broadcastLibraryVisibilityChanged(document.id);

      setMessage("Document visibility updated.");
      await loadData();
    } catch (error) {
      setMessage(getActionErrorMessage(error, "update document visibility"));
    } finally {
      setIsWorking(false);
    }
  }

  async function openDocument(document: LibraryDocument) {
    setIsWorking(true);
    setMessage(null);

    try {
      if (document.resource_type === "external_link") {
        if (!document.external_url) {
          throw new Error(
            "This online resource does not have a valid link."
          );
        }

        window.open(
          document.external_url,
          "_blank",
          "noopener,noreferrer"
        );

        return;
      }

      if (
        !document.storage_bucket ||
        !document.storage_path
      ) {
        throw new Error(
          "This uploaded file does not have a valid storage location."
        );
      }

      const supabase = getSupabaseBrowserClient();

      const { data, error } = await supabase.storage
        .from(document.storage_bucket)
        .createSignedUrl(document.storage_path, 60);

      if (error) throw error;

      if (data?.signedUrl) {
        window.open(
          data.signedUrl,
          "_blank",
          "noopener,noreferrer"
        );
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to open resource."
      );
    } finally {
      setIsWorking(false);
    }
  }

  async function deleteDocument(document: LibraryDocument) {
    const shouldDelete = window.confirm(`Delete "${document.title}" from the library?`);

    if (!shouldDelete) return;

    setIsWorking(true);
    setMessage(null);

    try {
      const supabase = getSupabaseBrowserClient();

      const { data: deletionData, error: deleteError } =
        await supabase.rpc(
          "soft_delete_own_library_document",
          {
            target_document_id: document.id,
          }
        );

      if (deleteError) throw deleteError;

      const deletedResource = deletionData?.[0];

      if (
        deletedResource?.resource_type === "uploaded_file" &&
        deletedResource.storage_bucket &&
        deletedResource.storage_path
      ) {
        const { error: storageError } =
          await supabase.storage
            .from(deletedResource.storage_bucket)
            .remove([deletedResource.storage_path]);

        if (storageError) {
          console.error(
            "Library metadata was deleted, but the Storage object could not be removed.",
            storageError
          );
        }
      }

      await broadcastLibraryResourceRemoved(document.id);

      setMessage("Document deleted.");
      await loadData();
    } catch (error) {
      setMessage(getActionErrorMessage(error, "delete document"));
    } finally {
      setIsWorking(false);
    }
  }

  function clearLibraryFilters() {
    setLibrarySearch("");
    setFieldFilter("all");
    setRoleFilter("all");
    setRecencyFilter("all");
    setSelectedResultId(null);
    setIsResultListOpen(false);
  }

  function selectLibraryResult(documentId: string) {
    setSelectedResultId(documentId);
    setIsResultListOpen(true);
  }

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:gap-8 sm:px-6 sm:py-8">
      {message && <p className={getMessageAlertClass(message)}>{message}</p>}

      <form onSubmit={uploadDocument} className="flex flex-col gap-4 rounded-xl border bg-white p-4">
        <h2 className="text-xl font-semibold">Add Library resource</h2>

        <label className="flex flex-col gap-2 text-sm font-medium">
          Title
          <input
            className="rounded-lg border px-3 py-2"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Example: CV template, bursary guide, study notes"
            minLength={LIBRARY_TITLE_MIN_LENGTH}
            maxLength={LIBRARY_TITLE_MAX_LENGTH}
            required
          />
          <span className="text-right text-xs font-normal text-gray-500">
            {title.length}/{LIBRARY_TITLE_MAX_LENGTH}
          </span>
        </label>

        <label className="flex flex-col gap-2 text-sm font-medium">
          Description
          <textarea
            className="min-h-24 rounded-lg border px-3 py-2"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Briefly describe what this resource is for."
          />
        </label>
        <fieldset className="grid gap-3">
          <legend className="text-sm font-medium">
            Resource type
          </legend>

          <div className="flex flex-wrap gap-3">
            <label className="flex items-center gap-2 rounded-xl border px-4 py-3 text-sm">
              <input
                checked={resourceType === "uploaded_file"}
                name="resourceType"
                onChange={() =>
                  setResourceType("uploaded_file")
                }
                type="radio"
              />

              Upload a file
            </label>

            <label className="flex items-center gap-2 rounded-xl border px-4 py-3 text-sm">
              <input
                checked={resourceType === "external_link"}
                name="resourceType"
                onChange={() =>
                  setResourceType("external_link")
                }
                type="radio"
              />

              Share an online link
            </label>
          </div>
        </fieldset>

        {resourceType === "uploaded_file" ? (
          <>
            <label className="flex flex-col gap-2 text-sm font-medium">
              File

              <input
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
                className="rounded-lg border px-3 py-2"
                onChange={(event) =>
                  setSelectedFile(
                    event.target.files?.[0] ?? null
                  )
                }
                required
                type="file"
              />

              <span className="text-xs text-gray-500">
                Maximum size: 8 MB.
              </span>
            </label>

            <section className="grid gap-4 rounded-xl border bg-gray-50 p-4">
              <div>
                <h3 className="font-semibold">
                  Rights and uploader declaration
                </h3>

                <p className="mt-1 text-sm leading-6 text-gray-600">
                  Confirm why you are legally permitted
                  to upload and share this file.
                </p>
              </div>

              <label className="flex flex-col gap-2 text-sm font-medium">
                Rights basis

                <select
                  className="rounded-lg border bg-white px-3 py-2"
                  onChange={(event) =>
                    setRightsBasis(event.target.value)
                  }
                  required
                  value={rightsBasis}
                >
                  <option value="">
                    Select a rights basis
                  </option>

                  <option value="original_owner">
                    I created and own this material
                  </option>

                  <option value="written_permission">
                    I have written permission
                  </option>

                  <option value="public_domain">
                    The material is in the public domain
                  </option>

                  <option value="open_licence">
                    The material uses an open licence
                  </option>

                  <option value="statutory_exception">
                    I rely on a lawful statutory exception
                  </option>
                </select>
              </label>

              {rightsBasis &&
                rightsBasis !== "original_owner" && (
                  <label className="flex flex-col gap-2 text-sm font-medium">
                    Source and attribution

                    <textarea
                      className="min-h-20 rounded-lg border bg-white px-3 py-2 font-normal"
                      maxLength={2000}
                      onChange={(event) =>
                        setSourceAttribution(
                          event.target.value
                        )
                      }
                      placeholder="Identify the creator, source and relevant publication details."
                      required
                      value={sourceAttribution}
                    />
                  </label>
                )}

              {[
                "written_permission",
                "open_licence",
              ].includes(rightsBasis) && (
                <label className="flex flex-col gap-2 text-sm font-medium">
                  Permission or licence details

                  <textarea
                    className="min-h-20 rounded-lg border bg-white px-3 py-2 font-normal"
                    maxLength={4000}
                    onChange={(event) =>
                      setLicencePermissionDetails(
                        event.target.value
                      )
                    }
                    placeholder="Describe the permission or identify the licence and its conditions."
                    required
                    value={licencePermissionDetails}
                  />
                </label>
              )}

              {rightsBasis ===
                "statutory_exception" && (
                <label className="flex flex-col gap-2 text-sm font-medium">
                  Legal-exception explanation

                  <textarea
                    className="min-h-24 rounded-lg border bg-white px-3 py-2 font-normal"
                    maxLength={4000}
                    onChange={(event) =>
                      setStatutoryExceptionExplanation(
                        event.target.value
                      )
                    }
                    placeholder="Explain the limited legal exception relied upon."
                    required
                    value={
                      statutoryExceptionExplanation
                    }
                  />
                </label>
              )}

              <label className="flex items-start gap-3 text-sm leading-6">
                <input
                  checked={privacyConfirmed}
                  className="mt-1"
                  onChange={(event) =>
                    setPrivacyConfirmed(
                      event.target.checked
                    )
                  }
                  type="checkbox"
                />

                <span>
                  I confirm that this resource does not
                  contain personal, private or confidential
                  information that I am not authorised to
                  disclose.
                </span>
              </label>

              <label className="flex items-start gap-3 text-sm leading-6">
                <input
                  checked={securityConfirmed}
                  className="mt-1"
                  onChange={(event) =>
                    setSecurityConfirmed(
                      event.target.checked
                    )
                  }
                  type="checkbox"
                />

                <span>
                  I confirm that this file does not contain
                  malware, harmful code, stolen information
                  or material intended to compromise a
                  person or system.
                </span>
              </label>

              <label className="flex items-start gap-3 text-sm leading-6">
                <input
                  checked={accuracyConfirmed}
                  className="mt-1"
                  onChange={(event) =>
                    setAccuracyConfirmed(
                      event.target.checked
                    )
                  }
                  type="checkbox"
                />

                <span>
                  I confirm that this declaration is true
                  and complete to the best of my knowledge.
                </span>
              </label>
            </section>
          </>
        ) : (
          <section className="grid gap-4 rounded-xl border bg-gray-50 p-4">
            <div>
              <h3 className="font-semibold">
                Online resource details
              </h3>

              <p className="mt-1 text-sm leading-6 text-gray-600">
                Share the original webpage instead of
                uploading a copy found online.
              </p>
            </div>

            <label className="flex flex-col gap-2 text-sm font-medium">
              Secure resource link

              <input
                className="rounded-lg border bg-white px-3 py-2"
                maxLength={2048}
                onChange={(event) =>
                  setExternalUrl(event.target.value)
                }
                placeholder="https://example.org/resource"
                required
                type="url"
                value={externalUrl}
              />
            </label>

            <label className="flex flex-col gap-2 text-sm font-medium">
              Original page or resource title

              <input
                className="rounded-lg border bg-white px-3 py-2"
                maxLength={300}
                minLength={3}
                onChange={(event) =>
                  setSourceTitle(event.target.value)
                }
                required
                value={sourceTitle}
              />
            </label>

            <label className="flex flex-col gap-2 text-sm font-medium">
              Author, organisation or publisher

              <input
                className="rounded-lg border bg-white px-3 py-2"
                maxLength={300}
                minLength={2}
                onChange={(event) =>
                  setSourcePublisher(event.target.value)
                }
                required
                value={sourcePublisher}
              />
            </label>

            <label className="flex items-start gap-3 text-sm leading-6">
              <input
                checked={
                  noAccessRestrictionBypassConfirmed
                }
                className="mt-1"
                onChange={(event) =>
                  setNoAccessRestrictionBypassConfirmed(
                    event.target.checked
                  )
                }
                type="checkbox"
              />

              <span>
                I confirm that this link does not bypass
                a login, paywall or technical access
                restriction.
              </span>
            </label>

            <label className="flex items-start gap-3 text-sm leading-6">
              <input
                checked={privacyConfirmed}
                className="mt-1"
                onChange={(event) =>
                  setPrivacyConfirmed(
                    event.target.checked
                  )
                }
                type="checkbox"
              />

              <span>
                I confirm that sharing this link does not
                unlawfully disclose personal, private or
                confidential information.
              </span>
            </label>

            <label className="flex items-start gap-3 text-sm leading-6">
              <input
                checked={accuracyConfirmed}
                className="mt-1"
                onChange={(event) =>
                  setAccuracyConfirmed(
                    event.target.checked
                  )
                }
                type="checkbox"
              />

              <span>
                I confirm that the source information
                supplied is true and complete to the best
                of my knowledge.
              </span>
            </label>
          </section>
        )}

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
          Publish this resource now.
        </label>

        <button
          className="w-fit min-h-10 rounded-xl bg-gray-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:opacity-50"
          disabled={
            !title.trim() ||
            (resourceType === "uploaded_file"
              ? !selectedFile ||
                !rightsBasis ||
                !privacyConfirmed ||
                !securityConfirmed ||
                !accuracyConfirmed
              : !externalUrl.trim() ||
                !sourceTitle.trim() ||
                !sourcePublisher.trim() ||
                !noAccessRestrictionBypassConfirmed ||
                !privacyConfirmed ||
                !accuracyConfirmed) ||
            isWorking
          }
          type="submit"
        >
          {resourceType === "uploaded_file"
            ? "Upload file"
            : "Share online resource"}
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
                  isSelected={false}
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
                  <button
                    className="rounded-lg border border-red-300 px-3 py-2 text-sm font-medium text-red-700 disabled:opacity-50"
                    disabled={isWorking}
                    onClick={() => deleteDocument(document)}
                    type="button"
                  >
                    Delete
                  </button>
                </DocumentCard>
              ))
            )}
          </DocumentSection>

          <DocumentSection title="Published library">
            <div className="flex flex-col gap-4 rounded-xl border bg-white p-4">
              <div>
                <h3 className="font-semibold">Find resources</h3>
                <p className="mt-1 text-sm text-gray-600">
                  Search specific resources, then open the results list and select the item you want to view.
                </p>
              </div>

              <div className="grid gap-3 md:grid-cols-4">
                <label className="flex flex-col gap-2 text-sm font-medium md:col-span-2">
                  Search
                  <input
                    className="rounded-lg border px-3 py-2"
                    value={librarySearch}
                    onChange={(event) => setLibrarySearch(event.target.value)}
                    placeholder="Search SOP templates, bursary guide, CV..."
                  />
                </label>

                <label className="flex flex-col gap-2 text-sm font-medium">
                  Field
                  <select
                    className="rounded-lg border px-3 py-2"
                    value={fieldFilter}
                    onChange={(event) => setFieldFilter(event.target.value)}
                  >
                    <option value="all">All fields</option>
                    {availableFields.map((field) => (
                      <option key={field} value={field}>
                        {field}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex flex-col gap-2 text-sm font-medium">
                  Role type
                  <select
                    className="rounded-lg border px-3 py-2"
                    value={roleFilter}
                    onChange={(event) => setRoleFilter(event.target.value)}
                  >
                    <option value="all">All roles</option>
                    {availableRoles.map((role) => (
                      <option key={role} value={role}>
                        {formatRole(role)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex flex-col gap-2 text-sm font-medium">
                  Recency
                  <select
                    className="rounded-lg border px-3 py-2"
                    value={recencyFilter}
                    onChange={(event) => setRecencyFilter(event.target.value as RecencyFilter)}
                  >
                    <option value="all">Any time</option>
                    <option value="7">Last 7 days</option>
                    <option value="30">Last 30 days</option>
                    <option value="90">Last 90 days</option>
                  </select>
                </label>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  className="min-h-10 rounded-xl bg-gray-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:opacity-50"
                  disabled={filteredPublishedDocuments.length === 0}
                  onClick={() => setIsResultListOpen((current) => !current)}
                  type="button"
                >
                  {isResultListOpen ? "Hide resource list" : "View resource list"} ({filteredPublishedDocuments.length})
                </button>
                <button className="rounded-lg border px-4 py-2 text-sm font-medium" onClick={clearLibraryFilters} type="button">
                  Clear filters
                </button>
                <span className="text-sm text-gray-600">
                  {filteredPublishedDocuments.length} resource{filteredPublishedDocuments.length === 1 ? "" : "s"} found
                </span>
              </div>

              {isResultListOpen && (
                <div className="grid gap-2 rounded-xl border bg-gray-50 p-3">
                  {filteredPublishedDocuments.length === 0 ? (
                    <EmptyState text="No resources match this search yet." />
                  ) : (
                    filteredPublishedDocuments.map((document) => {
                      const owner = profileById.get(document.owner_id);
                      const isSelected = selectedResult?.id === document.id;

                      return (
                        <button
                          key={document.id}
                          className={`rounded-lg border bg-white p-3 text-left text-sm hover:border-black ${
                            isSelected ? "border-black" : "border-gray-200"
                          }`}
                          onClick={() => selectLibraryResult(document.id)}
                          type="button"
                        >
                          <span className="font-semibold">{document.title}</span>
                          <span className="mt-1 block text-xs text-gray-600">
                            {owner?.display_name ?? "Unknown profile"}
                            {owner?.field ? ` - ${owner.field}` : ""}
                            {owner?.role_type ? ` - ${formatRole(owner.role_type)}` : ""}
                          </span>
                          <span className="mt-1 block text-xs text-gray-500">
                            {document.file_name ?? "Uploaded file"} -{" "}
                            {document.file_size_bytes !== null
                              ? formatBytes(document.file_size_bytes)
                              : "Unknown size"}{" "}
                            - {formatDate(document.created_at)}
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              )}

              {selectedResult && (
                <div className="rounded-xl border border-black p-4">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Selected resource</p>
                  <DocumentCard
                    document={selectedResult}
                    owner={profileById.get(selectedResult.owner_id)}
                    isWorking={isWorking}
                    isSelected
                    onOpen={() => openDocument(selectedResult)}
                  >
                    <ReportMenu
                      targetType="library_document"
                      targetId={selectedResult.id}
                      reportedUserId={selectedResult.owner_id}
                      label="resource"
                      disabled={isWorking}
                    />
                  </DocumentCard>
                </div>
              )}
            </div>
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
  isSelected,
  onOpen,
  children,
}: {
  document: LibraryDocument;
  owner?: Profile;
  isWorking: boolean;
  isSelected: boolean;
  onOpen: () => void;
  children?: React.ReactNode;
}) {
  return (
    <article
      className={`flex min-w-0 flex-col justify-between gap-4 rounded-xl border bg-white p-4 md:flex-row md:items-center ${
        isSelected ? "border-black" : ""
      }`}
    >
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-semibold">{document.title}</h3>

          <span className="rounded-full border px-2 py-1 text-xs">
            {document.resource_type === "external_link"
              ? "Online link"
              : "File"}
          </span>

          <span className="rounded-full border px-2 py-1 text-xs">
            {document.is_published ? "Published" : "Unpublished"}
          </span>
          <span className="rounded-full border px-2 py-1 text-xs">
            {document.visibility === "public" ? "Public" : "Connections"}
          </span>
          {owner?.role_type && <span className="rounded-full border px-2 py-1 text-xs">{formatRole(owner.role_type)}</span>}
        </div>

        <p className="mt-2 text-sm text-gray-600">
          {owner?.display_name ?? "Unknown profile"}
          {owner?.field ? ` - ${owner.field}` : ""}
        </p>

        {document.description && <p className="mt-2 max-w-2xl text-sm text-gray-700">{document.description}</p>}

        {document.resource_type === "external_link" ? (
          <div className="mt-2 space-y-1 text-xs text-gray-500">
            <p>
              Online resource
              {document.source_publisher
                ? ` - ${document.source_publisher}`
                : ""}
            </p>

            {document.source_title && (
              <p>{document.source_title}</p>
            )}

            <p>
              Access recorded{" "}
              {document.source_accessed_on
                ? formatDate(document.source_accessed_on)
                : formatDate(document.created_at)}
            </p>
          </div>
        ) : (
          <p className="mt-2 text-xs text-gray-500">
            {document.file_name ?? "Uploaded file"} -{" "}
            {document.file_size_bytes !== null
              ? formatBytes(document.file_size_bytes)
              : "Unknown size"}{" "}
            - {formatDate(document.created_at)}
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          className="min-h-10 rounded-xl bg-gray-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:opacity-50"
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

function formatRole(role: string) {
  return role
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("/");
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}
