"use client";

import Link from "next/link";
import { useMemo, useState, type ComponentProps } from "react";
import { deleteExpense } from "@/app/actions";
import { ConfirmDelete } from "@/components/ConfirmDelete";
import { PrintButton } from "@/components/PrintButton";
import { PrintHeader } from "@/components/PrintHeader";
import { displayDate, money, todayISO } from "@/lib/format";
import { sumMoney } from "@/lib/vat";
import {
  categoryLabel,
  filterByCategory,
  resolveCategory,
  UNCATEGORIZED,
  type CategorySummary,
  type ExpenseRow,
} from "@/lib/expenseFilter";

/**
 * Expenses table with an instant category filter. All rows arrive once from the server;
 * clicking a chip only filters them in the browser (no navigation, no loading screen)
 * and mirrors the choice into ?category= so a refresh or shared link opens on it.
 */
export function ExpenseList({
  expenses: allExpenses,
  company,
  summary,
  initialCategory,
}: {
  expenses: ExpenseRow[];
  company: ComponentProps<typeof PrintHeader>["company"] & { currency_symbol: string };
  summary: CategorySummary;
  initialCategory: string;
}) {
  const [selected, setSelected] = useState(initialCategory);
  const s = company.currency_symbol;
  const { names, counts, uncategorized } = summary;

  // Falls back to All if the chosen category disappears (e.g. its last expense was deleted).
  const active = selected === UNCATEGORIZED && !uncategorized ? "" : resolveCategory(selected, names);
  const activeLabel = categoryLabel(active);

  const expenses = useMemo(() => filterByCategory(allExpenses, active), [allExpenses, active]);
  const { total, paid } = useMemo(
    () => ({
      total: sumMoney(expenses, (e) => e.grand_total),
      paid: sumMoney(expenses, (e) => e.paid_amount),
    }),
    [expenses]
  );

  const choose = (c: string) => {
    setSelected(c);
    const url = new URL(window.location.href);
    if (c) url.searchParams.set("category", c);
    else url.searchParams.delete("category");
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
  };

  const chip = (value: string, text: string, count: number) => (
    <button
      key={value || "__all__"}
      type="button"
      className={"chip" + (active === value ? " active" : "")}
      aria-pressed={active === value}
      onClick={() => choose(value)}
    >
      {text} ({count})
    </button>
  );

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
      {names.length || uncategorized ? (
        <div className="chip-row no-print" aria-label="Filter by category" style={{ marginBottom: 16 }}>
          {chip("", "All", allExpenses.length)}
          {names.map((n) => chip(n, n, counts[n] ?? 0))}
          {uncategorized ? chip(UNCATEGORIZED, "Uncategorized", uncategorized) : null}
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
            expenses.map((e) => (
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
            ))
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
