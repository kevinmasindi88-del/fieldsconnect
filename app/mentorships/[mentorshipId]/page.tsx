import { MentorshipWorkspace } from "@/components/mentorship/MentorshipWorkspace";

type MentorshipPageProps = {
  params: Promise<{
    mentorshipId: string;
  }>;
};

export default async function MentorshipPage({
  params,
}: MentorshipPageProps) {
  const { mentorshipId } = await params;

  return (
    <main className="min-h-screen">
      <MentorshipWorkspace
        mentorshipId={mentorshipId}
      />
    </main>
  );
}