import { notFound } from "next/navigation";
import { QuickOnboarding } from "@/components/onboarding/QuickOnboarding";

export const metadata = {
  title: "Onboarding UI Preview · FieldsConnect",
  robots: { index: false, follow: false },
};

export default function OnboardingPreviewPage() {
  // The route does not exist for users of the production application.
  if (process.env.VERCEL_ENV === "production") notFound();
  return <QuickOnboarding previewMode />;
}
