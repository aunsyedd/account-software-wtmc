import Link from "next/link";
import { deleteInvoice } from "@/app/actions";
import { PrintButton } from "@/components/PrintButton";
import { PrintHeader } from "@/components/PrintHeader";
import { displayDate, money, todayISO } from "@/lib/format";
import { round2, sumMoney } from "@/lib/vat";
import { getCompany, getInvoices } from "@/lib/queries";
import { ConfirmDelete } from "@/components/ConfirmDelete";
import { NexoraSyncBar } from "@/components/NexoraSyncBar";
import { syncFromNexora } from "@/lib/nexora";

export default async function InvoicesPage() {
  const sync = await syncFromNexora();
  const [all, company] = await Promise.all([getInvoices(), getCompany()]);
  // Invoices deleted on Nexora are kept as "cancelled"; don't list them.
  const invoices = all.filter((i: { status: string }) => i.status !== "cancelled");
  const s = company.currency_symbol;
  // Quotes (proforma) are not sales, so they are left out of the totals row.
  const sales = invoices.filter((i: { title: string }) => i.title !== "Proforma Invoice");
  const vatSum = sumMoney(sales, (i) => i.tax_total);
  const totalSum = sumMoney(sales, (i) => i.grand_total);
  const dueSum = sumMoney(sales, (i) => Math.max(0, round2(Number(i.grand_total) - Number(i.paid_amount || 0))));
  return (
    <>
      <PrintHeader company={company} title="Invoices" subtitle={`${invoices.length} invoices · ${displayDate(todayISO())}`} />
      <div className="page-head">
        <h1>Invoices</h1>
        <div className="no-print" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <PrintButton filename="Invoices" />
        </div>
      </div>
      <NexoraSyncBar result={sync} back="/invoices" />
      <div className="table-wrap">
      <table className="data">
        <thead>
          <tr>
            <th>Invoice #</th>
            <th>Date</th>
            <th>Client</th>
            <th>Status</th>
            <th className="num">VAT</th>
            <th className="num">Total</th>
            <th className="num">Balance due</th>
            <th className="no-print">Actions</th>
          </tr>
        </thead>
        <tbody>
          {invoices.length === 0 ? (
            <tr>
              <td colSpan={8} className="muted">
                No invoices yet.
              </td>
            </tr>
          ) : (
            invoices.map(
              (inv: {
                id: string;
                number: string;
                invoice_date: string;
                client_name: string | null;
                grand_total: number;
                tax_total: number;
                paid_amount: number;
                status: string;
                title: string;
                source?: string;
              }) => (
                <tr key={inv.id}>
                  <td>
                    <Link href={`/invoices/${inv.id}`}>{inv.number}</Link>
                    {inv.source === "nexora" ? <span className="badge nexora">Nexora</span> : null}
                  </td>
                  <td className="date">{displayDate(inv.invoice_date)}</td>
                  <td>{inv.client_name}</td>
                  <td>
                    <span className={"badge " + (inv.title === "Proforma Invoice" ? "draft" : inv.status)}>
                      {inv.title === "Proforma Invoice" ? "quote" : inv.status}
                    </span>
                  </td>
                  <td className="num">{money(inv.tax_total, s)}</td>
                  <td className="num">{money(inv.grand_total, s)}</td>
                  <td className="num">
                    {inv.title === "Proforma Invoice"
                      ? "—"
                      : money(Math.max(0, Number(inv.grand_total) - Number(inv.paid_amount || 0)), s)}
                  </td>
                  <td className="actions no-print">
                    <Link href={`/invoices/${inv.id}`}>View</Link>
                    {inv.source === "nexora" ? null : (
                      <>
                        <Link href={`/invoices/${inv.id}/edit`}>Edit</Link>
                        <ConfirmDelete action={deleteInvoice} id={inv.id} what={`invoice ${inv.number}`} />
                      </>
                    )}
                  </td>
                </tr>
              )
            )
          )}
        </tbody>
        {sales.length ? (
          <tfoot>
            <tr>
              <td colSpan={4}>
                <strong>Total{sales.length < invoices.length ? " (excl. quotes)" : ""}</strong>
              </td>
              <td className="num">
                <strong>{money(vatSum, s)}</strong>
              </td>
              <td className="num">
                <strong>{money(totalSum, s)}</strong>
              </td>
              <td className="num">
                <strong>{money(dueSum, s)}</strong>
              </td>
              <td className="no-print"></td>
            </tr>
          </tfoot>
        ) : null}
      </table>
      </div>
    </>
  );
}
