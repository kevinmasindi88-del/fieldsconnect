"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

type ReportTargetType =
  | "profile"
  | "post"
  | "comment"
  | "message"
  | "skill"
  | "library_document"
  | "profile_picture"
  | "mentorship";

type ReportMenuProps = {
  targetType: ReportTargetType;
  targetId: string;
  reportedUserId: string;
  label: string;
  menuAlign?: "left" | "right";
  constrainToMessagePanel?: boolean;
  disabled?: boolean;
};

const reasons = [
  "Harassment or bullying",
  "Spam or scam",
  "False or misleading content",
  "Inappropriate content",
  "Impersonation",
  "Privacy concern",
  "Other",
];

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }
  return "Unable to submit report.";
}

export function ReportMenu({
  targetType,
  targetId,
  reportedUserId,
  label,
  menuAlign = "right",
  constrainToMessagePanel = false,
  disabled = false,
}: ReportMenuProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [reason, setReason] = useState(reasons[0]);
  const [details, setDetails] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [submittedTicket, setSubmittedTicket] = useState<string | null>(null);
  const [isWorking, setIsWorking] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const [panelMenuPosition, setPanelMenuPosition] = useState<{
    left: number;
    top: number;
    width: number;
  } | null>(null);

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      const target = event.target as Node;
      if (
        !menuRef.current?.contains(target) &&
        !popupRef.current?.contains(target)
      ) {
        setMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  // The message bubble can be narrower than the report action popup.
  // Anchor it to the button, but keep the popup within the full conversation
  // panel instead of letting the bubble's width or scroll clipping crop it.
  useEffect(() => {
    if (!menuOpen || !constrainToMessagePanel) {
      setPanelMenuPosition(null);
      return;
    }

    function updateMenuPosition() {
      const trigger = buttonRef.current;
      if (!trigger) return;

      const panel = trigger.closest("[data-message-report-boundary]");
      const panelRect = panel?.getBoundingClientRect();
      const triggerRect = trigger.getBoundingClientRect();
      const padding = 8;
      const minX = Math.max(padding, (panelRect?.left ?? 0) + padding);
      const maxX = Math.min(window.innerWidth - padding, (panelRect?.right ?? window.innerWidth) - padding);
      const menuWidth = Math.min(176, Math.max(0, maxX - minX));
      const preferredX = menuAlign === "left" ? triggerRect.left : triggerRect.right - menuWidth;
      const left = Math.max(minX, Math.min(preferredX, maxX - menuWidth));

      const minY = Math.max(padding, (panelRect?.top ?? 0) + padding);
      const maxY = Math.min(window.innerHeight - padding, (panelRect?.bottom ?? window.innerHeight) - padding);
      const menuHeight = popupRef.current?.getBoundingClientRect().height ?? 54;
      const below = triggerRect.bottom + 6;
      const above = triggerRect.top - menuHeight - 6;
      const top = below + menuHeight <= maxY
        ? below
        : above >= minY
          ? above
          : Math.max(minY, Math.min(below, maxY - menuHeight));

      setPanelMenuPosition({ left, top, width: menuWidth });
    }

    updateMenuPosition();
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);

    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [menuOpen, constrainToMessagePanel, menuAlign]);

  async function submitReport(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isWorking || submittedTicket) return;

    setIsWorking(true);
    setMessage(null);

    try {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = targetType === "mentorship"
        ? await supabase.rpc("submit_mentorship_participant_report", {
            p_mentorship_id: targetId,
            p_reported_user_id: reportedUserId,
            p_reason: reason,
            p_details: details.trim() || null,
          })
        : await supabase.rpc("submit_moderation_report", {
            report_target_type: targetType,
            report_target_id: targetId,
            reported_user: reportedUserId,
            report_reason: reason,
            report_details: details.trim() || null,
          });

      if (error) throw error;

      const ticketNumber = String(data);
      setSubmittedTicket(ticketNumber);
      setMessage(`Report submitted. Ticket: ${ticketNumber}`);
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setIsWorking(false);
    }
  }

  function openDialog() {
    setMenuOpen(false);
    setDialogOpen(true);
    setMessage(submittedTicket ? `Report submitted. Ticket: ${submittedTicket}` : null);
  }

  const reportPopup = menuOpen && (!constrainToMessagePanel || panelMenuPosition) ? (
    <div
      ref={popupRef}
      className={`${constrainToMessagePanel ? "fixed z-[60]" : "absolute top-10 z-20"} min-w-44 max-w-[calc(100vw-2rem)] rounded-xl border bg-white p-2 shadow-lg ${constrainToMessagePanel ? "" : menuAlign === "left" ? "right-0 sm:left-0 sm:right-auto" : "right-0"}`}
      style={constrainToMessagePanel && panelMenuPosition
        ? { left: panelMenuPosition.left, top: panelMenuPosition.top, width: panelMenuPosition.width }
        : undefined}
    >
      <button
        className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-gray-50"
        onClick={openDialog}
        type="button"
      >
        {submittedTicket ? `Reported (${submittedTicket})` : `Report ${label}`}
      </button>
    </div>
  ) : null;

  return (
    <div className="relative" ref={menuRef}>
      <button
        aria-label={`More options for ${label}`}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        ref={buttonRef}
        className="rounded-full px-3 py-1 text-xl leading-none hover:bg-gray-100 disabled:opacity-50"
        disabled={disabled}
        onClick={() => {
          setPanelMenuPosition(null);
          setMenuOpen((current) => !current);
        }}
        type="button"
      >
        ⋯
      </button>

      {constrainToMessagePanel && typeof document !== "undefined"
        ? reportPopup && createPortal(reportPopup, document.body)
        : reportPopup}

      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 p-3 sm:p-4">
          <div className="my-auto max-h-[calc(100dvh-1.5rem)] w-full min-w-0 max-w-lg overflow-y-auto rounded-2xl bg-white p-4 shadow-xl sm:max-h-[calc(100dvh-2rem)] sm:p-5">
            <div className="flex items-start justify-between gap-3 sm:gap-4">
              <div>
                <h2 className="text-lg font-semibold sm:text-xl">Report {label}</h2>
                {targetType === "mentorship" && (
                  <p className="mt-1 text-sm text-gray-600">
                    This report identifies the mentorship cycle and participant. A report does not automatically end the mentorship.
                  </p>
                )}
              </div>
              <button
                aria-label="Close report dialog"
                className="rounded-lg border px-3 py-1"
                onClick={() => setDialogOpen(false)}
                type="button"
              >
                ×
              </button>
            </div>

            <form className="mt-4 grid gap-3 sm:mt-5 sm:gap-4" onSubmit={submitReport}>
              <label className="grid gap-2 text-sm font-medium">
                Why are you reporting this?
                <select
                  className="min-w-0 w-full rounded-lg border px-3 py-2 disabled:bg-gray-100"
                  disabled={Boolean(submittedTicket)}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                >
                  {reasons.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2 text-sm font-medium">
                Additional details
                <textarea
                  className="min-h-28 rounded-lg border px-3 py-2 disabled:bg-gray-100"
                  maxLength={targetType === "mentorship" ? 4000 : undefined}
                  disabled={Boolean(submittedTicket)}
                  value={details}
                  onChange={(event) => setDetails(event.target.value)}
                  placeholder="Optional explanation for the moderation team"
                />
              </label>

              {message && <p className="rounded-lg border p-3 text-sm text-gray-700">{message}</p>}

              <div className="grid gap-2 sm:flex sm:justify-end sm:gap-3">
                <button
                  className="w-full rounded-lg border px-4 py-2 text-sm font-medium sm:w-auto"
                  onClick={() => setDialogOpen(false)}
                  type="button"
                >
                  {submittedTicket ? "Close" : "Cancel"}
                </button>
                <button
                  className="w-full rounded-lg bg-black px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                  disabled={isWorking || Boolean(submittedTicket)}
                  type="submit"
                >
                  {submittedTicket ? "Report submitted" : isWorking ? "Submitting..." : "Submit report"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
