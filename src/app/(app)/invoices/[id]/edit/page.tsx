import Link from "next/link";
import { saveInvoice } from "@/app/actions";
import { LineItems } from "@/components/LineItems";
import { getClients, getCompany, getInvoice, getProducts } from "@/lib/queries";
import { SubmitButton } from "@/components/SubmitButton";

export default async function EditInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [{ invoice, items }, clients, products, company] = await Promise.all([
    getInvoice(id),
    getClients(),
    getProducts(),
    getCompany(),
  ]);
  if (invoice.source === "nexora") {
    return (
      <>
        <div className="page-head">
          <h1>Edit {invoice.number}</h1>
          <Link className="btn btn-gray" href={`/invoices/${id}`}>
            ← Back
          </Link>
        </div>
        <div className="empty">
          This invoice was created on Nexora Invoices. Edit it there and the changes will appear here automatically.
        </div>
      </>
    );
  }
  return (
    <>
      <div className="page-head">
        <h1>Edit {invoice.number}</h1>
        <Link className="btn btn-gray" href={`/invoices/${id}`}>
          ← Back
        </Link>
      </div>
      <form action={saveInvoice} className="form" style={{ maxWidth: 1100 }}>
        <input type="hidden" name="id" value={id} />
        <div className="grid-2">
          <div className="field">
            <label>Title</label>
            <select name="title" defaultValue={invoice.title}>
              <option>Invoice</option>
              <option>Tax Invoice</option>
              <option>Proforma Invoice</option>
            </select>
          </div>
          <div className="field">
            <label>Client</label>
            <select name="client_id" defaultValue={invoice.client_id || ""}>
              <option value="">Select client</option>
              {clients.map((c: { id: string; name: string }) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Invoice date</label>
            <input name="invoice_date" type="date" defaultValue={invoice.invoice_date} />
          </div>
          <div className="field">
            <label>Due date</label>
            <input name="due_date" type="date" defaultValue={invoice.due_date || ""} />
          </div>
        </div>
        <LineItems products={products} mode="invoice" initial={items} initialDiscount={Number(invoice.discount_amount || 0)} symbol={company.currency_symbol} />
        <div className="grid-2" style={{ marginTop: 12 }}>
          <div className="field">
            <label>Notes</label>
            <textarea name="notes" defaultValue={invoice.notes || ""} />
          </div>
          <div className="field">
            <label>Terms</label>
            <textarea name="terms" defaultValue={invoice.terms || ""} />
          </div>
        </div>
        <div className="btn-row">
          <SubmitButton className="btn btn-green" pendingLabel="Saving…">
            Save invoice
          </SubmitButton>
        </div>
      </form>
    </>
  );
}
