import { ModerationReview } from "@/components/moderation/ModerationReview";

export default async function ModerationReviewPage({
  params,
}: {
  params: Promise<{ ticketId: string }>;
}) {
  const { ticketId } = await params;

  return <ModerationReview ticketId={ticketId} />;
}