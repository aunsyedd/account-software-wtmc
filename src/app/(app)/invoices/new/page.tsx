import { redirect } from "next/navigation";

// Invoices are created in Nexora and synced here; manual creation is disabled.
export default function NewInvoicePage() {
  redirect("/invoices");
}
