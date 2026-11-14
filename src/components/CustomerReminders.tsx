import Link from "next/link";
import { displayDate, money, todayISO } from "@/lib/format";
import { sumMoney } from "@/lib/vat";

export type UnpaidInvoice = {
  id: string;
  number: string;
  invoice_date: string;
  client_id: string | null;
  client_name: string | null;
  due: number;
};

function daysSince(iso: string, today: string) {
  const ms = Date.parse(today) - Date.parse(String(iso).slice(0, 10));
  return Number.isFinite(ms) ? Math.max(0, Math.round(ms / 86_400_000)) : 0;
}

/** Group unpaid invoices by customer, biggest balance first. */
export function owingCustomers(invoices: UnpaidInvoice[]) {
  const groups = new Map<string, { key: string; clientId: string | null; name: string; invoices: UnpaidInvoice[] }>();
  for (const inv of invoices) {
    const name = inv.client_name || "Unknown customer";
    const key = inv.client_id || "name:" + name;
    const g = groups.get(key);
    if (g) g.invoices.push(inv);
    else groups.set(key, { key, clientId: inv.client_id, name, invoices: [inv] });
  }
  return [...groups.values()]
    .map((g) => ({
      ...g,
      invoices: g.invoices.sort((a, b) => String(a.invoice_date).localeCompare(String(b.invoice_date))),
      total: sumMoney(g.invoices, (i) => i.due),
    }))
    .sort((a, b) => b.total - a.total);
}

/** "ABC Trading has to pay us 5,000.00 SAR — INV-0012 (01 Oct 2026, 44 days ago): 3,000.00 SAR …" */
export function CustomerReminders({
  invoices,
  symbol = "SAR",
  limit = 5,
}: {
  invoices: UnpaidInvoice[];
  symbol?: string;
  limit?: number;
}) {
  const customers = owingCustomers(invoices);
  if (customers.length === 0) return null;
  const today = todayISO();
  return (
    <div className="reminder reminder-owed">
      <strong>
        Payment reminders · {customers.length} customer{customers.length === 1 ? "" : "s"} still{" "}
        {customers.length === 1 ? "has" : "have"} to pay us
      </strong>
      <ul>
        {customers.map((c) => {
          const shown = c.invoices.slice(0, limit);
          return (
            <li key={c.key}>
              {c.clientId ? <Link href={`/clients/${c.clientId}`}>{c.name}</Link> : <b>{c.name}</b>} has to give us{" "}
              <strong>{money(c.total, symbol)}</strong>
              {c.invoices.length > 1 ? ` for ${c.invoices.length} unpaid invoices` : ""}
              <ul>
                {shown.map((i) => {
                  const days = daysSince(i.invoice_date, today);
                  return (
                    <li key={i.id}>
                      <Link href={`/invoices/${i.id}`}>{i.number}</Link> · {displayDate(i.invoice_date)}
                      {days > 0 ? ` (${days} day${days === 1 ? "" : "s"} ago)` : " (today)"} — {money(i.due, symbol)} unpaid
                    </li>
                  );
                })}
                {c.invoices.length > shown.length ? (
                  <li className="muted">…and {c.invoices.length - shown.length} more invoice(s)</li>
                ) : null}
              </ul>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
