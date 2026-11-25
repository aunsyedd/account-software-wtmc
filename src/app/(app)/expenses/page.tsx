import { ExpenseList } from "@/components/ExpenseList";
import { resolveCategory, summarizeCategories, type ExpenseRow } from "@/lib/expenseFilter";
import { getCategories, getCompany, getExpenses } from "@/lib/queries";

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  // Data is loaded once here. Category filtering then happens in the browser (ExpenseList);
  // ?category= is only read for the first load, so a refresh or shared link keeps the filter.
  const { category } = await searchParams;
  const [allExpenses, company, categories] = await Promise.all([getExpenses(), getCompany(), getCategories()]);

  // Send only the columns the table needs to the client.
  const expenses: ExpenseRow[] = allExpenses.map((e) => ({
    id: e.id,
    number: e.number,
    expense_date: e.expense_date,
    type: e.type,
    vendor_name: e.vendor_name,
    category_name: e.category_name,
    status: e.status,
    grand_total: e.grand_total,
    paid_amount: e.paid_amount,
  }));
  const summary = summarizeCategories(expenses, categories);

  return (
    <ExpenseList
      expenses={expenses}
      company={company}
      summary={summary}
      initialCategory={resolveCategory(category, summary.names)}
    />
  );
}
