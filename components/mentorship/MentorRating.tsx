"use client";
import Link from "next/link";

export type MentorRatingSummary = {
  mentor_id: string;
  average_rating: number | null;
  review_count: number;
};

export function MentorRating({ summary, mentorId, mentorName = "this mentor", className = "" }: {
  summary?: MentorRatingSummary | null;
  mentorId?: string;
  mentorName?: string;
  className?: string;
}) {
  const count = Number(summary?.review_count ?? 0);
  const average = Number(summary?.average_rating ?? 0);
  if (count === 0 || !Number.isFinite(average) || average < 1 || average > 5) {
    return <span className={`text-gray-500 ${className}`}>No ratings yet</span>;
  }
  const text = <><span className="text-amber-500" aria-hidden="true">★</span><span>{average.toFixed(1)} ({count} {count === 1 ? "review" : "reviews"})</span></>;
  if (!mentorId) return <span className={`inline-flex items-center gap-1 ${className}`}>{text}</span>;
  return (
    <Link href={`/mentors/${encodeURIComponent(mentorId)}/reviews`}
      aria-label={`View ${count} verified mentor ${count === 1 ? "review" : "reviews"} for ${mentorName}, rated ${average.toFixed(1)} out of 5`}
      className={`inline-flex items-center gap-1 rounded text-left font-medium text-gray-800 underline-offset-2 hover:text-blue-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${className}`}>
      {text}
    </Link>
  );
}
