import type { Metadata } from "next";
import { signupAction } from "@/app/actions";
import { AuthForm } from "@/components/AuthForm";
import { AuthScreen } from "@/components/AuthScreen";

export const metadata: Metadata = { title: "Create account" };

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <AuthScreen title="Create your account" subtitle="VAT 15% · SAR · inventory, invoices and payroll.">
      <AuthForm mode="signup" action={signupAction} error={error} />
    </AuthScreen>
  );
}
