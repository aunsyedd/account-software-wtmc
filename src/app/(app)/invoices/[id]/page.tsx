import Link from "next/link";
import { deletePayment, savePayment } from "@/app/actions";
import { BrandMark } from "@/components/BrandMark";
import { ConfirmDelete } from "@/components/ConfirmDelete";
import { PrintButton } from "@/components/PrintButton";
import { SubmitButton } from "@/components/SubmitButton";
import { displayDate, money, qty, todayISO } from "@/lib/format";
import { getCompany, getInvoice } from "@/lib/queries";
import { VAT_RATE, lineGross, lineNet, round2, vatAmount } from "@/lib/vat";

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
  const discount = Number(invoice.discount_amount || 0);
  const fromNexora = invoice.source === "nexora";
  const retention = fromNexora ? Number(invoice.nexora_retention || 0) : 0;
  const payable = fromNexora && invoice.nexora_due != null ? Number(invoice.nexora_due) : Number(invoice.grand_total);
  const paid = Number(invoice.paid_amount || 0);
  const due = round2(payable - paid);
  const isQuote = invoice.title === "Proforma Invoice";
  const companyAddress = [company.address, company.city, company.country].filter(Boolean).join(", ");

  return (
    <>
      <div className="page-head no-print">
        <div>
          <h1>
            {invoice.title} {invoice.number}
          </h1>
          <p className="hint">
            <span className={"badge " + invoice.status}>{invoice.status}</span>
            {fromNexora ? <span className="badge nexora">Nexora</span> : null}
          </p>
        </div>
        <div className="head-actions">
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

      <article className="print-invoice">
        <header className="invoice-head">
          <div className="invoice-company">
            <span className="invoice-logo">
              <BrandMark />
            </span>
            <div>
              <h2>{company.legal_name || company.name}</h2>
              {companyAddress ? <div className="muted">{companyAddress}</div> : null}
              {company.phone || company.email ? (
                <div className="muted">{[company.phone, company.email].filter(Boolean).join(" · ")}</div>
              ) : null}
              {company.tax_number ? <div className="muted">VAT No. {company.tax_number}</div> : null}
            </div>
          </div>
          <div className="invoice-meta">
            <div className="invoice-doc-title">{invoice.title}</div>
            <dl>
              <dt>Number</dt>
              <dd>{invoice.number}</dd>
              <dt>Date</dt>
              <dd>{displayDate(invoice.invoice_date)}</dd>
              {invoice.due_date ? (
                <>
                  <dt>Due date</dt>
                  <dd>{displayDate(invoice.due_date)}</dd>
                </>
              ) : null}
            </dl>
          </div>
        </header>

        <div className="bill-to">
          <div className="bill-label">Bill to</div>
          <div className="bill-name">{invoice.client_name || "—"}</div>
          {client?.nexora_customer_id != null ? <div className="muted">Customer No. {client.nexora_customer_id}</div> : null}
          {client?.tax_number ? <div className="muted">VAT No. {client.tax_number}</div> : null}
          {client?.address || client?.city ? (
            <div className="muted">
              {[client.address, client.postal_code, client.city, client.country].filter(Boolean).join(", ")}
            </div>
          ) : null}
          {client?.phone || client?.email ? (
            <div className="muted">{[client.phone, client.email].filter(Boolean).join(" · ")}</div>
          ) : null}
        </div>

        <div className="table-wrap invoice-lines">
          <table className="data">
            <thead>
              <tr>
                <th className="col-no">#</th>
                <th>Description</th>
                <th className="num">Qty</th>
                <th className="num">Rate</th>
                <th className="num">Net</th>
                <th className="num">VAT {VAT_RATE}%</th>
                <th className="num">Amount</th>
              </tr>
            </thead>
            <tbody>
              {items.map(
                (it: { id: string; description: string; qty: number; unit_price: number; tax_rate: number }, n: number) => {
                  const rate = Number(it.tax_rate ?? VAT_RATE);
                  const net = lineNet(Number(it.qty), Number(it.unit_price));
                  return (
                    <tr key={it.id}>
                      <td className="col-no">{n + 1}</td>
                      <td className="wrap">{it.description}</td>
                      <td className="num">{qty(it.qty)}</td>
                      <td className="num">{money(it.unit_price, s)}</td>
                      <td className="num">{money(net, s)}</td>
                      <td className="num">{money(vatAmount(net, rate), s)}</td>
                      <td className="num">{money(lineGross(Number(it.qty), Number(it.unit_price), rate), s)}</td>
                    </tr>
                  );
                }
              )}
            </tbody>
          </table>
        </div>

        <div className="invoice-foot">
          <div className="invoice-notes">
            {invoice.notes ? (
              <>
                <div className="bill-label">Notes</div>
                <p>{invoice.notes}</p>
              </>
            ) : null}
            {invoice.terms ? (
              <>
                <div className="bill-label">Terms &amp; conditions</div>
                <p className="muted">{invoice.terms}</p>
              </>
            ) : null}
          </div>
          <div className="totals-box">
            <div>
              <span>Subtotal</span>
              <strong>{money(invoice.subtotal, s)}</strong>
            </div>
            {discount > 0 ? (
              <>
                <div>
                  <span>Discount</span>
                  <strong>−{money(discount, s)}</strong>
                </div>
                <div>
                  <span>Taxable amount</span>
                  <strong>{money(invoice.taxable_amount, s)}</strong>
                </div>
              </>
            ) : null}
            <div>
              <span>VAT {VAT_RATE}%</span>
              <strong>{money(invoice.tax_total || 0, s)}</strong>
            </div>
            <div className="grand">
              <span>Total incl. VAT</span>
              <strong>{money(invoice.grand_total, s)}</strong>
            </div>
            {retention > 0 ? (
              <>
                <div>
                  <span>Retention</span>
                  <strong>−{money(retention, s)}</strong>
                </div>
                <div>
                  <span>Due after retention</span>
                  <strong>{money(invoice.nexora_due, s)}</strong>
                </div>
              </>
            ) : null}
            {!isQuote && paid > 0 ? (
              <>
                <div>
                  <span>Paid</span>
                  <strong>−{money(paid, s)}</strong>
                </div>
                <div className="due">
                  <span>{due < 0 ? "Overpaid" : "Balance due"}</span>
                  <strong>{money(Math.abs(due), s)}</strong>
                </div>
              </>
            ) : null}
          </div>
        </div>
        <footer className="invoice-thanks">Thank you for your business.</footer>
      </article>

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
