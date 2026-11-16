import { getCompany, getExpenses } from "@/lib/queries";
import { displayDate, money, todayISO } from "@/lib/format";
import { PrintButton } from "@/components/PrintButton";
import { PrintHeader } from "@/components/PrintHeader";
import { round2, sumMoney } from "@/lib/vat";

export default async function ExpenseDashboardPage() {
  const [expenses, company] = await Promise.all([getExpenses(), getCompany()]);
  const s = company.currency_symbol;
  const total = sumMoney(expenses, (e) => e.grand_total);
  const avg = expenses.length ? round2(total / expenses.length) : 0;
  const byCat: Record<string, number> = {};
  for (const e of expenses) {
    const name = e.category_name || "Uncategorized";
    byCat[name] = round2((byCat[name] || 0) + Number(e.grand_total || 0));
  }
  return (
    <div className="report-sheet">
      <PrintHeader company={company} title="Expenses by category" subtitle={`All expenses as of ${displayDate(todayISO())}`} />
      <div className="page-head">
        <h1>Expenses dashboard</h1>
        <div className="head-actions no-print">
          <PrintButton filename="Expenses by category" />
        </div>
      </div>
      <div className="stats">
        <div className="stat">
          <div className="k">Total expenses</div>
          <div className="v">{expenses.length}</div>
        </div>
        <div className="stat">
          <div className="k">Total amount</div>
          <div className="v">{money(total, s)}</div>
        </div>
        <div className="stat">
          <div className="k">Average expense</div>
          <div className="v">{money(avg, s)}</div>
        </div>
        <div className="stat">
          <div className="k">Categories</div>
          <div className="v">{Object.keys(byCat).length}</div>
        </div>
      </div>
      <h2 className="report-title">Expense distribution by category</h2>
      <div className="table-wrap">
      <table className="data">
        <thead>
          <tr>
            <th>Category</th>
            <th className="num">Amount</th>
            <th className="num">Share</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(byCat)
            .sort((a, b) => b[1] - a[1])
            .map(([name, amount]) => (
              <tr key={name}>
                <td>{name}</td>
                <td className="num">{money(amount, s)}</td>
                <td className="num">{total ? ((amount / total) * 100).toFixed(1) : 0}%</td>
              </tr>
            ))}
        </tbody>
        {total ? (
          <tfoot>
            <tr>
              <td>
                <strong>Total</strong>
              </td>
              <td className="num">
                <strong>{money(total, s)}</strong>
              </td>
              <td className="num">
                <strong>100%</strong>
              </td>
            </tr>
          </tfoot>
        ) : null}
      </table>
      </div>
    </div>
  );
}
