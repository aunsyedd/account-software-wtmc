import Link from "next/link";
import { deleteExpensePayment, saveExpensePayment, setExpenseVat } from "@/app/actions";
import { ConfirmDelete } from "@/components/ConfirmDelete";
import { PrintButton } from "@/components/PrintButton";
import { PrintHeader } from "@/components/PrintHeader";
import { displayDate, money, qty, todayISO } from "@/lib/format";
import { getCompany, getExpense } from "@/lib/queries";
import { NO_VAT_NAME, VAT_RATE, lineNet, round2 } from "@/lib/vat";
import { SubmitButton } from "@/components/SubmitButton";

export default async function ExpenseViewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ pay?: string; error?: string }>;
}) {
  const { id } = await params;
  const { pay, error } = await searchParams;
  const [{ expense, items, payments }, company] = await Promise.all([
    getExpense(id),
    getCompany(),
  ]);
  const s = company.currency_symbol;
  const due = round2(Number(expense.grand_total || 0) - Number(expense.paid_amount || 0));

  const vatOn = !items.length || items.some((it: { tax_name: string | null }) => it.tax_name !== NO_VAT_NAME);
  const docTitle = `${expense.type === "purchase_bill" ? "Purchase bill" : "Expense"} ${expense.number}`;
  return (
    <>
      <PrintHeader company={company} title={docTitle} subtitle={displayDate(expense.expense_date)} />
      <div className="page-head">
        <div>
          <h1>{docTitle}</h1>
          <p className="hint no-print">
            <span className={"badge " + expense.status}>{expense.status}</span>
          </p>
        </div>
        <div className="head-actions no-print">
          <PrintButton filename={docTitle + (expense.vendor_name ? " - " + expense.vendor_name : "")} />
          <Link className="btn btn-gray" href="/expenses">
            ← All expenses
          </Link>
        </div>
      </div>
      <div className="card">
        <dl className="meta-grid">
          <div>
            <dt>Vendor</dt>
            <dd>{expense.vendor_name || "—"}</dd>
          </div>
          <div>
            <dt>Category</dt>
            <dd>{expense.category_name || "—"}</dd>
          </div>
          <div>
            <dt>Date</dt>
            <dd>{displayDate(expense.expense_date)}</dd>
          </div>
          <div>
            <dt>VAT</dt>
            <dd>
              {vatOn ? `On (${VAT_RATE}%)` : "Off (no VAT)"}
              {items.length ? (
                <form action={setExpenseVat} className="no-print" style={{ display: "inline", marginLeft: 10 }}>
                  <input type="hidden" name="id" value={id} />
                  <input type="hidden" name="vat" value={vatOn ? "off" : "on"} />
                  <SubmitButton className="btn btn-gray btn-sm" pendingLabel="Saving…">
                    {vatOn ? "Turn VAT off" : "Turn VAT on"}
                  </SubmitButton>
                </form>
              ) : null}
            </dd>
          </div>
          {expense.bill_number ? (
            <div>
              <dt>Vendor bill no.</dt>
              <dd>{expense.bill_number}</dd>
            </div>
          ) : null}
        </dl>
        <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Description</th>
              <th className="num">Qty</th>
              <th className="num">Price</th>
              <th className="num">{vatOn ? `VAT ${VAT_RATE}%` : "VAT"}</th>
              <th className="num">Amount</th>
            </tr>
          </thead>
          <tbody>
            {items.map(
              (it: {
                id: string;
                description: string;
                qty: number;
                unit_price: number;
                tax_amount: number;
              }) => (
                <tr key={it.id}>
                  <td className="wrap">{it.description}</td>
                  <td className="num">{qty(it.qty)}</td>
                  <td className="num">{money(it.unit_price, s)}</td>
                  <td className="num">{money(it.tax_amount, s)}</td>
                  <td className="num">
                    {money(round2(lineNet(Number(it.qty), Number(it.unit_price)) + Number(it.tax_amount || 0)), s)}
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
        </div>
        <div className="totals-box">
          <div>
            <span>Subtotal</span>
            <strong>{money(expense.subtotal, s)}</strong>
          </div>
          <div>
            <span>{vatOn ? `VAT ${VAT_RATE}%` : "VAT (off)"}</span>
            <strong>{money(expense.tax_total || 0, s)}</strong>
          </div>
          <div className="grand">
            <span>{vatOn ? "Total incl. VAT" : "Total"}</span>
            <strong>{money(expense.grand_total, s)}</strong>
          </div>
          <div>
            <span>Paid</span>
            <strong>{money(expense.paid_amount, s)}</strong>
          </div>
          <div>
            <span>{due < 0 ? "Overpaid" : "Balance due"}</span>
            <strong>{money(Math.abs(due), s)}</strong>
          </div>
        </div>
      </div>

      {expense.notes ? <p className="hint">{expense.notes}</p> : null}

      {payments.length ? (
        <>
          <h2 className="report-title">Payments made</h2>
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
                      <td className="actions no-print">
                        <ConfirmDelete action={deleteExpensePayment} id={p.id} what={`this ${money(p.amount, s)} payment`} label="Remove" />
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : null}

      {(pay === "1" || due > 0) && (
        <>
          <h2 className="report-title no-print">Log payment</h2>
          {error === "amount" ? (
            <div className="alert no-print">Payment amount must be more than zero.</div>
          ) : null}
          <form action={saveExpensePayment} className="form no-print" style={{ maxWidth: 900 }}>
            <input type="hidden" name="expense_id" value={id} />
            <div className="grid-2">
              <div className="field">
                <label>Amount</label>
                <input name="amount" type="number" step="0.01" min="0.01" required defaultValue={due > 0 ? due.toFixed(2) : ""} />
              </div>
              <div className="field">
                <label>Payment date</label>
                <input name="payment_date" type="date" defaultValue={todayISO()} />
              </div>
              <div className="field">
                <label>Payment mode</label>
                <select name="payment_mode">
                  <option>Cash</option>
                  <option>Bank</option>
                  <option>Card</option>
                  <option>Cheque</option>
                  <option>Online</option>
                </select>
              </div>
              <div className="field">
                <label>Reference</label>
                <input name="reference" />
              </div>
            </div>
            <SubmitButton className="btn btn-green" pendingLabel="Saving…">
            Save &amp; Exit
          </SubmitButton>
          </form>
        </>
      )}
    </>
  );
}
