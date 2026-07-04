import { AuthForm } from "@/components/auth/AuthForm";

export default function LoginPage() {
  return (
    <main className="min-h-screen p-8">
      <AuthForm mode="login" />
    </main>
  );
}
