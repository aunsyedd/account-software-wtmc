/**
 * Category-filter helpers for the Expenses list. Shared by the server page (first load)
 * and the ExpenseList client component (instant filtering), so keep this file free of
 * "use client" and of server-only imports.
 */

/** Chip / URL value for expenses with no category. */
export const UNCATEGORIZED = "__none__";

export type ExpenseRow = {
  id: string;
  number: string;
  expense_date: string;
  type: string;
  vendor_name: string | null;
  category_name: string | null;
  status: string;
  grand_total: number;
  paid_amount: number;
};

export type CategorySummary = {
  /** Every saved category plus any name only found on old expenses, sorted A–Z. */
  names: string[];
  /** Expense count per category name. */
  counts: Record<string, number>;
  /** Expenses with no category. */
  uncategorized: number;
};

export function summarizeCategories(
  expenses: Pick<ExpenseRow, "category_name">[],
  savedCategories: { name: string }[]
): CategorySummary {
  const counts: Record<string, number> = {};
  let uncategorized = 0;
  for (const e of expenses) {
    if (e.category_name) counts[e.category_name] = (counts[e.category_name] ?? 0) + 1;
    else uncategorized++;
  }
  const names = new Set<string>(savedCategories.map((c) => c.name));
  for (const n of Object.keys(counts)) names.add(n);
  return { names: [...names].sort((a, b) => a.localeCompare(b)), counts, uncategorized };
}

/** The category to show, or "" for All when the value is missing or unknown. */
export function resolveCategory(value: string | null | undefined, names: string[]) {
  return value && (value === UNCATEGORIZED || names.includes(value)) ? value : "";
}

export function filterByCategory<T extends Pick<ExpenseRow, "category_name">>(rows: T[], active: string) {
  if (!active) return rows;
  return rows.filter((e) => (active === UNCATEGORIZED ? !e.category_name : e.category_name === active));
}

export function categoryLabel(active: string) {
  return active === UNCATEGORIZED ? "Uncategorized" : active;
}
