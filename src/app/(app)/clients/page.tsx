import Link from "next/link";
import { deleteClient } from "@/app/actions";
import { getClients, getCompany } from "@/lib/queries";
import { PrintButton } from "@/components/PrintButton";
import { PrintHeader } from "@/components/PrintHeader";
import { displayDate, todayISO } from "@/lib/format";
import { ConfirmDelete } from "@/components/ConfirmDelete";
import { NexoraSyncBar } from "@/components/NexoraSyncBar";
import { syncFromNexora } from "@/lib/nexora";

export default async function ClientsPage() {
  const sync = await syncFromNexora();
  const [clients, company] = await Promise.all([getClients(), getCompany()]);
  return (
    <>
      <PrintHeader company={company} title="Client list" subtitle={`${clients.length} clients · ${displayDate(todayISO())}`} />
      <div className="page-head">
        <h1>Clients</h1>
        <div className="head-actions no-print">
          <PrintButton filename="Client list" />
          <Link className="btn btn-green" href="/clients/new">
            + Add client
          </Link>
        </div>
      </div>
      <NexoraSyncBar result={sync} back="/clients" />
      <div className="table-wrap">
      <table className="data">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Phone</th>
            <th>Tax number</th>
            <th>City</th>
            <th className="no-print">Actions</th>
          </tr>
        </thead>
        <tbody>
          {clients.length === 0 ? (
            <tr>
              <td colSpan={6} className="muted">
                No clients yet.
              </td>
            </tr>
          ) : (
            clients.map(
              (c: {
                id: string;
                name: string;
                email: string | null;
                phone: string | null;
                tax_number: string | null;
                city: string | null;
                nexora_customer_id?: number | null;
              }) => (
                <tr key={c.id}>
                  <td>
                    <Link href={`/clients/${c.id}`}>{c.name}</Link>
                    {c.nexora_customer_id != null ? (
                      <span className="badge nexora">Nexora #{c.nexora_customer_id}</span>
                    ) : null}
                  </td>
                  <td>{c.email}</td>
                  <td>{c.phone}</td>
                  <td>{c.tax_number}</td>
                  <td>{c.city}</td>
                  <td className="actions no-print">
                    <Link href={`/clients/${c.id}`}>Edit</Link>
                    <ConfirmDelete action={deleteClient} id={c.id} what={`client ${c.name}`} />
                  </td>
                </tr>
              )
            )
          )}
        </tbody>
      </table>
      </div>
    </>
  );
}
