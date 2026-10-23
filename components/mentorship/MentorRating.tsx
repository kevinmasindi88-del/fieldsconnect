"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  getSupabaseBrowserClient,
  isSupabaseConfigured,
} from "@/lib/supabase/browser";

export type MentorRatingSummary = {
  mentor_id: string;
  average_rating: number | null;
  review_count: number;
};

type MentorReview = {
  rating: number;
  public_comment: string | null;
};

const PAGE_SIZE = 20;

export function MentorRating({
  summary,
  mentorId,
  mentorName = "this mentor",
  className = "",
}: {
  summary?: MentorRatingSummary | null;
  mentorId?: string;
  mentorName?: string;
  className?: string;
}) {
  const count = Number(summary?.review_count ?? 0);
  const average = Number(summary?.average_rating ?? 0);
  const [isOpen, setIsOpen] = useState(false);
  const [reviews, setReviews] = useState<MentorReview[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!isOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      triggerRef.current?.focus();
    };
  }, [isOpen]);

  async function loadReviews(offset: number, append: boolean) {
    if (!mentorId || !isSupabaseConfigured()) {
      setError("Mentor reviews are currently unavailable.");
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const supabase = getSupabaseBrowserClient();
      const { data, error: loadError } = await supabase.rpc(
        "get_mentor_review_list",
        {
          target_mentor_id: mentorId,
          result_limit: PAGE_SIZE + 1,
          result_offset: offset,
        }
      );
      if (loadError) throw loadError;
      const rows = (data ?? []) as MentorReview[];
      const page = rows.slice(0, PAGE_SIZE);
      setReviews((current) => append ? [...current, ...page] : page);
      setHasMore(rows.length > PAGE_SIZE);
    } catch (loadError) {
      console.error("Unable to load verified mentor reviews:", loadError);
      setError("Unable to load mentor reviews. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  if (count === 0 || !Number.isFinite(average) || average < 1 || average > 5) {
    return <span className={`text-gray-500 ${className}`}>No ratings yet</span>;
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`inline-flex items-center gap-1 rounded text-left font-medium text-gray-800 underline-offset-2 hover:text-blue-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${className}`}
        aria-label={`Open ${count} verified mentor ${count === 1 ? "review" : "reviews"} for ${mentorName}, rated ${average.toFixed(1)} out of 5`}
        aria-haspopup="dialog"
        onClick={() => {
          setReviews([]);
          setHasMore(false);
          setIsOpen(true);
          void loadReviews(0, false);
        }}
      >
        <span aria-hidden="true" className="text-amber-500">★</span>
        <span>{average.toFixed(1)} ({count} {count === 1 ? "review" : "reviews"})</span>
      </button>

      {isOpen && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-3 py-5 sm:p-8">
          <button
            type="button"
            aria-label="Close mentor reviews"
            className="absolute inset-0 bg-gray-950/65"
            onClick={() => setIsOpen(false)}
          />
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="relative z-10 flex w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white text-gray-900 shadow-2xl"
            style={{ maxHeight: "min(85vh, 740px)" }}
          >
            <div className="flex items-start justify-between gap-4 border-b px-5 py-4">
              <div className="min-w-0">
                <h2 id={titleId} className="text-lg font-semibold">Mentor reviews</h2>
                <p className="mt-1 break-words text-sm text-gray-600">
                  {mentorName} · <span className="text-amber-500">★</span> {average.toFixed(1)} from {count} verified {count === 1 ? "rating" : "ratings"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Close reviews"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-xl hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
              >
                ×
              </button>
            </div>
            <div className="overflow-y-auto px-5 py-4">
              <p className="mb-4 text-xs leading-5 text-gray-600">
                Ratings come from mentees who completed a mentorship. Written reflections are displayed only when the mentee has agreed to publish them.
              </p>
              {reviews.length > 0 && (
                <ol className="space-y-3">
                  {reviews.map((review, index) => (
                    <li key={index} className="rounded-xl border bg-gray-50 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-sm font-semibold">Verified mentee</span>
                        <span aria-label={`${review.rating} out of 5 stars`} className="text-sm font-semibold text-gray-800">
                          <span className="text-amber-500" aria-hidden="true">
                            {"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}
                          </span>
                          {" "}{review.rating}/5
                        </span>
                      </div>
                      {review.public_comment && (
                        <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-gray-700">{review.public_comment}</p>
                      )}
                    </li>
                  ))}
                </ol>
              )}
              {isLoading && <p className="py-4 text-sm text-gray-600">Loading reviews…</p>}
              {error && <p className="my-3 text-sm text-red-700" role="alert">{error}</p>}
              {!isLoading && !error && reviews.length === 0 && (
                <p className="py-4 text-sm text-gray-600">No visible reviews found.</p>
              )}
              {hasMore && (
                <button
                  type="button"
                  disabled={isLoading}
                  className="mt-4 rounded-xl border px-4 py-2 text-sm font-semibold hover:bg-gray-50 disabled:opacity-50"
                  onClick={() => void loadReviews(reviews.length, true)}
                >
                  Load more reviews
                </button>
              )}
            </div>
          </section>
        </div>,
        document.body
      )}
    </>
  );
}
