export const VAT_RATE = 15;
export const VAT_NAME = "VAT";

/** Titles that are quotes, not real sales: they don't move stock or count as sales/VAT. */
export const NON_SALE_TITLES = ["Proforma Invoice"];

export function isSaleInvoice(inv: { title?: string | null; status?: string | null }) {
  if (inv.status === "cancelled" || inv.status === "draft") return false;
  return !NON_SALE_TITLES.includes(String(inv.title || ""));
}

/**
 * Round to 2 decimals (halalas) using half-up rounding that is safe against
 * binary floating-point errors (e.g. 1.005 -> 1.01, not 1.00).
 */
export function round2(n: number | string | null | undefined) {
  const v = Number(n || 0);
  if (!Number.isFinite(v)) return 0;
  const sign = v < 0 ? -1 : 1;
  return (sign * Math.round(Math.abs(v) * 100 + 1e-7)) / 100;
}

/** Sum money values without accumulating floating-point drift. */
export function sumMoney<T>(rows: T[], pick: (row: T) => number | string | null | undefined) {
  const cents = rows.reduce((acc, row) => acc + Math.round(round2(pick(row)) * 100), 0);
  return cents / 100;
}

/** Line amount before VAT, rounded to 2 decimals. */
export function lineNet(qty: number, unitPrice: number) {
  return round2(Number(qty || 0) * Number(unitPrice || 0));
}

/** VAT on a net amount, rounded to 2 decimals. */
export function vatAmount(net: number, rate = VAT_RATE) {
  return round2((Number(net || 0) * Number(rate || 0)) / 100);
}

export function lineGross(qty: number, unitPrice: number, rate = VAT_RATE) {
  const net = lineNet(qty, unitPrice);
  return round2(net + vatAmount(net, rate));
}

/**
 * Document totals. VAT is calculated and rounded per line; a document-level
 * discount reduces the taxable amount, so the VAT on the discount is removed too.
 */
export function documentTotals(
  lines: { qty?: number | string | null; unit_price?: number | string | null; tax_rate?: number | string | null }[],
  discount = 0
) {
  let subtotalCents = 0;
  let vatCents = 0;
  for (const l of lines) {
    const net = lineNet(Number(l.qty || 0), Number(l.unit_price || 0));
    subtotalCents += Math.round(net * 100);
    vatCents += Math.round(vatAmount(net, Number(l.tax_rate ?? VAT_RATE)) * 100);
  }
  const subtotal = subtotalCents / 100;
  const disc = Math.min(Math.max(round2(discount), 0), subtotal);
  const discountVat = vatAmount(disc);
  const vat = round2(vatCents / 100 - discountVat);
  const taxable = round2(subtotal - disc);
  const total = round2(taxable + vat);
  return { subtotal, discount: disc, taxable, vat, total };
}

/** Status from paid vs total, tolerant of sub-halala differences. */
export function paymentStatus(paid: number, total: number) {
  const p = round2(paid);
  const t = round2(total);
  if (t > 0 && p >= t) return "paid";
  if (p > 0) return "partial";
  return "unpaid";
}
