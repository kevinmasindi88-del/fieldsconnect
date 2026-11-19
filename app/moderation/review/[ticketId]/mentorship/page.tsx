import { ModerationMentorshipEvidence } from "@/components/moderation/ModerationMentorshipEvidence";

export default async function ModerationMentorshipEvidencePage({
  params,
}: {
  params: Promise<{ ticketId: string }>;
}) {
  const { ticketId } = await params;
  return <ModerationMentorshipEvidence ticketId={ticketId} />;
}
