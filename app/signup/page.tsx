import { AuthForm } from "@/components/auth/AuthForm";

export default function SignupPage() {
  return (
    <main className="min-h-screen p-8">
      <AuthForm mode="signup" />
    </main>
  );
}
