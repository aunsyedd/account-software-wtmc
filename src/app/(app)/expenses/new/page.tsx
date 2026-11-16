import Link from "next/link";
import { saveExpense } from "@/app/actions";
import { LineItems } from "@/components/LineItems";
import { todayISO } from "@/lib/format";
import { getCategories, getCompany, getProducts, getVendors } from "@/lib/queries";
import { SubmitButton } from "@/components/SubmitButton";
import { NO_VAT_CATEGORIES } from "@/lib/vat";

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
  const noVatCategoryIds = categories
    .filter((c: { name: string }) => NO_VAT_CATEGORIES.includes(c.name))
    .map((c: { id: string }) => c.id);
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
      <form action={saveExpense} className="form" style={{ maxWidth: 1100 }}>
        <input type="hidden" name="type" value={isBill ? "purchase_bill" : "expense"} />
        <div className="grid-2">
          <div className="field">
            <label>Vendor</label>
            <select name="vendor_id">
              <option value="">Select vendor</option>
              {vendors.map((v: { id: string; name: string }) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
            <div className="hint">
              New vendor? <Link href="/vendors/new">add vendor</Link>
            </div>
          </div>
          <div className="field">
            <label>Category</label>
            <select name="category_id" defaultValue={isBill ? categories.find((c: { name: string }) => c.name === "Inventory Purchase")?.id : ""}>
              <option value="">Select category</option>
              {categories.map((c: { id: string; name: string }) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Date</label>
            <input name="expense_date" type="date" defaultValue={todayISO()} />
          </div>
          <div className="field">
            <label>Bill number</label>
            <input name="bill_number" />
          </div>
          <div className="field full">
            <label>Notes</label>
            <textarea name="notes" />
          </div>
        </div>
        <h3>Line items</h3>
        <p className="hint">
          With VAT on, 15% is added to each line: a &#x20C1;&nbsp;10.00 purchase becomes &#x20C1;&nbsp;11.50 (rounded to the nearest halala per line).
          Untick the box for costs with no VAT. Professional Fees start with VAT off.
        </p>
        <LineItems
          products={products}
          mode="expense"
          initial={initial}
          symbol={company.currency_symbol}
          noVatCategoryIds={noVatCategoryIds}
        />
        <div className="btn-row">
          <SubmitButton className="btn btn-green" name="intent" value="exit" pendingLabel="Saving…">
            Save &amp; Exit
          </SubmitButton>
          <SubmitButton className="btn btn-orange" name="intent" value="pay" pendingLabel="Saving…">
            Save &amp; Log payment
          </SubmitButton>
          <SubmitButton className="btn btn-gray" name="intent" value="new" pendingLabel="Saving…">
            Save &amp; add new {isBill ? "bill" : "expense"}
          </SubmitButton>
        </div>
      </form>
    </>
  );
}
