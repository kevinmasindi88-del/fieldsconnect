import { AcceptanceForm } from "@/components/onboarding/AcceptanceForm";

export default function OnboardingPage() {
  // Policy-only catch-up for legacy members; new signups skip this route.
  return (
    <main className="min-h-screen bg-gray-50 px-4 py-10 sm:px-6">
      <AcceptanceForm />
    </main>
  );
}
