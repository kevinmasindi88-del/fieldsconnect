"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/browser";
import type { MentorRatingSummary } from "@/components/mentorship/MentorRating";

type ReviewCard = {
  rating: number;
  cycle_title: string;
  mentee_name: string;
  public_comment: string | null;
  is_identified: boolean;
};
const PAGE_SIZE = 20;

export function MentorReviewsPage({ mentorId }: { mentorId: string }) {
  const [mentorName, setMentorName] = useState("Mentor");
  const [summary, setSummary] = useState<MentorRatingSummary | null>(null);
  const [reviews, setReviews] = useState<ReviewCard[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadReviews = useCallback(async (offset: number, append: boolean) => {
    if (!isSupabaseConfigured()) {
      setError("Mentor reviews are unavailable right now.");
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const supabase = getSupabaseBrowserClient();
      const { data, error: readError } = await supabase.rpc("get_mentor_reviews_page", {
        target_mentor_id: mentorId,
        result_limit: PAGE_SIZE + 1,
        result_offset: offset,
      });
      if (readError) throw readError;
      const rows = (data ?? []) as ReviewCard[];
      setReviews(current => append ? [...current, ...rows.slice(0, PAGE_SIZE)] : rows.slice(0, PAGE_SIZE));
      setHasMore(rows.length > PAGE_SIZE);
    } catch (loadError) {
      console.error("Unable to load mentor reviews:", loadError);
      setError("We couldn't load mentor reviews. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [mentorId]);

  useEffect(() => {
    setReviews([]);
    setSummary(null);
    setMentorName("Mentor");
    setHasMore(false);
    if (!isSupabaseConfigured()) {
      setError("Mentor reviews are unavailable right now.");
      setIsLoading(false);
      return;
    }
    let isCurrent = true;
    const supabase = getSupabaseBrowserClient();
    async function loadHeader() {
      const [{ data: mentor, error: profileError }, { data: ratings, error: ratingError }] = await Promise.all([
        supabase.from("profiles").select("display_name").eq("id", mentorId).maybeSingle(),
        supabase.rpc("get_mentor_rating_summaries", { target_mentor_ids: [mentorId] }),
      ]);
      if (!isCurrent) return;
      if (profileError || ratingError) {
        console.warn("Unable to load mentor review header:", profileError ?? ratingError);
        return;
      }
      if (mentor?.display_name) setMentorName(mentor.display_name);
      setSummary(((ratings ?? [])[0] ?? null) as MentorRatingSummary | null);
    }
    void loadHeader();
    void loadReviews(0, false);
    return () => { isCurrent = false; };
  }, [mentorId, loadReviews]);

  const count = Number(summary?.review_count ?? 0);
  const average = Number(summary?.average_rating ?? 0);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 sm:py-10">
      <header>
        <Link href={`/profile/${encodeURIComponent(mentorId)}`} className="text-sm font-semibold text-blue-700 hover:underline">
          ← Back to mentor profile
        </Link>
        <h1 className="mt-4 break-words text-2xl font-bold text-gray-950 sm:text-3xl">Mentor reviews</h1>
        <p className="mt-2 break-words text-base font-medium text-gray-800">{mentorName}</p>
        {count > 0 && average >= 1 && average <= 5 && (
          <p className="mt-2 text-sm text-gray-700"><span aria-hidden="true" className="text-amber-500">★</span>{" "}
            {average.toFixed(1)} out of 5 · {count} verified {count === 1 ? "rating" : "ratings"}</p>
        )}
        <p className="mt-3 text-sm leading-6 text-gray-600">
          Ratings come from completed mentorship cycles. A mentee's name, cycle title and feedback
          are published together only with their explicit consent.
        </p>
      </header>
      {reviews.length > 0 && (
        <ol className="flex flex-col gap-4">
          {reviews.map((review, index) => {
            const rating = Math.max(1, Math.min(5, Number(review.rating) || 1));
            return (
              <li key={index}>
                <article className="min-w-0 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="break-words text-base font-semibold text-gray-950 sm:text-lg">{review.cycle_title}</h2>
                      <p className="mt-1 text-sm text-gray-600">
                        Review by <span className="font-medium text-gray-800">{review.mentee_name}</span>
                        {!review.is_identified && <span className="ml-1 text-xs">(anonymous)</span>}
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-semibold text-gray-800" aria-label={`Rating: ${rating} out of 5 stars`}>
                      <span className="text-amber-500" aria-hidden="true">{"★".repeat(rating)}{"☆".repeat(5 - rating)}</span>
                      <span className="ml-2">{rating}/5</span>
                    </p>
                  </div>
                  {review.public_comment ? (
                    <blockquote className="mt-4 whitespace-pre-wrap break-words border-l-2 border-blue-200 pl-4 text-sm leading-6 text-gray-700">{review.public_comment}</blockquote>
                  ) : (
                    <p className="mt-4 text-sm italic text-gray-500">The mentee has not published a written feedback statement.</p>
                  )}
                </article>
              </li>
            );
          })}
        </ol>
      )}
      {isLoading && <p className="py-5 text-sm text-gray-600" role="status">Loading reviews…</p>}
      {error && <div className="rounded-xl border border-red-200 p-4 text-sm text-red-800" role="alert">
        <p>{error}</p>
        <button type="button" onClick={() => void loadReviews(reviews.length, reviews.length > 0)}
          className="mt-2 font-semibold underline underline-offset-2">Try again</button>
      </div>}
      {!isLoading && !error && reviews.length === 0 && (
        <p className="rounded-xl border border-dashed border-gray-300 p-6 text-sm text-gray-600">
          No verified mentor reviews are available yet.
        </p>
      )}
      {hasMore && <button type="button" disabled={isLoading} onClick={() => void loadReviews(reviews.length, true)}
        className="self-start rounded-xl border border-gray-300 bg-white px-5 py-3 text-sm font-semibold text-gray-900 hover:bg-gray-50 disabled:opacity-50">
        Load more reviews
      </button>}
    </main>
  );
}
