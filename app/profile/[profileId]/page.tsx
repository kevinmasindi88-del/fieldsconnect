import { PublicProfileView } from "@/components/profile/PublicProfileView";

type PublicProfilePageProps = {
  params: Promise<{
    profileId: string;
  }>;
};

export default async function PublicProfilePage({ params }: PublicProfilePageProps) {
  const { profileId } = await params;

  return <PublicProfileView profileId={profileId} />;
}