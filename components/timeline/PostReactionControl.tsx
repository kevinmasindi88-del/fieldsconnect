"use client";

import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

export type PostReactionType = "like" | "love" | "thanks" | "applause";

const HOLD_DURATION_MS = 700;
const MOVE_TOLERANCE_PX = 12;

// Collapse each native multicolour hand emoji to a single colour first,
// then apply a strong blue tint. brightness(0) ensures no original skin,
// pink or lilac pixels survive; the red heart is left entirely untouched.
const reactionEmojiFilters: Partial<Record<PostReactionType, string>> = {
  thanks: "brightness(0) saturate(100%) invert(30%) sepia(89%) saturate(3181%) hue-rotate(207deg) brightness(103%) contrast(102%)",
  applause: "brightness(0) saturate(100%) invert(23%) sepia(89%) saturate(4007%) hue-rotate(218deg) brightness(93%) contrast(106%)",
};

const additionalReactions: Array<{ type: PostReactionType; emoji: string; label: string }> = [
  { type: "love", emoji: "❤️", label: "Love" },
  { type: "thanks", emoji: "🙏", label: "Appreciate" },
  { type: "applause", emoji: "👏", label: "Applaud" },
];

export function PostReactionControl({
  reaction,
  counts,
  disabled,
  onReact,
}: {
  reaction: PostReactionType | null;
  counts: Record<PostReactionType, number>;
  disabled: boolean;
  onReact: (reaction: PostReactionType) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressStartRef = useRef<{ x: number; y: number } | null>(null);
  const suppressClickRef = useRef(false);

  function clearHoldTimer() {
    if (holdTimerRef.current !== null) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  }

  useEffect(() => {
    return () => {
      if (holdTimerRef.current !== null) clearTimeout(holdTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!pickerOpen) return;

    function dismissOutside(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setPickerOpen(false);
      }
    }
    function dismissOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setPickerOpen(false);
    }

    document.addEventListener("pointerdown", dismissOutside);
    document.addEventListener("keydown", dismissOnEscape);
    return () => {
      document.removeEventListener("pointerdown", dismissOutside);
      document.removeEventListener("keydown", dismissOnEscape);
    };
  }, [pickerOpen]);

  function startHold(event: ReactPointerEvent<HTMLButtonElement>) {
    if (disabled || (event.pointerType === "mouse" && event.button !== 0)) return;
    clearHoldTimer();
    suppressClickRef.current = false;
    pressStartRef.current = { x: event.clientX, y: event.clientY };
    holdTimerRef.current = setTimeout(() => {
      pressStartRef.current = null;
      holdTimerRef.current = null;
      suppressClickRef.current = true;
      setPickerOpen(true);
    }, HOLD_DURATION_MS);
  }

  function moveHold(event: ReactPointerEvent<HTMLButtonElement>) {
    const start = pressStartRef.current;
    if (!start) return;
    if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > MOVE_TOLERANCE_PX) {
      clearHoldTimer();
      pressStartRef.current = null;
    }
  }

  function finishHold() {
    clearHoldTimer();
    pressStartRef.current = null;
  }

  function clickLike() {
    // Ignore the synthetic click fired when the original long press ends.
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    // A second tap on Like dismisses the open picker; never toggle the
    // existing reaction or write to the database while closing it.
    if (pickerOpen) {
      setPickerOpen(false);
      return;
    }
    onReact("like");
  }

  function chooseReaction(choice: PostReactionType) {
    setPickerOpen(false);
    suppressClickRef.current = false;
    onReact(choice);
  }

  const visibleReactions = additionalReactions.filter((choice) => counts[choice.type] > 0);

  return (
    <div ref={rootRef} className="relative inline-flex min-w-0 flex-wrap items-center gap-1" data-post-reaction-control>
      {pickerOpen && (
        <div
          aria-label="Choose post reaction"
          className="absolute bottom-full left-0 z-30 mb-2 flex items-center gap-1 rounded-full border border-gray-200 bg-white p-1.5 shadow-lg"
          role="group"
        >
          {additionalReactions.map((choice) => (
            <button
              key={choice.type}
              aria-label={choice.label}
              aria-pressed={reaction === choice.type}
              className={[
                "inline-flex h-11 w-11 items-center justify-center rounded-full text-2xl transition hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:opacity-50",
                reaction === choice.type ? "bg-blue-100" : "",
              ].join(" ")}
              disabled={disabled}
              onClick={() => chooseReaction(choice.type)}
              title={choice.label}
              type="button"
            >
              <span
                aria-hidden="true"
                className="inline-block leading-none"
                style={{ filter: reactionEmojiFilters[choice.type] }}
              >
                {choice.emoji}
              </span>
            </button>
          ))}
        </div>
      )}
      <button
        aria-label={pickerOpen ? "Close reaction picker" : reaction === "like" ? "Unlike post" : "Like post"}
        aria-haspopup="true"
        aria-expanded={pickerOpen}
        aria-pressed={reaction === "like"}
        className={[
          "inline-flex min-h-10 touch-pan-y select-none items-center gap-1.5 rounded-lg px-2 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:opacity-50",
          reaction === "like" ? "text-blue-700 hover:bg-blue-50" : "text-gray-600 hover:bg-gray-50 hover:text-blue-700",
        ].join(" ")}
        disabled={disabled}
        onClick={clickLike}
        onContextMenu={(event) => event.preventDefault()}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setPickerOpen(true);
          }
        }}
        onPointerCancel={finishHold}
        onPointerDown={startHold}
        onPointerLeave={finishHold}
        onPointerMove={moveHold}
        onPointerUp={finishHold}
        title="Tap to like · Hold 0.7 seconds for ❤️ 🙏 👏 · Arrow Down for reactions"
        type="button"
      >
        <svg aria-hidden="true" className="h-5 w-5" fill={reaction === "like" ? "currentColor" : "none"} viewBox="0 0 24 24">
          <path
            d="M7 10v10H4V10h3Zm4.2-7c.8 0 1.5.7 1.5 1.5v3.1h4.8c1.4 0 2.4 1.3 2 2.6l-2.1 7.3c-.3.9-1.1 1.5-2.1 1.5H9V9.7l2-4.7c.1-.3.2-.7.2-1V3Z"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.8"
          />
        </svg>
        <span>{counts.like}</span>
      </button>
      {visibleReactions.map(({ type, emoji, label }) => (
        <span
          key={type}
          aria-label={`${counts[type]} ${label.toLowerCase()} reactions`}
          className={[
            "inline-flex items-center gap-1 rounded-full px-1.5 py-1 text-xs font-medium",
            reaction === type ? "bg-blue-50 text-blue-700" : "text-gray-600",
          ].join(" ")}
          role="img"
          title={`${label}: ${counts[type]}`}
        >
          <span aria-hidden="true" className="text-base leading-none" style={{ filter: reactionEmojiFilters[type] }}>
            {emoji}
          </span>
          <span aria-hidden="true">{counts[type]}</span>
        </span>
      ))}
    </div>
  );
}
