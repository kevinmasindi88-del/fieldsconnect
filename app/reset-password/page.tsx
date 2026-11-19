import { AuthForm } from "@/components/auth/AuthForm";

export default function ResetPasswordPage() {
  return (
    <main className="min-h-screen p-8">
      <AuthForm mode="reset" />
    </main>
  );
}
