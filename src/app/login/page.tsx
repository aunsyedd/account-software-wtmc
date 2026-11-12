import type { Metadata } from "next";
import { loginAction } from "@/app/actions";
import { AuthForm } from "@/components/AuthForm";
import { AuthScreen } from "@/components/AuthScreen";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  // searchParams are already decoded; decoding again crashed on messages containing "%".
  const { error } = await searchParams;
  return (
    <AuthScreen title="Welcome back" subtitle="Sign in to manage stock, VAT, invoices and payroll.">
      <AuthForm mode="login" action={loginAction} error={error} />
    </AuthScreen>
  );
}
