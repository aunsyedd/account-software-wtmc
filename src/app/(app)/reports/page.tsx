import Link from "next/link";
import { PrintButton } from "@/components/PrintButton";
import { PrintHeader } from "@/components/PrintHeader";
import { SalarySetupNotice } from "@/components/SalarySetupNotice";
import { displayDate, money, qty, todayISO } from "@/lib/format";
import { getCompany } from "@/lib/queries";
import { syncFromNexora } from "@/lib/nexora";
import { balanceSheet, balancesAt, loadBooks, profitAndLoss, trialBalance, vatFor } from "@/lib/accounts";
import { inRange, PERIODS, periodRange, rangeLabel } from "@/lib/periods";
import { currentMonthKey, expectedMonths, monthKey, salaryStatus } from "@/lib/salary";
import { isSaleInvoice, round2, sumMoney, VAT_RATE } from "@/lib/vat";

const VIEWS = [
  { key: "all", label: "All reports" },
  { key: "vat", label: "VAT return" },
  { key: "pl", label: "Profit & loss" },
  { key: "balance", label: "Balance sheet" },
  { key: "trial", label: "Trial balance" },
  { key: "parties", label: "Receivables & payables" },
  { key: "payroll", label: "Payroll" },
  { key: "sales", label: "Sales" },
  { key: "purchases", label: "Purchases" },
  { key: "inventory", label: "Inventory" },
] as const;

type ViewKey = (typeof VIEWS)[number]["key"];

function Amount({ v, s, strong }: { v: number; s: string; strong?: boolean }) {
  const text = v < 0 ? `(${money(-v, s)})` : money(v, s);
  return strong ? <strong>{text}</strong> : <>{text}</>;
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; from?: string; to?: string; view?: string }>;
}) {
  const sp = await searchParams;
  const period = sp.from || sp.to ? "custom" : sp.period || "all";
  const range = periodRange(period, sp.from, sp.to);
  const view = (VIEWS.some((v) => v.key === sp.view) ? sp.view : "all") as ViewKey;
  const show = (k: ViewKey) => view === "all" || view === k;
  await syncFromNexora();

  const [books, company] = await Promise.all([loadBooks(), getCompany()]);
  const s = company.currency_symbol;
  const today = todayISO();
  const periodLabel =
    period === "custom" ? "Custom dates" : PERIODS.find((p) => p.key === period)?.label ?? "All time";
  const dates = rangeLabel(range.from, range.to);
  const asOf = range.to || "";
  const asOfLabel = displayDate(asOf || today);

  const qs = (extra: Record<string, string>) => {
    const p = new URLSearchParams();
    if (period === "custom") {
      if (range.from) p.set("from", range.from);
      if (range.to) p.set("to", range.to);
    } else p.set("period", period);
    if (view !== "all") p.set("view", view);
    for (const [k, v] of Object.entries(extra)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    return "/reports?" + p.toString();
  };

  // ---------- data for each report ----------
  const vat = vatFor(books.invoices, books.expenses, range.from, range.to);
  const pl = profitAndLoss(books, range.from, range.to);
  const accounts = balancesAt(books, asOf);
  const tb = trialBalance(accounts);
  const bs = balanceSheet(accounts);

  const sales = books.invoices
    .filter(isSaleInvoice)
    .filter((i) => inRange(i.invoice_date, range.from, range.to));
  const purchases = books.expenses.filter((e) => inRange(e.expense_date, range.from, range.to));

  // Customer / vendor balances as of the end date.
  const okAsOf = (d: string) => inRange(d, "", asOf);
  const receivables = books.clients
    .map((c) => {
      const inv = books.invoices.filter((i) => isSaleInvoice(i) && i.client_id === c.id && okAsOf(i.invoice_date));
      const ids = new Set(inv.map((i) => i.id));
      const allIds = new Set(books.invoices.filter((i) => i.client_id === c.id).map((i) => i.id));
      const invoiced = sumMoney(inv, (i) => i.grand_total);
      const received = sumMoney(
        books.receipts.filter((r) => allIds.has(r.invoice_id) && okAsOf(r.payment_date)),
        (r) => r.amount
      );
      const opening = round2(c.opening_balance);
      return { id: c.id, name: c.name, count: ids.size, opening, invoiced, received, due: round2(opening + invoiced - received) };
    })
    .filter((r) => r.due !== 0 || r.invoiced !== 0)
    .sort((a, b) => b.due - a.due);
  const payables = books.vendors
    .map((v) => {
      const bills = books.expenses.filter((e) => e.vendor_id === v.id && okAsOf(e.expense_date));
      const ids = new Set(bills.map((e) => e.id));
      const billed = sumMoney(bills, (e) => e.grand_total);
      const paid = sumMoney(
        books.vendorPayments.filter((p) => ids.has(p.expense_id) && okAsOf(p.payment_date)),
        (p) => p.amount
      );
      const opening = round2(v.opening_balance);
      return { id: v.id, name: v.name, count: ids.size, opening, billed, paid, due: round2(opening + billed - paid) };
    })
    .filter((r) => r.due !== 0 || r.billed !== 0)
    .sort((a, b) => b.due - a.due);

  // Payroll for the period.
  const nowMonth = currentMonthKey();
  const fromMonth = monthKey(range.from);
  const toMonthRaw = monthKey(range.to) || nowMonth;
  const toMonth = toMonthRaw < nowMonth ? toMonthRaw : nowMonth;
  const payroll = books.employees.map((emp) => {
    const own = books.salaryPayments.filter((p) => p.employee_id === emp.id);
    let accrued = 0;
    for (const [k, v] of expectedMonths(emp, own, toMonth)) if (!fromMonth || k >= fromMonth) accrued = round2(accrued + v);
    const paid = sumMoney(
      own.filter((p) => inRange(p.payment_date, range.from, range.to)),
      (p) => p.amount
    );
    const st = salaryStatus(emp, books.salaryPayments);
    return { emp, accrued, paid, st };
  });

  const stock = books.products.map((p) => {
    const avail = Number(p.available_units || 0);
    return { ...p, avail, value: round2(Math.max(0, avail) * Number(p.unit_purchase_price || 0)) };
  });

  const heading = view === "all" ? "Financial reports" : VIEWS.find((v) => v.key === view)!.label;

  return (
    <div className="report-sheet">
      <PrintHeader company={company} title={heading} subtitle={`${periodLabel} · ${dates}`} />
      <div className="page-head no-print">
        <div>
          <h1>Reports</h1>
          <p className="hint">
            {periodLabel} · {dates} · VAT {VAT_RATE}%
          </p>
        </div>
        <PrintButton label="Print / Save PDF" filename={`${heading} - ${periodLabel}`} />
      </div>

      <div className="report-controls no-print">
        <div className="chip-row" aria-label="Period">
          {PERIODS.map((p) => (
            <Link
              key={p.key}
              href={qs({ period: p.key, from: "", to: "" })}
              className={"chip" + (period === p.key ? " active" : "")}
            >
              {p.label}
            </Link>
          ))}
        </div>
        <form className="date-form" method="get">
          {view !== "all" ? <input type="hidden" name="view" value={view} /> : null}
          <label>
            <span>From</span>
            <input name="from" type="date" defaultValue={period === "custom" ? range.from : ""} />
          </label>
          <label>
            <span>To</span>
            <input name="to" type="date" defaultValue={period === "custom" ? range.to : ""} />
          </label>
          <button className="btn btn-gray" type="submit">
            Apply dates
          </button>
        </form>
        <nav className="tabs" aria-label="Report">
          {VIEWS.map((v) => (
            <Link key={v.key} href={qs({ view: v.key === "all" ? "" : v.key })} className={"tab" + (view === v.key ? " active" : "")}>
              {v.label}
            </Link>
          ))}
        </nav>
      </div>

      {!books.salaryReady && (show("payroll") || show("pl") || show("balance") || show("trial")) ? <SalarySetupNotice /> : null}

      {show("vat") ? (
        <section className="report-block">
          <h2 className="report-title">VAT return ({VAT_RATE}%)</h2>
          <p className="report-sub">{dates}</p>
          <div className="stats">
            <div className="stat">
              <div className="k">Output VAT (sales)</div>
              <div className="v">{money(vat.output, s)}</div>
            </div>
            <div className="stat">
              <div className="k">Input VAT (purchases)</div>
              <div className="v">{money(vat.input, s)}</div>
            </div>
            <div className="stat">
              <div className="k">Net VAT {vat.net >= 0 ? "payable" : "refundable"}</div>
              <div className="v">{money(Math.abs(vat.net), s)}</div>
            </div>
            <div className="stat">
              <div className="k">Documents</div>
              <div className="v">
                {vat.salesCount} / {vat.billsCount}
              </div>
            </div>
          </div>
          <div className="table-wrap narrow">
            <table className="data statement">
              <thead>
                <tr>
                  <th>Box</th>
                  <th className="num">Amount excl. VAT</th>
                  <th className="num">VAT</th>
                  <th className="num">Total</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Standard-rated sales ({VAT_RATE}%)</td>
                  <td className="num">{money(vat.salesNet, s)}</td>
                  <td className="num">{money(vat.output, s)}</td>
                  <td className="num">{money(vat.salesTotal, s)}</td>
                </tr>
                <tr>
                  <td>Standard-rated purchases &amp; expenses ({VAT_RATE}%)</td>
                  <td className="num">{money(vat.purchasesNet, s)}</td>
                  <td className="num">{money(vat.input, s)}</td>
                  <td className="num">{money(vat.purchasesTotal, s)}</td>
                </tr>
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={2}>Net VAT {vat.net >= 0 ? "payable to ZATCA" : "refundable"}</td>
                  <td className="num">{money(Math.abs(vat.net), s)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="hint">Proforma (quote), draft and cancelled invoices are not included. Salaries carry no VAT.</p>
        </section>
      ) : null}

      {show("pl") ? (
        <section className="report-block">
          <h2 className="report-title">Profit &amp; loss statement</h2>
          <p className="report-sub">{dates} · amounts exclude VAT</p>
          <div className="table-wrap narrow">
            <table className="data statement">
              <tbody>
                <tr className="group">
                  <td colSpan={2}>Revenue</td>
                </tr>
                <tr>
                  <td className="indent">Sales (after discounts)</td>
                  <td className="num">{money(pl.sales, s)}</td>
                </tr>
                <tr className="group">
                  <td colSpan={2}>Cost of sales</td>
                </tr>
                <tr>
                  <td className="indent">Opening stock</td>
                  <td className="num">{money(pl.openingStock, s)}</td>
                </tr>
                <tr>
                  <td className="indent">Add: purchases</td>
                  <td className="num">{money(pl.purchases, s)}</td>
                </tr>
                <tr>
                  <td className="indent">Less: closing stock</td>
                  <td className="num">({money(pl.closingStock, s)})</td>
                </tr>
                <tr className="subtotal">
                  <td>Cost of sales</td>
                  <td className="num">{money(pl.costOfSales, s)}</td>
                </tr>
                <tr className="subtotal">
                  <td>Gross profit</td>
                  <td className="num">
                    <Amount v={pl.grossProfit} s={s} />
                  </td>
                </tr>
                <tr className="group">
                  <td colSpan={2}>Operating expenses</td>
                </tr>
                {pl.expenses.map((e) => (
                  <tr key={e.name}>
                    <td className="indent">{e.name}</td>
                    <td className="num">{money(e.amount, s)}</td>
                  </tr>
                ))}
                <tr>
                  <td className="indent">Salaries &amp; wages</td>
                  <td className="num">{money(pl.salaries, s)}</td>
                </tr>
                <tr className="subtotal">
                  <td>Total operating expenses</td>
                  <td className="num">{money(pl.totalExpenses, s)}</td>
                </tr>
              </tbody>
              <tfoot>
                <tr>
                  <td>Net {pl.netProfit < 0 ? "loss" : "profit"}</td>
                  <td className="num">
                    <Amount v={pl.netProfit} s={s} />
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="hint">
            Salaries are counted for every month in the period from each employee&apos;s salary start month (paid or not).
          </p>
        </section>
      ) : null}

      {show("balance") ? (
        <section className="report-block">
          <h2 className="report-title">Balance sheet</h2>
          <p className="report-sub">As of {asOfLabel}</p>
          <div className="bs-grid">
            <div className="table-wrap">
              <table className="data statement">
                <thead>
                  <tr>
                    <th>Assets</th>
                    <th className="num">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {bs.assets.map((a) => (
                    <tr key={a.name}>
                      <td>
                        {a.name}
                        {a.note ? <div className="hint">{a.note}</div> : null}
                      </td>
                      <td className="num">
                        <Amount v={a.amount} s={s} />
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td>Total assets</td>
                    <td className="num">
                      <Amount v={bs.totalAssets} s={s} />
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <div className="table-wrap">
              <table className="data statement">
                <thead>
                  <tr>
                    <th>Liabilities &amp; equity</th>
                    <th className="num">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {bs.liabilities.map((a) => (
                    <tr key={a.name}>
                      <td>{a.name}</td>
                      <td className="num">
                        <Amount v={a.amount} s={s} />
                      </td>
                    </tr>
                  ))}
                  <tr className="subtotal">
                    <td>Total liabilities</td>
                    <td className="num">
                      <Amount v={bs.totalLiabilities} s={s} />
                    </td>
                  </tr>
                  {bs.equity.map((a) => (
                    <tr key={a.name}>
                      <td>{a.name}</td>
                      <td className="num">
                        <Amount v={a.amount} s={s} />
                      </td>
                    </tr>
                  ))}
                  <tr className="subtotal">
                    <td>Total equity</td>
                    <td className="num">
                      <Amount v={bs.totalEquity} s={s} />
                    </td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr>
                    <td>Total liabilities &amp; equity</td>
                    <td className="num">
                      <Amount v={round2(bs.totalLiabilities + bs.totalEquity)} s={s} />
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
          <p className="hint">
            Built from invoices, bills, payments, salaries and stock recorded in this app. Cash only includes money
            received and paid through the app; amounts in brackets are negative.
          </p>
        </section>
      ) : null}

      {show("trial") ? (
        <section className="report-block">
          <h2 className="report-title">Trial balance</h2>
          <p className="report-sub">As of {asOfLabel}</p>
          <div className="table-wrap narrow">
            <table className="data statement">
              <thead>
                <tr>
                  <th>Account</th>
                  <th>Type</th>
                  <th className="num">Debit</th>
                  <th className="num">Credit</th>
                </tr>
              </thead>
              <tbody>
                {tb.rows.map((r) => (
                  <tr key={r.key}>
                    <td>{r.name}</td>
                    <td className="acct-type">{r.type}</td>
                    <td className="num">{r.debit ? money(r.debit, s) : "—"}</td>
                    <td className="num">{r.credit ? money(r.credit, s) : "—"}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={2}>Total {tb.debit === tb.credit ? "· balanced ✓" : "· out of balance"}</td>
                  <td className="num">{money(tb.debit, s)}</td>
                  <td className="num">{money(tb.credit, s)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      ) : null}

      {show("parties") ? (
        <section className="report-block">
          <h2 className="report-title">Receivables — what customers owe</h2>
          <p className="report-sub">As of {asOfLabel}</p>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th className="num">Invoices</th>
                  <th className="num">Opening</th>
                  <th className="num">Invoiced</th>
                  <th className="num">Received</th>
                  <th className="num">Balance due</th>
                </tr>
              </thead>
              <tbody>
                {receivables.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="muted">
                      Nothing owed by customers.
                    </td>
                  </tr>
                ) : (
                  receivables.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <Link href={`/clients/${r.id}`}>{r.name}</Link>
                      </td>
                      <td className="num">{r.count}</td>
                      <td className="num">{money(r.opening, s)}</td>
                      <td className="num">{money(r.invoiced, s)}</td>
                      <td className="num">{money(r.received, s)}</td>
                      <td className="num">
                        <Amount v={r.due} s={s} strong />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {receivables.length ? (
                <tfoot>
                  <tr>
                    <td>Total</td>
                    <td className="num">{receivables.reduce((n, r) => n + r.count, 0)}</td>
                    <td className="num">{money(sumMoney(receivables, (r) => r.opening), s)}</td>
                    <td className="num">{money(sumMoney(receivables, (r) => r.invoiced), s)}</td>
                    <td className="num">{money(sumMoney(receivables, (r) => r.received), s)}</td>
                    <td className="num">{money(sumMoney(receivables, (r) => r.due), s)}</td>
                  </tr>
                </tfoot>
              ) : null}
            </table>
          </div>

          <h2 className="report-title">Payables — what we owe vendors</h2>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Vendor</th>
                  <th className="num">Bills</th>
                  <th className="num">Opening</th>
                  <th className="num">Billed</th>
                  <th className="num">Paid</th>
                  <th className="num">Balance due</th>
                </tr>
              </thead>
              <tbody>
                {payables.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="muted">
                      Nothing owed to vendors.
                    </td>
                  </tr>
                ) : (
                  payables.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <Link href={`/vendors/${r.id}`}>{r.name}</Link>
                      </td>
                      <td className="num">{r.count}</td>
                      <td className="num">{money(r.opening, s)}</td>
                      <td className="num">{money(r.billed, s)}</td>
                      <td className="num">{money(r.paid, s)}</td>
                      <td className="num">
                        <Amount v={r.due} s={s} strong />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {payables.length ? (
                <tfoot>
                  <tr>
                    <td>Total</td>
                    <td className="num">{payables.reduce((n, r) => n + r.count, 0)}</td>
                    <td className="num">{money(sumMoney(payables, (r) => r.opening), s)}</td>
                    <td className="num">{money(sumMoney(payables, (r) => r.billed), s)}</td>
                    <td className="num">{money(sumMoney(payables, (r) => r.paid), s)}</td>
                    <td className="num">{money(sumMoney(payables, (r) => r.due), s)}</td>
                  </tr>
                </tfoot>
              ) : null}
            </table>
          </div>
        </section>
      ) : null}

      {show("payroll") ? (
        <section className="report-block">
          <h2 className="report-title">Payroll</h2>
          <p className="report-sub">{dates}</p>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Job title</th>
                  <th className="num">Monthly salary</th>
                  <th className="num">Salary for period</th>
                  <th className="num">Paid in period</th>
                  <th className="num">Pending (to date)</th>
                  <th>Oldest unpaid month</th>
                </tr>
              </thead>
              <tbody>
                {payroll.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="muted">
                      No employees yet.
                    </td>
                  </tr>
                ) : (
                  payroll.map(({ emp, accrued, paid, st }) => (
                    <tr key={emp.id}>
                      <td>
                        <Link href={`/employees/${emp.id}`}>{emp.name}</Link>
                        {emp.status === "inactive" ? <span className="muted"> · inactive</span> : null}
                      </td>
                      <td>{(emp as { job_title?: string }).job_title}</td>
                      <td className="num">{money(emp.gross_salary, s)}</td>
                      <td className="num">{money(accrued, s)}</td>
                      <td className="num">{money(paid, s)}</td>
                      <td className={"num" + (st.totalPending > 0 ? " text-danger" : "")}>{money(st.totalPending, s)}</td>
                      <td>{st.nextMonthToPay?.label ?? <span className="muted">Up to date</span>}</td>
                    </tr>
                  ))
                )}
              </tbody>
              {payroll.length ? (
                <tfoot>
                  <tr>
                    <td colSpan={2}>Total</td>
                    <td className="num">
                      {money(
                        sumMoney(
                          payroll.filter((p) => p.emp.status !== "inactive"),
                          (p) => p.emp.gross_salary
                        ),
                        s
                      )}
                    </td>
                    <td className="num">{money(sumMoney(payroll, (p) => p.accrued), s)}</td>
                    <td className="num">{money(sumMoney(payroll, (p) => p.paid), s)}</td>
                    <td className="num">{money(sumMoney(payroll, (p) => p.st.totalPending), s)}</td>
                    <td />
                  </tr>
                </tfoot>
              ) : null}
            </table>
          </div>
        </section>
      ) : null}

      {show("sales") ? (
        <section className="report-block">
          <h2 className="report-title">Sales</h2>
          <p className="report-sub">{dates}</p>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Date</th>
                  <th>Client</th>
                  <th>Status</th>
                  <th className="num">Net</th>
                  <th className="num">VAT {VAT_RATE}%</th>
                  <th className="num">Total</th>
                </tr>
              </thead>
              <tbody>
                {sales.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="muted">
                      No sales in this period.
                    </td>
                  </tr>
                ) : (
                  sales.map((inv) => (
                    <tr key={inv.id}>
                      <td>
                        <Link href={`/invoices/${inv.id}`}>{inv.number}</Link>
                      </td>
                      <td>{displayDate(inv.invoice_date)}</td>
                      <td>{inv.client_name}</td>
                      <td>
                        <span className={"badge " + inv.status}>{inv.status}</span>
                      </td>
                      <td className="num">{money(round2(inv.grand_total - inv.tax_total), s)}</td>
                      <td className="num">{money(inv.tax_total, s)}</td>
                      <td className="num">{money(inv.grand_total, s)}</td>
                    </tr>
                  ))
                )}
              </tbody>
              {sales.length ? (
                <tfoot>
                  <tr>
                    <td colSpan={4}>Total ({sales.length})</td>
                    <td className="num">{money(vat.salesNet, s)}</td>
                    <td className="num">{money(vat.output, s)}</td>
                    <td className="num">{money(vat.salesTotal, s)}</td>
                  </tr>
                </tfoot>
              ) : null}
            </table>
          </div>
        </section>
      ) : null}

      {show("purchases") ? (
        <section className="report-block">
          <h2 className="report-title">Purchases &amp; expenses</h2>
          <p className="report-sub">{dates}</p>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Number</th>
                  <th>Date</th>
                  <th>Vendor</th>
                  <th>Type</th>
                  <th className="num">Net</th>
                  <th className="num">VAT {VAT_RATE}%</th>
                  <th className="num">Total</th>
                </tr>
              </thead>
              <tbody>
                {purchases.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="muted">
                      No purchases in this period.
                    </td>
                  </tr>
                ) : (
                  purchases.map((e) => (
                    <tr key={e.id}>
                      <td>
                        <Link href={`/expenses/${e.id}`}>{e.number}</Link>
                      </td>
                      <td>{displayDate(e.expense_date)}</td>
                      <td>{e.vendor_name}</td>
                      <td>{e.type === "purchase_bill" ? "Purchase bill" : e.category_name || "Expense"}</td>
                      <td className="num">{money(e.subtotal, s)}</td>
                      <td className="num">{money(e.tax_total, s)}</td>
                      <td className="num">{money(e.grand_total, s)}</td>
                    </tr>
                  ))
                )}
              </tbody>
              {purchases.length ? (
                <tfoot>
                  <tr>
                    <td colSpan={4}>Total ({purchases.length})</td>
                    <td className="num">{money(vat.purchasesNet, s)}</td>
                    <td className="num">{money(vat.input, s)}</td>
                    <td className="num">{money(vat.purchasesTotal, s)}</td>
                  </tr>
                </tfoot>
              ) : null}
            </table>
          </div>
        </section>
      ) : null}

      {show("inventory") ? (
        <section className="report-block">
          <h2 className="report-title">Inventory</h2>
          <p className="report-sub">Current stock</p>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Product</th>
                  <th className="num">Opening</th>
                  <th className="num">Purchased</th>
                  <th className="num">Sold</th>
                  <th className="num">Available</th>
                  <th className="num">Unit cost</th>
                  <th className="num">Stock value</th>
                </tr>
              </thead>
              <tbody>
                {stock.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="muted">
                      No products yet.
                    </td>
                  </tr>
                ) : (
                  stock.map((p) => (
                    <tr key={p.id} className={p.track_inventory && p.avail <= Number(p.reorder_level || 0) ? "low" : undefined}>
                      <td>
                        <Link href={`/products/${p.id}`}>{p.name}</Link>
                      </td>
                      <td className="num">{qty(p.opening_stock)}</td>
                      <td className="num">{qty(p.purchased_units)}</td>
                      <td className="num">{qty(p.sold_units)}</td>
                      <td className="num">{qty(p.avail)}</td>
                      <td className="num">{money(p.unit_purchase_price, s)}</td>
                      <td className="num">{money(p.value, s)}</td>
                    </tr>
                  ))
                )}
              </tbody>
              {stock.length ? (
                <tfoot>
                  <tr>
                    <td colSpan={6}>Total stock value</td>
                    <td className="num">{money(sumMoney(stock, (p) => p.value), s)}</td>
                  </tr>
                </tfoot>
              ) : null}
            </table>
          </div>
        </section>
      ) : null}

    </div>
  );
}
