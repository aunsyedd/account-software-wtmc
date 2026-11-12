import Link from "next/link";
import { saveInvoice } from "@/app/actions";
import { LineItems } from "@/components/LineItems";
import { todayISO } from "@/lib/format";
import { getClients, getCompany, getProducts } from "@/lib/queries";
import { SubmitButton } from "@/components/SubmitButton";
import { syncFromNexora } from "@/lib/nexora";

export default async function NewInvoicePage() {
  await syncFromNexora();
  const [clients, products, company] = await Promise.all([
    getClients(),
    getProducts(),
    getCompany(),
  ]);
  return (
    <>
      <div className="page-head">
        <h1>Create invoice</h1>
        <Link className="btn btn-gray" href="/invoices">
          ← Back
        </Link>
      </div>
      <form action={saveInvoice} className="form" style={{ maxWidth: 1100 }}>
        <div className="grid-2">
          <div className="field">
            <label>Title</label>
            <select name="title" defaultValue="Invoice">
              <option>Invoice</option>
              <option>Tax Invoice</option>
              <option>Proforma Invoice</option>
            </select>
          </div>
          <div className="field">
            <label>Client</label>
            <select name="client_id">
              <option value="">Select client</option>
              {clients.map((c: { id: string; name: string }) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <div className="hint">
              New client? <Link href="/clients/new">add client</Link>
            </div>
          </div>
          <div className="field">
            <label>Invoice date</label>
            <input name="invoice_date" type="date" defaultValue={todayISO()} />
          </div>
          <div className="field">
            <label>Due date</label>
            <input name="due_date" type="date" />
          </div>
        </div>
        <h3>Line items</h3>
        <p className="hint">VAT 15% is added automatically. Example: &#x20C1;&nbsp;10.00 becomes &#x20C1;&nbsp;11.50. Any discount is taken off before VAT.</p>
        <LineItems products={products} mode="invoice" symbol={company.currency_symbol} />
        <div className="grid-2" style={{ marginTop: 12 }}>
          <div className="field">
            <label>Notes</label>
            <textarea name="notes" defaultValue={company.default_notes || ""} />
          </div>
          <div className="field">
            <label>Terms and conditions</label>
            <textarea name="terms" defaultValue={company.default_terms || ""} />
          </div>
        </div>
        <div className="btn-row">
          <SubmitButton className="btn btn-green" pendingLabel="Generating…">
            Generate Invoice
          </SubmitButton>
        </div>
      </form>
    </>
  );
}
