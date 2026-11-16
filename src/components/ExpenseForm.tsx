import Link from "next/link";
import { saveExpense } from "@/app/actions";
import { LineItems } from "@/components/LineItems";
import { SubmitButton } from "@/components/SubmitButton";
import { todayISO } from "@/lib/format";
import { NO_VAT_CATEGORIES } from "@/lib/vat";

type Named = { id: string; name: string };

type ExpenseValues = {
  id?: string;
  type?: string;
  vendor_id?: string | null;
  category_id?: string | null;
  expense_date?: string | null;
  bill_number?: string | null;
  notes?: string | null;
};

type InitialItem = {
  product_id?: string | null;
  description?: string;
  qty?: number | string;
  unit_price?: number | string;
  tax_amount?: number;
};

/** Expense / purchase bill form, shared by "Log an expense" and "Edit expense". */
export function ExpenseForm({
  vendors,
  categories,
  products,
  symbol,
  isBill,
  expense,
  initial,
  initialVatOn = true,
}: {
  vendors: Named[];
  categories: Named[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  products: any[];
  symbol: string;
  isBill: boolean;
  expense?: ExpenseValues;
  initial?: InitialItem[];
  initialVatOn?: boolean;
}) {
  const editing = Boolean(expense?.id);
  const noVatCategoryIds = categories.filter((c) => NO_VAT_CATEGORIES.includes(c.name)).map((c) => c.id);
  const defaultCategory = editing
    ? expense?.category_id || ""
    : isBill
      ? categories.find((c) => c.name === "Inventory Purchase")?.id || ""
      : "";

  return (
    <form action={saveExpense} className="form" style={{ maxWidth: 1100 }}>
      {editing ? <input type="hidden" name="id" value={expense!.id} /> : null}
      <input type="hidden" name="type" value={isBill ? "purchase_bill" : "expense"} />
      <div className="grid-2">
        <div className="field">
          <label>Vendor</label>
          <select name="vendor_id" defaultValue={expense?.vendor_id || ""}>
            <option value="">Select vendor</option>
            {vendors.map((v) => (
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
          <select name="category_id" defaultValue={defaultCategory}>
            <option value="">Select category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Date</label>
          <input name="expense_date" type="date" defaultValue={expense?.expense_date || todayISO()} />
        </div>
        <div className="field">
          <label>Bill number</label>
          <input name="bill_number" defaultValue={expense?.bill_number || ""} />
        </div>
        <div className="field full">
          <label>Notes</label>
          <textarea name="notes" defaultValue={expense?.notes || ""} />
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
        symbol={symbol}
        initialVatOn={initialVatOn}
        noVatCategoryIds={noVatCategoryIds}
      />
      <div className="btn-row">
        {editing ? (
          <SubmitButton className="btn btn-green" name="intent" value="view" pendingLabel="Saving…">
            Save changes
          </SubmitButton>
        ) : (
          <SubmitButton className="btn btn-green" name="intent" value="exit" pendingLabel="Saving…">
            Save &amp; Exit
          </SubmitButton>
        )}
        <SubmitButton className="btn btn-orange" name="intent" value="pay" pendingLabel="Saving…">
          Save &amp; Log payment
        </SubmitButton>
        {editing ? null : (
          <SubmitButton className="btn btn-gray" name="intent" value="new" pendingLabel="Saving…">
            Save &amp; add new {isBill ? "bill" : "expense"}
          </SubmitButton>
        )}
      </div>
    </form>
  );
}
