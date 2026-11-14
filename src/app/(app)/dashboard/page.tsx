import Link from "next/link";
import { PrintButton } from "@/components/PrintButton";
import { PrintHeader } from "@/components/PrintHeader";
import { SalaryReminders } from "@/components/SalaryReminders";
import { CustomerReminders } from "@/components/CustomerReminders";
import { getCompany } from "@/lib/queries";
import { displayDate, money, qty, todayISO } from "@/lib/format";
import { balanceSheet, balancesAt, get, loadBooks, profitAndLoss, vatFor } from "@/lib/accounts";
import { periodRange, rangeLabel } from "@/lib/periods";
import { salaryStatus } from "@/lib/salary";
import { isSaleInvoice, round2, sumMoney, VAT_RATE } from "@/lib/vat";
import { syncFromNexora } from "@/lib/nexora";

const VAT_PERIODS = [
  { key: "month", label: "This month" },
  { key: "last-month", label: "Last month" },
  { key: "quarter", label: "This quarter" },
  { key: "last-quarter", label: "Last quarter" },
  { key: "year", label: "This year" },
  { key: "all", label: "All time" },
];

export default async function DashboardPage() {
  await syncFromNexora();
  const [books, company] = await Promise.all([loadBooks(), getCompany()]);
  const s = company.currency_symbol;
  const today = todayISO();

  const saleInvoices = books.invoices.filter(isSaleInvoice);
  const sales = sumMoney(saleInvoices, (i) => i.grand_total);
  const spent = sumMoney(books.expenses, (e) => e.grand_total);
  const pl = profitAndLoss(books, "", "");
  const accounts = balancesAt(books, "");
  const bs = balanceSheet(accounts);
  const payable = -get(accounts, "ap");

  const vatRows = VAT_PERIODS.map((p) => {
    const r = periodRange(p.key);
    return { ...p, range: r, ...vatFor(books.invoices, books.expenses, r.from, r.to) };
  });
  const quarter = vatRows.find((r) => r.key === "quarter")!;

  const statuses = books.employees.map((e) => salaryStatus(e, books.salaryPayments));
  const salaryPending = sumMoney(statuses, (st) => st.totalPending);

  const low = books.products.filter(
    (p) => p.track_inventory && Number(p.available_units) <= Number(p.reorder_level)
  );
  const allUnpaid = saleInvoices
    .map((i) => ({ ...i, due: round2(Number(i.grand_total) - Number(i.paid_amount || 0)) }))
    .filter((i) => i.due > 0.004)
    .sort((a, b) => String(a.invoice_date).localeCompare(String(b.invoice_date)));
  const unpaidInvoices = allUnpaid.slice(0, 8);
  const unpaidTotal = sumMoney(allUnpaid, (i) => i.due);

  return (
    <div className="report-sheet">
      <PrintHeader company={company} title="Business overview" subtitle={`As of ${displayDate(today)}`} />
      <div className="page-head">
        <h1>Overview</h1>
        <div className="head-actions no-print">
          <Link className="btn btn-gray" href="/reports">
            All reports
          </Link>
          <PrintButton filename={`Overview ${today}`} />
        </div>
      </div>

      <div className="stats">
        <div className="stat">
          <div className="k">Total invoiced (incl. VAT)</div>
          <div className="v">{money(sales, s)}</div>
        </div>
        <div className="stat">
          <div className="k">Expenses (incl. VAT)</div>
          <div className="v">{money(spent, s)}</div>
        </div>
        <div className="stat">
          <div className="k">Net profit (excl. VAT)</div>
          <div className={"v" + (pl.netProfit < 0 ? " text-danger" : "")}>{money(pl.netProfit, s)}</div>
        </div>
        <div className="stat">
          <div className="k">VAT payable · this quarter</div>
          <div className="v">{money(quarter.net, s)}</div>
        </div>
      </div>

      <div className="stats">
        <div className="stat">
          <div className="k">Customers owe us</div>
          {/* Only what is still due on live invoices; extra or misplaced payments never make it negative. */}
          <div className={"v" + (unpaidTotal > 0.004 ? " text-danger" : "")}>{money(unpaidTotal, s)}</div>
          <div className="hint">
            {allUnpaid.length === 0 ? (
              "All invoices are paid"
            ) : (
              <Link href="/invoices">
                {allUnpaid.length} unpaid invoice{allUnpaid.length === 1 ? "" : "s"} · {money(unpaidTotal, s)}
              </Link>
            )}
          </div>
        </div>
        <div className="stat">
          <div className="k">We owe vendors</div>
          <div className="v">{money(payable, s)}</div>
        </div>
        <div className="stat">
          <div className="k">Salary pending</div>
          <div className={"v" + (salaryPending > 0 ? " text-danger" : "")}>{money(salaryPending, s)}</div>
        </div>
        <div className="stat">
          <div className="k">Stock value (at cost)</div>
          <div className="v">{money(get(accounts, "inventory"), s)}</div>
        </div>
      </div>

      <CustomerReminders invoices={allUnpaid} symbol={s} limit={4} />
      <SalaryReminders statuses={statuses} symbol={s} limit={4} />

      <section className="report-block">
        <div className="section-head">
          <h2 className="report-title">VAT summary ({VAT_RATE}%)</h2>
          <Link className="no-print" href="/reports?period=quarter&view=vat">
            Open VAT return →
          </Link>
        </div>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Period</th>
                <th>Dates</th>
                <th className="num">Sales excl. VAT</th>
                <th className="num">Output VAT</th>
                <th className="num">Purchases excl. VAT</th>
                <th className="num">Input VAT</th>
                <th className="num">Net VAT</th>
              </tr>
            </thead>
            <tbody>
              {vatRows.map((r) => (
                <tr key={r.key}>
                  <td>
                    <Link href={`/reports?period=${r.key}&view=vat`}>{r.label}</Link>
                  </td>
                  <td className="muted">{rangeLabel(r.range.from, r.range.to)}</td>
                  <td className="num">{money(r.salesNet, s)}</td>
                  <td className="num">{money(r.output, s)}</td>
                  <td className="num">{money(r.purchasesNet, s)}</td>
                  <td className="num">{money(r.input, s)}</td>
                  <td className="num">
                    <strong>
                      {money(Math.abs(r.net), s)} {r.net < 0 ? "refund" : r.net > 0 ? "payable" : ""}
                    </strong>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="two-col">
        <section className="report-block">
          <div className="section-head">
            <h2 className="report-title">Financial position</h2>
            <Link className="no-print" href="/reports?view=balance">
              Balance sheet →
            </Link>
          </div>
          <div className="table-wrap">
            <table className="data statement">
              <tbody>
                <tr>
                  <td>Total assets</td>
                  <td className="num">{money(bs.totalAssets, s)}</td>
                </tr>
                <tr>
                  <td>Total liabilities</td>
                  <td className="num">{money(bs.totalLiabilities, s)}</td>
                </tr>
              </tbody>
              <tfoot>
                <tr>
                  <td>Equity (net worth)</td>
                  <td className="num">{money(bs.totalEquity, s)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>

        <section className="report-block">
          <div className="section-head">
            <h2 className="report-title">Unpaid invoices</h2>
            <Link className="no-print" href="/reports?view=parties">
              Receivables →
            </Link>
          </div>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Client</th>
                  <th className="num">Due</th>
                </tr>
              </thead>
              <tbody>
                {unpaidInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="muted">
                      All invoices are paid.
                    </td>
                  </tr>
                ) : (
                  unpaidInvoices.map((i) => (
                    <tr key={i.id}>
                      <td>
                        <Link href={`/invoices/${i.id}`}>{i.number}</Link>
                        <div className="hint">{displayDate(i.invoice_date)}</div>
                      </td>
                      <td>{i.client_name}</td>
                      <td className="num">{money(i.due, s)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <section className="report-block">
        <h2 className="report-title">Reorder alerts</h2>
        {low.length === 0 ? (
          <div className="empty">No products at reorder level.</div>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Product</th>
                  <th className="num">Available</th>
                  <th className="num">Reorder level</th>
                </tr>
              </thead>
              <tbody>
                {low.map((p) => (
                  <tr key={p.id} className="low">
                    <td>
                      <Link href={`/products/${p.id}`}>{p.name}</Link>
                    </td>
                    <td className="num">{qty(p.available_units)}</td>
                    <td className="num">{qty(p.reorder_level)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
