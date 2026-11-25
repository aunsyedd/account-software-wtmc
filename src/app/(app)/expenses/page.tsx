import Link from "next/link";
import { deleteExpense } from "@/app/actions";
import { PrintButton } from "@/components/PrintButton";
import { PrintHeader } from "@/components/PrintHeader";
import { sumMoney } from "@/lib/vat";
import { displayDate, money, todayISO } from "@/lib/format";
import { getCategories, getCompany, getExpenses } from "@/lib/queries";
import { ConfirmDelete } from "@/components/ConfirmDelete";

const UNCATEGORIZED = "__none__";

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;
  const [allExpenses, company, categories] = await Promise.all([getExpenses(), getCompany(), getCategories()]);
  const s = company.currency_symbol;

  // Category chips: every saved category, plus any name only found on old expenses.
  const counts = new Map<string, number>();
  let uncategorized = 0;
  for (const e of allExpenses) {
    if (e.category_name) counts.set(e.category_name, (counts.get(e.category_name) ?? 0) + 1);
    else uncategorized++;
  }
  const names = new Set<string>(categories.map((c: { name: string }) => c.name));
  for (const n of counts.keys()) names.add(n);
  const categoryNames = [...names].sort((a, b) => a.localeCompare(b));

  const active = category && (category === UNCATEGORIZED || names.has(category)) ? category : "";
  const expenses = !active
    ? allExpenses
    : allExpenses.filter((e) => (active === UNCATEGORIZED ? !e.category_name : e.category_name === active));
  const activeLabel = active === UNCATEGORIZED ? "Uncategorized" : active;

  const total = sumMoney(expenses, (e) => e.grand_total);
  const paid = sumMoney(expenses, (e) => e.paid_amount);
  const href = (c: string) => (c ? `/expenses?category=${encodeURIComponent(c)}` : "/expenses");
  return (
    <>
      <PrintHeader
        company={company}
        title={activeLabel ? `Expenses · ${activeLabel}` : "Expenses & purchase bills"}
        subtitle={`${expenses.length} records · ${displayDate(todayISO())}`}
      />
      <div className="page-head">
        <h1>Expenses</h1>
        <div className="no-print" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <PrintButton filename={activeLabel ? `Expenses - ${activeLabel}` : "Expenses"} />
          <Link className="btn btn-green" href="/expenses/choose">
            + Add expense
          </Link>
        </div>
      </div>
      {categoryNames.length || uncategorized ? (
        <div className="chip-row no-print" aria-label="Filter by category" style={{ marginBottom: 16 }}>
          <Link href={href("")} className={"chip" + (!active ? " active" : "")}>
            All ({allExpenses.length})
          </Link>
          {categoryNames.map((n) => (
            <Link key={n} href={href(n)} className={"chip" + (active === n ? " active" : "")}>
              {n} ({counts.get(n) ?? 0})
            </Link>
          ))}
          {uncategorized ? (
            <Link href={href(UNCATEGORIZED)} className={"chip" + (active === UNCATEGORIZED ? " active" : "")}>
              Uncategorized ({uncategorized})
            </Link>
          ) : null}
        </div>
      ) : null}
      <div className="table-wrap">
      <table className="data">
        <thead>
          <tr>
            <th>Number</th>
            <th>Date</th>
            <th>Type</th>
            <th>Vendor</th>
            <th>Category</th>
            <th>Status</th>
            <th className="num">Total</th>
            <th className="num">Paid</th>
            <th className="no-print">Actions</th>
          </tr>
        </thead>
        <tbody>
          {expenses.length === 0 ? (
            <tr>
              <td colSpan={9} className="muted">
                {active ? `No ${activeLabel} expenses.` : "No expenses yet."}
              </td>
            </tr>
          ) : (
            expenses.map(
              (e: {
                id: string;
                number: string;
                expense_date: string;
                type: string;
                vendor_name: string | null;
                category_name: string | null;
                status: string;
                grand_total: number;
                paid_amount: number;
              }) => (
                <tr key={e.id}>
                  <td>
                    <Link href={`/expenses/${e.id}`}>{e.number}</Link>
                  </td>
                  <td className="date">{displayDate(e.expense_date)}</td>
                  <td>{e.type === "purchase_bill" ? "Purchase bill" : "Expense"}</td>
                  <td>{e.vendor_name}</td>
                  <td>{e.category_name}</td>
                  <td>
                    <span className={"badge " + e.status}>{e.status}</span>
                  </td>
                  <td className="num">{money(e.grand_total, s)}</td>
                  <td className="num">{money(e.paid_amount, s)}</td>
                  <td className="actions no-print">
                    <Link href={`/expenses/${e.id}`}>View</Link>
                    <Link href={`/expenses/${e.id}/edit`}>Edit</Link>
                    <ConfirmDelete action={deleteExpense} id={e.id} what={`expense ${e.number}`} />
                  </td>
                </tr>
              )
            )
          )}
        </tbody>
        {expenses.length ? (
          <tfoot>
            <tr>
              <td colSpan={6}>
                <strong>Total</strong>
              </td>
              <td className="num">
                <strong>{money(total, s)}</strong>
              </td>
              <td className="num">
                <strong>{money(paid, s)}</strong>
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
