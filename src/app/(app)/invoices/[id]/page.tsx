import Link from "next/link";
import { deletePayment, markInvoicePaid, markInvoiceUnpaid, savePayment } from "@/app/actions";
import { ConfirmDelete } from "@/components/ConfirmDelete";
import { PaidToggle } from "@/components/PaidToggle";
import { PrintButton } from "@/components/PrintButton";
import { SubmitButton } from "@/components/SubmitButton";
import { TaxInvoice } from "@/components/TaxInvoice";
import { displayDate, money, todayISO } from "@/lib/format";
import { getCompany, getInvoice } from "@/lib/queries";
import { buildTaxInvoice } from "@/lib/taxInvoice";
import { paymentStatus, round2 } from "@/lib/vat";

export default async function InvoiceViewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const [{ invoice, items, payments, client }, company] = await Promise.all([getInvoice(id), getCompany()]);
  const s = company.currency_symbol;
  const fromNexora = invoice.source === "nexora";
  const payable = fromNexora && invoice.nexora_due != null ? Number(invoice.nexora_due) : Number(invoice.grand_total);
  const paid = Number(invoice.paid_amount || 0);
  const due = round2(payable - paid);
  const isQuote = invoice.title === "Proforma Invoice";
  const canToggle = !isQuote && invoice.status !== "cancelled" && invoice.status !== "draft";
  const total = Number(invoice.grand_total || 0);
  const payState = paymentStatus(paid, total);
  const stillOwed = round2(total - paid);
  const customer = invoice.client_name || "This customer";
  const taxInvoice = await buildTaxInvoice({ invoice, items, client });

  return (
    <>
      <div className="page-head no-print">
        <div>
          <h1>
            {invoice.title} {invoice.number}
          </h1>
          <p className="hint">
            <span className={"badge " + (canToggle ? payState : invoice.status)}>{canToggle ? payState : invoice.status}</span>
            {fromNexora ? <span className="badge nexora">Nexora</span> : null}
          </p>
        </div>
        <div className="head-actions">
          {canToggle ? (
            <PaidToggle
              invoiceId={id}
              status={payState}
              owedLabel={money(total, s)}
              paidLabel={money(paid, s)}
              markPaid={markInvoicePaid}
              markUnpaid={markInvoiceUnpaid}
            />
          ) : null}
          <PrintButton filename={`${invoice.title} ${invoice.number}${invoice.client_name ? " - " + invoice.client_name : ""}`} />
          {fromNexora ? null : (
            <Link className="btn btn-gray" href={`/invoices/${id}/edit`}>
              Edit
            </Link>
          )}
          <Link className="btn btn-gray" href="/invoices">
            ← All invoices
          </Link>
        </div>
      </div>
      {fromNexora ? (
        <div className="sync-bar no-print">
          <span>
            <strong>Synced from Nexora Invoices.</strong>{" "}
            <span className="muted">
              Edit or delete it on the Nexora Invoices site; changes show up here automatically. Payments are recorded here.
            </span>
          </span>
        </div>
      ) : null}

      {canToggle && stillOwed > 0.004 ? (
        <div className="notice notice-danger no-print">
          <strong>Payment reminder:</strong> {customer} still has to give us <strong>{money(stillOwed, s)}</strong> for this
          invoice{paid > 0 ? ` (${money(paid, s)} of ${money(total, s)} received so far)` : ""}. Click <b>Paid</b> once the money
          is received.
        </div>
      ) : null}

      <TaxInvoice data={taxInvoice} />

      {isQuote ? null : (
        <section className="no-print">
          <h2 className="report-title">Payments received</h2>
          {payments.length ? (
            <div className="table-wrap" style={{ maxWidth: 900 }}>
              <table className="data">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Mode</th>
                    <th>Reference</th>
                    <th className="num">Amount</th>
                    <th className="no-print"></th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map(
                    (p: { id: string; payment_date: string; payment_mode: string; reference: string | null; amount: number }) => (
                      <tr key={p.id}>
                        <td>{displayDate(p.payment_date)}</td>
                        <td>{p.payment_mode}</td>
                        <td>{p.reference}</td>
                        <td className="num">{money(p.amount, s)}</td>
                        <td className="actions">
                          <ConfirmDelete action={deletePayment} id={p.id} what={`this ${money(p.amount, s)} payment`} label="Remove" />
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="hint">No payments recorded yet.</p>
          )}

          {due > 0 ? (
            <>
              <h3>Record a payment</h3>
              {error === "amount" ? <div className="alert">Payment amount must be more than zero.</div> : null}
              <form action={savePayment} className="form" style={{ maxWidth: 900 }}>
                <input type="hidden" name="invoice_id" value={id} />
                <div className="grid-2">
                  <div className="field">
                    <label htmlFor="pay-amount">Amount ({s})</label>
                    <input id="pay-amount" name="amount" type="number" step="0.01" min="0.01" required defaultValue={due.toFixed(2)} />
                  </div>
                  <div className="field">
                    <label htmlFor="pay-date">Payment date</label>
                    <input id="pay-date" name="payment_date" type="date" defaultValue={todayISO()} />
                  </div>
                  <div className="field">
                    <label htmlFor="pay-mode">Payment mode</label>
                    <select id="pay-mode" name="payment_mode">
                      <option>Cash</option>
                      <option>Bank</option>
                      <option>Card</option>
                      <option>Cheque</option>
                      <option>Online</option>
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="pay-ref">Reference</label>
                    <input id="pay-ref" name="reference" />
                  </div>
                </div>
                <SubmitButton className="btn btn-green" pendingLabel="Saving…">
                  Save payment
                </SubmitButton>
              </form>
            </>
          ) : null}
        </section>
      )}
    </>
  );
}
