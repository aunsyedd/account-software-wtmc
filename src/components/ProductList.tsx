"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { deleteProduct } from "@/app/actions";
import { PrintButton } from "@/components/PrintButton";
import { PrintHeader } from "@/components/PrintHeader";
import { displayDate, money, qty } from "@/lib/format";
import { sumMoney } from "@/lib/vat";
import { ConfirmDelete } from "@/components/ConfirmDelete";

type Product = {
  id: string;
  name: string;
  description: string | null;
  unique_code: string | null;
  barcode: string | null;
  hsn_code: string | null;
  unit: string;
  unit_selling_price: number;
  unit_purchase_price: number;
  tax_name: string | null;
  tax_rate: number;
  opening_stock: number;
  purchased_units: number;
  sold_units: number;
  available_units: number;
  reorder_level: number;
  track_inventory: boolean;
};

type Sale = {
  id: string;
  invoice_id: string;
  invoice_number: string;
  invoice_date: string;
  client_name: string | null;
  product_id: string | null;
  product_name: string;
  qty: number;
  unit_price: number;
  amount: number;
};

export function ProductList({
  products,
  sales,
  symbol,
  company,
}: {
  products: Product[];
  sales: Sale[];
  symbol: string;
  company: Parameters<typeof PrintHeader>[0]["company"];
}) {
  const [view, setView] = useState<"products" | "inventory" | "summary" | "details">(
    "products"
  );
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return products;
    return products.filter((p) =>
      [p.name, p.description, p.unique_code, p.barcode, p.hsn_code]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(s))
    );
  }, [products, q]);

  const salesFiltered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return sales;
    return sales.filter((row) =>
      [row.product_name, row.invoice_number, row.client_name]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(s))
    );
  }, [sales, q]);

  const viewTitle = {
    products: "Product list",
    inventory: "Inventory",
    summary: "Sales summary by product",
    details: "Sales details",
  }[view];
  const searchNote = q.trim() ? `Filtered by "${q.trim()}"` : "";

  return (
    <>
      <PrintHeader
        company={company}
        title={viewTitle}
        subtitle={[searchNote, displayDate(new Date().toISOString().slice(0, 10))].filter(Boolean).join(" · ")}
      />
      <div className="page-head">
        <h1>Products</h1>
        <div className="no-print" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <PrintButton filename={viewTitle} />
          <Link className="btn btn-green" href="/products/new">
            + Add product
          </Link>
        </div>
      </div>

      <div className="toolbar no-print">
        <label>
          View{" "}
          <select value={view} onChange={(e) => setView(e.target.value as typeof view)}>
            <option value="products">Products</option>
            <option value="inventory">Inventory</option>
            <option value="summary">Sales Summary</option>
            <option value="details">Sales Details</option>
          </select>
        </label>
        <input
          type="search"
          placeholder="Search products, barcode, invoice..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {view === "products" && (
        <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Product</th>
              <th>Description</th>
              <th>Unique code / barcode</th>
              <th>HSN / SAC</th>
              <th className="num">Unit selling price</th>
              <th className="no-print">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="muted">
                  No products yet. Click add product to create your inventory list.
                </td>
              </tr>
            ) : (
              filtered.map((p) => (
                <tr key={p.id}>
                  <td>
                    <Link href={`/products/${p.id}`}>{p.name}</Link>
                  </td>
                  <td className="wrap">{p.description}</td>
                  <td>{p.unique_code || p.barcode}</td>
                  <td>{p.hsn_code}</td>
                  <td className="num">{money(p.unit_selling_price, symbol)}</td>
                  <td className="actions no-print">
                    <Link href={`/products/${p.id}`}>Edit</Link>
                    <Link href={`/expenses/new?type=purchase_bill&product=${p.id}`}>
                      Purchases
                    </Link>
                    <ConfirmDelete action={deleteProduct} id={p.id} what={`product ${p.name}`} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>
      )}

      {view === "inventory" && (
        <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Product</th>
              <th>Unique code</th>
              <th className="num">Selling price</th>
              <th className="num">Purchase price</th>
              <th className="num">Opening</th>
              <th className="num">Purchased units</th>
              <th className="num">Sold units</th>
              <th className="num">Available units</th>
              <th className="num">Reorder level</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => {
              const low =
                p.track_inventory && Number(p.available_units) <= Number(p.reorder_level);
              return (
                <tr key={p.id} className={low ? "low" : undefined}>
                  <td>
                    <Link href={`/products/${p.id}`}>{p.name}</Link>
                  </td>
                  <td>{p.unique_code || p.barcode}</td>
                  <td className="num">{money(p.unit_selling_price, symbol)}</td>
                  <td className="num">{money(p.unit_purchase_price, symbol)}</td>
                  <td className="num">{qty(p.opening_stock)}</td>
                  <td className="num">{qty(p.purchased_units)}</td>
                  <td className="num">{qty(p.sold_units)}</td>
                  <td className="num">{qty(p.available_units)}</td>
                  <td className="num">{qty(p.reorder_level)}</td>
                  <td>
                    <span className={"badge " + (low ? "unpaid" : p.track_inventory ? "paid" : "")}>
                      {low ? "Reorder" : p.track_inventory ? "In stock" : "Not tracked"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      )}

      {view === "summary" && (
        <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Product</th>
              <th className="num">Units sold</th>
              <th className="num">Sales amount</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => {
              const rows = sales.filter((s) => s.product_id === p.id);
              const units = rows.reduce((a, r) => a + Number(r.qty), 0);
              const amount = sumMoney(rows, (r) => r.amount);
              return (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td className="num">{qty(units)}</td>
                  <td className="num">{money(amount, symbol)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      )}

      {view === "details" && (
        <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Date</th>
              <th>Invoice #</th>
              <th>Client</th>
              <th>Product</th>
              <th className="num">Units</th>
              <th className="num">Rate</th>
              <th className="num">Amount</th>
            </tr>
          </thead>
          <tbody>
            {salesFiltered.length === 0 ? (
              <tr>
                <td colSpan={7} className="muted">
                  No sales yet. Generate an invoice to see details here.
                </td>
              </tr>
            ) : (
              salesFiltered.map((s) => (
                <tr key={s.id}>
                  <td>{displayDate(s.invoice_date)}</td>
                  <td>
                    <Link href={`/invoices/${s.invoice_id}`}>{s.invoice_number}</Link>
                  </td>
                  <td>{s.client_name}</td>
                  <td>{s.product_name}</td>
                  <td className="num">{qty(s.qty)}</td>
                  <td className="num">{money(s.unit_price, symbol)}</td>
                  <td className="num">{money(s.amount, symbol)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>
      )}
    </>
  );
}
