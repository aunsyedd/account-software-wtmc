/**
 * One-way sync: Nexora Invoices WTMC (nexora-invoices-wtmc, its own Supabase
 * project) → this inventory app.
 *
 *   customers           → clients        (matched on clients.nexora_customer_id)
 *   invoices            → invoices       (matched on invoices.nexora_invoice_id)
 *   invoice_line_items  → invoice_items
 *
 * Nexora is the source of truth for these rows. Payments recorded here are kept.
 * Rows are only written when their Nexora data changed (tracked with nexora_hash).
 *
 * Needs NEXORA_SUPABASE_URL and a key for that project (server-only):
 * NEXORA_SUPABASE_SECRET_KEY, or NEXORA_SUPABASE_ANON_KEY when the invoice
 * project's row-level security lets the anon key read those tables. Also needs
 * supabase/nexora_sync.sql run on the inventory database.
 */
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { getSupabase } from "./supabase";
import { fetchAll } from "./queries";
import { paymentStatus, round2, sumMoney } from "./vat";

export type SyncResult = {
  configured: boolean;
  ok: boolean;
  error?: string;
  at?: number;
  customers?: number;
  invoices?: number;
  changed?: number;
};

type Val = string | number | boolean | null | undefined;
type NexoraCustomer = Record<string, Val> & { id: number };
type NexoraInvoice = Record<string, Val> & { id: number };
type NexoraLine = Record<string, Val> & { id: number; invoice_id: number };

const MIN_GAP_MS = 15_000;
const CHUNK = 500;

let last: SyncResult | null = null;
let inflight: Promise<SyncResult> | null = null;

function nexoraKey() {
  return process.env.NEXORA_SUPABASE_SECRET_KEY || process.env.NEXORA_SUPABASE_ANON_KEY || "";
}

export function nexoraConfigured() {
  return Boolean(process.env.NEXORA_SUPABASE_URL && nexoraKey());
}

/**
 * Pull new / changed customers and invoices from Nexora. Cheap to call on every
 * page load: it runs at most once every few seconds unless `force` is set, and
 * never throws (errors come back in the result).
 */
export async function syncFromNexora({ force = false } = {}): Promise<SyncResult> {
  if (!nexoraConfigured()) return { configured: false, ok: true };
  if (inflight) return inflight;
  if (!force && last?.at && Date.now() - last.at < MIN_GAP_MS) return last;
  inflight = runSync()
    .catch((e): SyncResult => ({ configured: true, ok: false, error: friendly(e), at: Date.now() }))
    .finally(() => {
      inflight = null;
    });
  last = await inflight;
  return last;
}

function nexoraClient() {
  return createClient(process.env.NEXORA_SUPABASE_URL!, nexoraKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function friendly(e: unknown) {
  const err = e as { message?: string; code?: string };
  const msg = err?.message || String(e);
  if (err?.code === "42703" || err?.code === "PGRST204" || /nexora_|column .*source/i.test(msg)) {
    return "The inventory database is missing the sync columns. Run supabase/nexora_sync.sql in the inventory Supabase SQL Editor. (" + msg + ")";
  }
  if (/invalid api key|jwt|unauthorized/i.test(msg)) {
    return "Nexora rejected the key. Check NEXORA_SUPABASE_URL and NEXORA_SUPABASE_SECRET_KEY / NEXORA_SUPABASE_ANON_KEY. (" + msg + ")";
  }
  return msg;
}

function text(v: Val) {
  const s = v == null ? "" : String(v).trim();
  return s;
}
function orNull(v: Val) {
  return text(v) || null;
}
function digest(value: unknown) {
  return createHash("sha1").update(JSON.stringify(value)).digest("hex");
}
function chunks<T>(rows: T[], size = CHUNK) {
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size));
  return out;
}

/** Nexora stores the date as "YYYY-MM-DDTHH:mm" (or an ISO timestamp). */
function isoDate(...candidates: Val[]) {
  for (const c of candidates) {
    const s = text(c);
    if (!s) continue;
    const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
    if (m) return m[1];
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  return new Date().toISOString().slice(0, 10);
}

/** Nexora only charges VAT on lines marked "VAT 15%"; everything else is 0%. */
function lineVatRate(vat: Val) {
  return text(vat) === "VAT 15%" ? 15 : 0;
}

function mapCustomer(c: NexoraCustomer) {
  const address = [
    text(c.building_no) && `Building ${text(c.building_no)}`,
    text(c.street),
    text(c.district),
    text(c.second_no) && `Additional No. ${text(c.second_no)}`,
  ]
    .filter(Boolean)
    .join(", ");
  const notes = [
    text(c.alias_name) && `Alias: ${text(c.alias_name)}`,
    text(c.other_id) && `Other ID: ${text(c.other_id)}`,
    text(c.website) && `Website: ${text(c.website)}`,
    c.active === false && "Inactive in Nexora",
  ]
    .filter(Boolean)
    .join("\n");
  return {
    source: "nexora",
    nexora_customer_id: Number(c.id),
    name: text(c.name) || text(c.alias_name) || `Customer ${c.id}`,
    email: orNull(c.email),
    phone: orNull(c.mobile) || orNull(c.phone),
    tax_number: orNull(c.vat_no),
    address: address || null,
    city: orNull(c.city),
    postal_code: orNull(c.postal_code),
    country: orNull(c.country),
    notes: notes || null,
  };
}

function mapLines(lines: NexoraLine[]) {
  return lines.map((l, i) => {
    const rate = lineVatRate(l.vat);
    return {
      description: text(l.description),
      qty: Number(l.qty) || 0,
      unit_price: round2(Number(l.rate) || 0),
      tax_name: rate ? "VAT" : "No VAT",
      tax_rate: rate,
      sort_order: i,
    };
  });
}

function mapInvoice(inv: NexoraInvoice, clientId: string | null) {
  const net = round2(Number(inv.net_amount) || 0);
  const due = round2(inv.due_amount == null ? net : Number(inv.due_amount) || 0);
  const notes = [
    text(inv.public_note),
    text(inv.description) && text(inv.description) !== text(inv.public_note) && `Description: ${text(inv.description)}`,
    text(inv.project_name) && `Project: ${text(inv.project_name)}`,
    text(inv.po_number) && `PO number: ${text(inv.po_number)}`,
  ]
    .filter(Boolean)
    .join("\n");
  return {
    source: "nexora",
    nexora_invoice_id: Number(inv.id),
    number: text(inv.number) || `NEX-${inv.id}`,
    title: "Tax Invoice",
    client_id: clientId,
    invoice_date: isoDate(inv.date, inv.created_at),
    currency_code: "SAR",
    discount_amount: round2(Math.max(0, Number(inv.discount) || 0)),
    notes: notes || null,
    terms: orNull(inv.payment_terms),
    nexora_customer_id: inv.customer_id == null ? null : Number(inv.customer_id),
    nexora_customer_name: orNull(inv.customer_name),
    nexora_subtotal: round2(Number(inv.total_amount) || 0),
    nexora_vat: round2(Number(inv.vat_amount) || 0),
    nexora_net: net,
    nexora_retention: round2(Math.max(0, net - due)),
    nexora_due: due,
  };
}

type InvoiceRow = ReturnType<typeof mapInvoice> & { nexora_hash: string; updated_at: string };

async function runSync(): Promise<SyncResult> {
  const src = nexoraClient();
  const db = getSupabase();

  const [customers, invoices, lines] = await Promise.all([
    fetchAll<NexoraCustomer>((f, t) => src.from("customers").select("*").order("id").range(f, t)),
    fetchAll<NexoraInvoice>((f, t) => src.from("invoices").select("*").order("id").range(f, t)),
    fetchAll<NexoraLine>((f, t) => src.from("invoice_line_items").select("*").order("id").range(f, t)),
  ]);

  const [localClients, localInvoices] = await Promise.all([
    fetchAll<{ id: string; nexora_customer_id: number; nexora_hash: string | null }>((f, t) =>
      db
        .from("clients")
        .select("id, nexora_customer_id, nexora_hash")
        .not("nexora_customer_id", "is", null)
        .order("id")
        .range(f, t)
    ),
    fetchAll<{ id: string; nexora_invoice_id: number; nexora_hash: string | null; status: string }>((f, t) =>
      db
        .from("invoices")
        .select("id, nexora_invoice_id, nexora_hash, status")
        .not("nexora_invoice_id", "is", null)
        .order("id")
        .range(f, t)
    ),
  ]);

  let changed = 0;

  // ---------------- customers → clients ----------------
  const clientId = new Map(localClients.map((c) => [Number(c.nexora_customer_id), c.id]));
  const clientHash = new Map(localClients.map((c) => [Number(c.nexora_customer_id), c.nexora_hash]));
  const clientRows = customers
    .map((c) => {
      const row = mapCustomer(c);
      return { ...row, nexora_hash: digest(row) };
    })
    .filter((row) => clientHash.get(row.nexora_customer_id) !== row.nexora_hash);

  for (const batch of chunks(clientRows)) {
    const { data, error } = await db
      .from("clients")
      .upsert(batch, { onConflict: "nexora_customer_id" })
      .select("id, nexora_customer_id");
    if (error) throw error;
    for (const r of data ?? []) clientId.set(Number(r.nexora_customer_id), r.id);
  }
  changed += clientRows.length;

  // ---------------- Nexora invoices → invoices ----------------
  const linesByInvoice = new Map<number, NexoraLine[]>();
  for (const l of lines) {
    const k = Number(l.invoice_id);
    const list = linesByInvoice.get(k);
    if (list) list.push(l);
    else linesByInvoice.set(k, [l]);
  }

  const local = new Map(localInvoices.map((i) => [Number(i.nexora_invoice_id), i]));
  const now = new Date().toISOString();
  const pending: { row: InvoiceRow; items: ReturnType<typeof mapLines> }[] = [];
  for (const inv of invoices) {
    const cid = inv.customer_id == null ? null : clientId.get(Number(inv.customer_id)) ?? null;
    const row = mapInvoice(inv, cid);
    const items = mapLines(linesByInvoice.get(Number(inv.id)) ?? []);
    const hash = digest({ row, items });
    const existing = local.get(row.nexora_invoice_id);
    // Re-sync when the data changed, or when it was cancelled here because it had vanished.
    if (existing && existing.nexora_hash === hash && existing.status !== "cancelled") continue;
    pending.push({ row: { ...row, nexora_hash: hash, updated_at: now }, items });
  }

  const savedId = new Map<number, string>();
  for (const batch of chunks(pending)) {
    const rows = batch.map((p) => p.row);
    const { data, error } = await db
      .from("invoices")
      .upsert(rows, { onConflict: "nexora_invoice_id" })
      .select("id, nexora_invoice_id");
    if (!error) {
      for (const r of data ?? []) savedId.set(Number(r.nexora_invoice_id), r.id);
      continue;
    }
    // Usually an invoice number that already exists here: save one by one so the
    // rest still go through, and give clashing numbers a suffix.
    for (const row of rows) {
      let attempt = await db.from("invoices").upsert(row, { onConflict: "nexora_invoice_id" }).select("id").single();
      if (attempt.error?.code === "23505") {
        attempt = await db
          .from("invoices")
          .upsert({ ...row, number: `${row.number} (Nexora ${row.nexora_invoice_id})` }, { onConflict: "nexora_invoice_id" })
          .select("id")
          .single();
      }
      if (attempt.error) throw attempt.error;
      savedId.set(row.nexora_invoice_id, attempt.data.id);
    }
  }

  // Replace line items of every invoice that changed.
  const touched = pending.map((p) => savedId.get(p.row.nexora_invoice_id)).filter(Boolean) as string[];
  try {
    for (const ids of chunks(touched, 100)) {
      const { error } = await db.from("invoice_items").delete().in("invoice_id", ids);
      if (error) throw error;
    }
    const itemRows = pending.flatMap((p) => {
      const invoice_id = savedId.get(p.row.nexora_invoice_id);
      return invoice_id ? p.items.map((it) => ({ ...it, invoice_id, product_id: null })) : [];
    });
    for (const batch of chunks(itemRows)) {
      const { error } = await db.from("invoice_items").insert(batch);
      if (error) throw error;
    }
  } catch (e) {
    // Forget the hashes so the next sync retries these invoices' line items.
    for (const ids of chunks(touched, 100)) {
      await db.from("invoices").update({ nexora_hash: null }).in("id", ids);
    }
    throw e;
  }

  // Paid / partial / unpaid from payments recorded here against Nexora's total.
  if (touched.length) {
    const payments: { invoice_id: string; amount: number }[] = [];
    for (const ids of chunks(touched, 100)) {
      const { data, error } = await db.from("payments").select("invoice_id, amount").in("invoice_id", ids);
      if (error) throw error;
      payments.push(...(data ?? []));
    }
    for (const p of pending) {
      const id = savedId.get(p.row.nexora_invoice_id);
      if (!id) continue;
      const paid = sumMoney(payments.filter((x) => x.invoice_id === id), (x) => x.amount);
      const status = paymentStatus(paid, p.row.nexora_net);
      const before = local.get(p.row.nexora_invoice_id)?.status ?? "unpaid";
      if (status !== before) {
        const { error } = await db.from("invoices").update({ status }).eq("id", id);
        if (error) throw error;
      }
    }
  }
  changed += pending.length;

  // Invoices deleted in Nexora: cancel them here (keeps any payments recorded).
  // Skipped when Nexora returned nothing at all, so a bad key can't wipe the list.
  if (invoices.length > 0) {
    const live = new Set(invoices.map((i) => Number(i.id)));
    const gone = localInvoices
      .filter((i) => !live.has(Number(i.nexora_invoice_id)) && i.status !== "cancelled")
      .map((i) => i.id);
    for (const ids of chunks(gone, 100)) {
      const { error } = await db.from("invoices").update({ status: "cancelled" }).in("id", ids);
      if (error) throw error;
    }
    changed += gone.length;
  }

  return {
    configured: true,
    ok: true,
    at: Date.now(),
    customers: customers.length,
    invoices: invoices.length,
    changed,
  };
}
