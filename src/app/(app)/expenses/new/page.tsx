import Link from "next/link";
import { ExpenseForm } from "@/components/ExpenseForm";
import { getCategories, getCompany, getProducts, getVendors } from "@/lib/queries";

export default async function NewExpensePage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; product?: string }>;
}) {
  const { type, product } = await searchParams;
  const isBill = type === "purchase_bill";
  const [vendors, categories, products, company] = await Promise.all([
    getVendors(),
    getCategories(),
    getProducts(),
    getCompany(),
  ]);
  const picked = products.find((p: { id: string }) => p.id === product);
  const initial = picked
    ? [
        {
          product_id: picked.id,
          description: picked.name,
          qty: 1,
          unit_price: Number(picked.unit_purchase_price || 0),
          tax_amount: 0,
        },
      ]
    : undefined;

  return (
    <>
      <div className="page-head">
        <h1>{isBill ? "Log a purchase bill" : "Log an expense"}</h1>
        <Link className="btn btn-gray" href="/expenses">
          ← Back
        </Link>
      </div>
      <ExpenseForm
        vendors={vendors}
        categories={categories}
        products={products}
        symbol={company.currency_symbol}
        isBill={isBill}
        initial={initial}
      />
    </>
  );
}
