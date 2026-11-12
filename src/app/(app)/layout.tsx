import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const email = await requireSession();
  if (!email) redirect("/login");
  return <AppShell email={email}>{children}</AppShell>;
}
