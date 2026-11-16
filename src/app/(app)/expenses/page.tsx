import Link from "next/link";
import { deleteExpense } from "@/app/actions";
import { PrintButton } from "@/components/PrintButton";
import { displayDate, money } from "@/lib/format";
import { getCompany, getExpenses } from "@/lib/queries";
import { ConfirmDelete } from "@/components/ConfirmDelete";

export default async function ExpensesPage() {
  const [expenses, company] = await Promise.all([getExpenses(), getCompany()]);
  const s = company.currency_symbol;
  return (
    <>
      <div className="page-head">
        <h1>Expenses</h1>
        <div className="no-print" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <PrintButton />
          <Link className="btn btn-green" href="/expenses/choose">
            + Add expense
          </Link>
        </div>
      </div>
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
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {expenses.length === 0 ? (
            <tr>
              <td colSpan={9} className="muted">
                No expenses yet.
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
                  <td>{displayDate(e.expense_date)}</td>
                  <td>{e.type === "purchase_bill" ? "Purchase bill" : "Expense"}</td>
                  <td>{e.vendor_name}</td>
                  <td>{e.category_name}</td>
                  <td>
                    <span className={"badge " + e.status}>{e.status}</span>
                  </td>
                  <td className="num">{money(e.grand_total, s)}</td>
                  <td className="num">{money(e.paid_amount, s)}</td>
                  <td className="actions">
                    <Link href={`/expenses/${e.id}`}>View</Link>
                    <Link href={`/expenses/${e.id}/edit`}>Edit</Link>
                    <ConfirmDelete action={deleteExpense} id={e.id} what={`expense ${e.number}`} />
                  </td>
                </tr>
              )
            )
          )}
        </tbody>
      </table>
      </div>
    </>
  );
}
