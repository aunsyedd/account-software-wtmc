export function money(n: number | string | null | undefined, symbol = "SAR") {
  let v = Number(n || 0);
  if (!Number.isFinite(v)) v = 0;
  // Round half-up to halalas (avoids 1.005 showing as 1.00) and never show "-0.00".
  v = (Math.sign(v) * Math.round(Math.abs(v) * 100 + 1e-7)) / 100 || 0;
  const amount = v.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  if (symbol === "$") return `$${amount}`;
  // Saudi Riyal: the official sign (drawn by the "Saudi Riyal" font in globals.css),
  // placed before the amount with a non-breaking space so it never wraps alone.
  if (RIYAL_ALIASES.has((symbol || "").trim().toUpperCase())) return `${RIYAL_SIGN} ${amount}`;
  return `${amount} ${symbol}`;
}

/** U+20C1 SAUDI RIYAL SIGN. */
export const RIYAL_SIGN = "⃁";
const RIYAL_ALIASES = new Set(["SAR", "SR", "SAR.", "SR.", "ر.س", "ريال", "﷼", RIYAL_SIGN, ""]);

export function qty(n: number | string | null | undefined) {
  const v = Number(n || 0);
  return (Number.isFinite(v) ? v : 0).toLocaleString("en-US", { maximumFractionDigits: 3 });
}

/** Today's date (YYYY-MM-DD) in Saudi time, so dates don't roll back a day between midnight and 3am. */
export function todayISO() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Riyadh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function displayDate(d: string | null | undefined) {
  if (!d) return "";
  const dt = new Date(d + (d.length === 10 ? "T00:00:00" : ""));
  if (Number.isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
