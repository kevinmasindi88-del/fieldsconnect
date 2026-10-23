import { MentorReviewsPage } from "@/components/mentorship/MentorReviewsPage";

export default async function MentorReviewsRoute({ params }: { params: Promise<{ mentorId: string }> }) {
  const { mentorId } = await params;
  return <MentorReviewsPage mentorId={mentorId} />;
}
