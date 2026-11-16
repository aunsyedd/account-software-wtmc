import Link from "next/link";
import { ExpenseForm } from "@/components/ExpenseForm";
import { getCategories, getCompany, getExpense, getProducts, getVendors } from "@/lib/queries";
import { NO_VAT_NAME } from "@/lib/vat";

export default async function EditExpensePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [{ expense, items }, vendors, categories, products, company] = await Promise.all([
    getExpense(id),
    getVendors(),
    getCategories(),
    getProducts(),
    getCompany(),
  ]);
  const isBill = expense.type === "purchase_bill";
  const vatOn = !items.length || items.some((it: { tax_name: string | null }) => it.tax_name !== NO_VAT_NAME);
  const initial = items.map(
    (it: { product_id: string | null; description: string; qty: number; unit_price: number; tax_amount: number }) => ({
      product_id: it.product_id,
      description: it.description,
      qty: Number(it.qty),
      unit_price: Number(it.unit_price),
      tax_amount: Number(it.tax_amount || 0),
    })
  );

  return (
    <>
      <div className="page-head">
        <h1>
          Edit {isBill ? "purchase bill" : "expense"} {expense.number}
        </h1>
        <Link className="btn btn-gray" href={`/expenses/${id}`}>
          ← Back
        </Link>
      </div>
      <ExpenseForm
        vendors={vendors}
        categories={categories}
        products={products}
        symbol={company.currency_symbol}
        isBill={isBill}
        expense={expense}
        initial={initial}
        initialVatOn={vatOn}
      />
    </>
  );
}
