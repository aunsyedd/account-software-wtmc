import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { DatabaseSetupNotice } from "@/components/DatabaseSetupNotice";
import { checkDatabaseSetup } from "@/lib/setup";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const email = await requireSession();
  if (!email) redirect("/login");
  const problem = await checkDatabaseSetup();
  return <AppShell email={email}>{problem ? <DatabaseSetupNotice problem={problem} /> : children}</AppShell>;
}
