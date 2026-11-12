import { notFound } from "next/navigation";
import Link from "next/link";
import { saveClient } from "@/app/actions";
import { PartyForm } from "@/components/PartyForm";
import { getClients } from "@/lib/queries";

export default async function EditClientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const clients = await getClients();
  const client = clients.find((c: { id: string }) => c.id === id);
  if (!client) notFound();
  return (
    <>
      <div className="page-head">
        <h1>Edit client</h1>
        <Link className="btn btn-gray" href="/clients">
          ← Back
        </Link>
      </div>
      <PartyForm action={saveClient} kind="client" party={client} />
    </>
  );
}
