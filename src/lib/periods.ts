import { displayDate, todayISO } from "./format";

export const PERIODS = [
  { key: "month", label: "This month" },
  { key: "last-month", label: "Last month" },
  { key: "quarter", label: "This quarter" },
  { key: "last-quarter", label: "Last quarter" },
  { key: "year", label: "This year" },
  { key: "all", label: "All time" },
] as const;

export function iso(y: number, m: number, d: number) {
  return new Date(Date.UTC(y, m, d)).toISOString().slice(0, 10);
}

/** The day before a YYYY-MM-DD date. */
export function dayBefore(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return iso(y, m - 1, d - 1);
}

export function periodRange(period: string, from?: string, to?: string) {
  if (from || to) return { from: from || "", to: to || "" };
  const [y, m] = todayISO().split("-").map(Number);
  const mi = m - 1;
  switch (period) {
    case "month":
      return { from: iso(y, mi, 1), to: iso(y, mi + 1, 0) };
    case "last-month":
      return { from: iso(y, mi - 1, 1), to: iso(y, mi, 0) };
    case "quarter": {
      const q = Math.floor(mi / 3) * 3;
      return { from: iso(y, q, 1), to: iso(y, q + 3, 0) };
    }
    case "last-quarter": {
      const q = Math.floor(mi / 3) * 3 - 3;
      return { from: iso(y, q, 1), to: iso(y, q + 3, 0) };
    }
    case "year":
      return { from: iso(y, 0, 1), to: iso(y, 11, 31) };
    default:
      return { from: "", to: "" };
  }
}

export function inRange(date: string | null | undefined, from: string, to: string) {
  const d = String(date || "").slice(0, 10);
  if (from && d < from) return false;
  if (to && d > to) return false;
  return true;
}

export function rangeLabel(from: string, to: string) {
  if (!from && !to) return "All dates";
  return `${from ? displayDate(from) : "Start"} – ${to ? displayDate(to) : "Today"}`;
}
