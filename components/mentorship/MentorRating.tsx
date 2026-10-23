"use client";

export type MentorRatingSummary = {
  mentor_id: string;
  average_rating: number | null;
  review_count: number;
};

export function MentorRating({
  summary,
  className = "",
}: {
  summary?: MentorRatingSummary | null;
  className?: string;
}) {
  const count = Number(summary?.review_count ?? 0);
  const average = Number(summary?.average_rating ?? 0);

  if (count === 0 || !Number.isFinite(average) || average < 1 || average > 5) {
    return <span className={`text-gray-500 ${className}`}>No ratings yet</span>;
  }

  return (
    <span
      className={`inline-flex items-center gap-1 font-medium text-gray-800 ${className}`}
      aria-label={`Rated ${average.toFixed(1)} out of 5 from ${count} ${count === 1 ? "review" : "reviews"}`}
    >
      <span aria-hidden="true" className="text-amber-500">★</span>
      <span>{average.toFixed(1)} ({count} {count === 1 ? "review" : "reviews"})</span>
    </span>
  );
}
