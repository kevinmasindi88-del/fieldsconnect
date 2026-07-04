import { AcceptanceForm } from "@/components/onboarding/AcceptanceForm";
import { ProfileForm } from "@/components/profile/ProfileForm";

export default function OnboardingPage() {
  return (
    <main className="flex min-h-screen flex-col gap-8 p-8">
      <AcceptanceForm />
      <ProfileForm />
    </main>
  );
}
