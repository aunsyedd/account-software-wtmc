"use client";

import { useMemo, useState } from "react";
import { money } from "@/lib/format";
import { documentTotals, lineGross, lineNet, round2, VAT_NAME, VAT_RATE, vatAmount } from "@/lib/vat";

type Product = {
  id: string;
  name: string;
  description: string | null;
  unique_code: string | null;
  unit_selling_price: number;
  unit_purchase_price: number;
  tax_name: string | null;
  tax_rate: number;
};

type Item = {
  product_id?: string | null;
  description?: string;
  qty?: number | string;
  unit_price?: number | string;
  tax_name?: string | null;
  tax_rate?: number;
  tax_amount?: number;
};

const emptyRow = (): Item => ({
  description: "",
  qty: 1,
  unit_price: 0,
  tax_name: VAT_NAME,
  tax_rate: VAT_RATE,
  tax_amount: 0,
});

export function LineItems({
  products,
  mode,
  initial,
  initialDiscount = 0,
  symbol = "SAR",
}: {
  products: Product[];
  mode: "invoice" | "expense";
  initial?: Item[];
  initialDiscount?: number;
  symbol?: string;
}) {
  const [discount, setDiscount] = useState<string>(
    Number(initialDiscount || 0) ? String(round2(initialDiscount)) : "0"
  );
  const [rows, setRows] = useState<Item[]>(
    initial && initial.length
      ? initial.map((row) => ({
          ...row,
          tax_name: VAT_NAME,
          tax_rate: VAT_RATE,
          tax_amount: vatAmount(lineNet(Number(row.qty || 0), Number(row.unit_price || 0))),
        }))
      : [emptyRow()]
  );
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  function update(i: number, patch: Partial<Item>) {
    setRows((prev) =>
      prev.map((row, idx) => {
        if (idx !== i) return row;
        const next = { ...row, ...patch, tax_name: VAT_NAME, tax_rate: VAT_RATE };
        next.tax_amount = vatAmount(lineNet(Number(next.qty || 0), Number(next.unit_price || 0)));
        return next;
      })
    );
  }

  function pick(i: number, p: Product) {
    update(i, {
      product_id: p.id,
      description: p.description ? `${p.name} — ${p.description}` : p.name,
      unit_price: mode === "invoice" ? Number(p.unit_selling_price) : Number(p.unit_purchase_price),
      qty: 1,
    });
    setOpenIndex(null);
  }

  const suggestions = (text: string) => {
    const s = text.trim().toLowerCase();
    if (!s) return products.slice(0, 8);
    return products
      .filter((p) =>
        [p.name, p.description, p.unique_code].filter(Boolean).some((v) =>
          String(v).toLowerCase().includes(s)
        )
      )
      .slice(0, 8);
  };

  const totals = useMemo(
    () =>
      documentTotals(
        rows.map((r) => ({ qty: r.qty, unit_price: r.unit_price, tax_rate: VAT_RATE })),
        mode === "invoice" ? Number(discount || 0) : 0
      ),
    [rows, discount, mode]
  );
  const discountTooBig = mode === "invoice" && round2(Number(discount || 0)) > totals.subtotal;

  return (
    <div>
      <div className="table-wrap">
      <table className="data">
        <thead>
          <tr>
            <th>Description</th>
            <th className="num">Qty</th>
            <th className="num">Unit price</th>
            <th className="num">VAT {VAT_RATE}%</th>
            <th className="num">Line total</th>
            <th className="no-print"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const net = lineNet(Number(row.qty || 0), Number(row.unit_price || 0));
            const vat = vatAmount(net);
            return (
              <tr key={i}>
                <td>
                  <div className="suggest">
                    <input type="hidden" name="item_product_id" value={row.product_id || ""} />
                    <input type="hidden" name="item_tax_name" value={VAT_NAME} />
                    <input type="hidden" name="item_tax_rate" value={String(VAT_RATE)} />
                    <input type="hidden" name="item_tax_amount" value={String(vat.toFixed(2))} />
                    <input
                      name="item_description"
                      value={row.description || ""}
                      placeholder="Start typing to pick a product"
                      onChange={(e) => {
                        update(i, { description: e.target.value, product_id: "" });
                        setOpenIndex(i);
                      }}
                      onFocus={() => setOpenIndex(i)}
                      onBlur={() => setOpenIndex((cur) => (cur === i ? null : cur))}
                      onKeyDown={(e) => {
                        if (e.key === "Escape") setOpenIndex(null);
                      }}
                      autoComplete="off"
                    />
                    {openIndex === i ? (
                      <div className="suggest-list">
                        {suggestions(row.description || "").map((p) => (
                          <button
                            type="button"
                            key={p.id}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              pick(i, p);
                            }}
                          >
                            <strong>{p.name}</strong>
                            {p.unique_code ? ` · ${p.unique_code}` : ""}
                          </button>
                        ))}
                        <button
                          type="button"
                          className="suggest-typed"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setOpenIndex(null);
                          }}
                        >
                          Use typed description
                        </button>
                      </div>
                    ) : null}
                  </div>
                </td>
                <td>
                  <input
                    name="item_qty"
                    type="number"
                    step="0.001"
                    min="0"
                    value={row.qty ?? 1}
                    onChange={(e) => update(i, { qty: e.target.value })}
                    className="w-full"
                  />
                </td>
                <td>
                  <input
                    name="item_unit_price"
                    type="number"
                    step="0.01"
                    min="0"
                    value={row.unit_price ?? 0}
                    onChange={(e) => update(i, { unit_price: e.target.value })}
                    className="w-full"
                  />
                </td>
                <td className="num">{money(vat, symbol)}</td>
                <td className="num">
                  {money(lineGross(Number(row.qty || 0), Number(row.unit_price || 0)), symbol)}
                </td>
                <td className="no-print">
                  <button
                    className="icon-btn"
                    type="button"
                    aria-label="Remove line"
                    title="Remove line"
                    onClick={() => setRows((prev) => (prev.length === 1 ? [emptyRow()] : prev.filter((_, idx) => idx !== i)))}
                  >
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
      <div className="btn-row">
        <button
          className="btn btn-gray no-print"
          type="button"
          onClick={() => setRows((prev) => [...prev, emptyRow()])}
        >
          + Add line
        </button>
        <div className="totals-box">
          <div>
            <span>Subtotal</span>
            <strong>{money(totals.subtotal, symbol)}</strong>
          </div>
          {mode === "invoice" ? (
            <>
              <div>
                <span>Discount (before VAT)</span>
                <input
                  name="discount_amount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                  style={{ maxWidth: 140, textAlign: "right" }}
                />
              </div>
              {discountTooBig ? (
                <div className="hint text-danger">
                  Discount is larger than the subtotal; it will be capped at {money(totals.subtotal, symbol)}.
                </div>
              ) : null}
              {totals.discount > 0 ? (
                <div>
                  <span>Taxable amount</span>
                  <strong>{money(totals.taxable, symbol)}</strong>
                </div>
              ) : null}
            </>
          ) : null}
          <div>
            <span>VAT {VAT_RATE}%</span>
            <strong>{money(totals.vat, symbol)}</strong>
          </div>
          <div className="grand">
            <span>Total incl. VAT</span>
            <strong>{money(totals.total, symbol)}</strong>
          </div>
        </div>
      </div>
    </div>
  );
}
