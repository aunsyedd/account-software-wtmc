/**
 * Builds the printed Tax Invoice, laid out exactly like the one on Nexora Invoices
 * (nexora-invoices-wtmc → billing/customer-invoice), including its ZATCA QR code.
 *
 * Invoices synced from Nexora are re-read from Nexora itself so the printout has the
 * fields this app doesn't keep (unit, building no., district, PO no., project…).
 * If Nexora can't be reached, the copy stored here is used instead.
 */
import QRCode from "qrcode";
import { nexoraClient, nexoraConfigured } from "./nexora";
import { lineGross, lineNet, round2, vatAmount } from "./vat";

/** Same seller block Nexora prints (its lib/companyConfig.ts). */
export const SELLER = {
  name: "WASHIKA TABASSUM MARWAH Co.",
  nameAr: "شركة واشيكا تا باسوم مارواه",
  buildingNo: "2954",
  street: "Ash Sharam",
  streetAr: "الشرم",
  district: "Al Fayha Dist.",
  districtAr: "الفيحاء",
  secondNo: "8839",
  postalCode: "22241",
  city: "Jeddah",
  cityAr: "جدة",
  vatId: "314373744200003",
  otherId: "7052441909",
};

export const BANK = {
  bankName: "Saudi National Bank",
  accountNumber: "80700005253108",
  accountName: "شركة واشيكا تبسم مروه / Washika Tabassum Marwah Co.",
  iban: "SA8810000080700005253108",
};

export type TaxInvoiceParty = {
  name?: string;
  nameAr?: string;
  buildingNo?: string;
  street?: string;
  district?: string;
  secondNo?: string;
  postalCode?: string;
  city?: string;
  vatId?: string;
  otherId?: string;
};

export type TaxInvoiceLine = {
  description: string;
  unit: string;
  qty: number;
  rate: number;
  amount: number;
  tax: number;
  total: number;
};

export type TaxInvoiceData = {
  variant: "tax" | "proforma";
  invoiceNumber: string;
  invoiceDate: string; // display, e.g. 30-May-2026
  dueDate: string;
  paymentTerms: string;
  description: string;
  poNumber: string;
  projectName: string;
  publicNote: string;
  amount: number; // line subtotal before discount
  discount: number;
  vat: number;
  net: number; // incl. VAT, after discount
  retentionPercentage: number;
  retention: number;
  due: number;
  lines: TaxInvoiceLine[];
  buyer: TaxInvoiceParty;
  qrSvg: string | null;
  qrError: string | null;
};

// ---------------------------------------------------------------- dates

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const KSA_OFFSET_MS = 3 * 60 * 60 * 1000; // Saudi Arabia is UTC+3 all year.

/**
 * Parses the date formats Nexora stores ("2026-05-30T22:49", "30-05-2026 10:49 PM",
 * ISO timestamps, plain "2026-05-30"). Times without a zone are Saudi local time.
 * Returns the instant as a UTC Date.
 */
function parseDate(value: string | null | undefined): Date | null {
  const s = String(value ?? "").trim().replace(/\s+/g, " ");
  if (!s) return null;
  const ksa = (y: number, m: number, d: number, h = 0, mi = 0, se = 0) => {
    const t = Date.UTC(y, m - 1, d, h, mi, se) - KSA_OFFSET_MS;
    return Number.isNaN(t) ? null : new Date(t);
  };

  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?)?$/);
  if (m) return ksa(+m[1], +m[2], +m[3], +(m[4] ?? 0), +(m[5] ?? 0), +(m[6] ?? 0));

  m = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})(?: (\d{1,2}):(\d{2})(?::(\d{2}))? ?(AM|PM)?)?$/i);
  if (m) {
    let h = +(m[4] ?? 0);
    const p = m[7]?.toUpperCase();
    if (p === "PM" && h !== 12) h += 12;
    if (p === "AM" && h === 12) h = 0;
    return ksa(+m[3], +m[2], +m[1], h, +(m[5] ?? 0), +(m[6] ?? 0));
  }

  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** 30-May-2026, in Saudi local time. */
function formatDate(d: Date | null) {
  if (!d) return "";
  const k = new Date(d.getTime() + KSA_OFFSET_MS);
  return `${k.getUTCDate()}-${MONTHS[k.getUTCMonth()]}-${k.getUTCFullYear()}`;
}

const TERM_LABELS: Record<string, string> = {
  due_on_receipt: "Due Upon Receipt",
  "100_advance": "100% Advance",
  "15_days": "After 15 Days",
  "30_days": "After 30 Days",
  "45_days": "After 45 Days",
  "60_days": "After 60 Days",
  "90_days": "After 90 Days",
};
const TERM_DAYS: Record<string, number> = {
  due_on_receipt: 0,
  "100_advance": 0,
  "15_days": 15,
  "30_days": 30,
  "45_days": 45,
  "60_days": 60,
  "90_days": 90,
};

function addDays(d: Date | null, days: number) {
  return d ? new Date(d.getTime() + days * 86_400_000) : null;
}

// ---------------------------------------------------------------- QR

function tlv(tag: number, value: string) {
  const bytes = Buffer.from(value, "utf8");
  if (bytes.length > 255) throw new Error(`QR field ${tag} is too long.`);
  return Buffer.concat([Buffer.from([tag, bytes.length]), bytes]);
}

/** ZATCA phase-1 QR: TLV (seller, VAT no., timestamp, total incl. VAT, VAT) → Base64. */
export function zatcaPayload(seller: string, vatNo: string, when: Date, total: number, vat: number) {
  return Buffer.concat([
    tlv(1, seller.trim()),
    tlv(2, vatNo.trim()),
    tlv(3, when.toISOString()),
    tlv(4, total.toFixed(2)),
    tlv(5, vat.toFixed(2)),
  ]).toString("base64");
}

async function qrSvg(payload: string) {
  return QRCode.toString(payload, { type: "svg", errorCorrectionLevel: "M", margin: 4 });
}

// ---------------------------------------------------------------- data

type Row = Record<string, unknown>;
const txt = (v: unknown) => (v == null ? "" : String(v).trim());
const num = (v: unknown) => {
  const n = parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : 0;
};

type LocalInput = {
  invoice: Row;
  items: Row[];
  client: Row | null;
};

async function fromNexora(nexoraId: number) {
  if (!nexoraConfigured()) return null;
  const src = nexoraClient();
  const { data: inv, error } = await src.from("invoices").select("*").eq("id", nexoraId).maybeSingle();
  if (error || !inv) return null;
  const [{ data: lines }, { data: customer }] = await Promise.all([
    src.from("invoice_line_items").select("*").eq("invoice_id", nexoraId).order("id"),
    inv.customer_id != null
      ? src.from("customers").select("*").eq("id", inv.customer_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  return { inv: inv as Row, lines: (lines ?? []) as Row[], customer: (customer ?? null) as Row | null };
}

function nexoraData(n: NonNullable<Awaited<ReturnType<typeof fromNexora>>>) {
  const { inv, customer } = n;
  const lines: TaxInvoiceLine[] = n.lines.map((l) => {
    const amount = num(l.amount) || num(l.qty) * num(l.rate);
    const tax = txt(l.vat) === "VAT 15%" ? amount * 0.15 : 0;
    return {
      description: txt(l.description),
      unit: txt(l.unit),
      qty: num(l.qty),
      rate: num(l.rate),
      amount,
      tax,
      total: num(l.total) || amount + tax,
    };
  });
  const amount = num(inv.total_amount);
  const discount = num(inv.discount);
  const vat = num(inv.vat_amount);
  const net = num(inv.net_amount);
  const due = inv.due_amount == null ? net : num(inv.due_amount);
  const terms = txt(inv.payment_terms);
  const date = parseDate(txt(inv.date) || txt(inv.created_at));
  return {
    when: date,
    data: {
      variant: "tax" as const,
      invoiceNumber: txt(inv.number),
      invoiceDate: formatDate(date),
      dueDate: formatDate(addDays(date, TERM_DAYS[terms] ?? 0)),
      paymentTerms: TERM_LABELS[terms] || terms,
      description: txt(inv.description),
      poNumber: txt(inv.po_number),
      projectName: txt(inv.project_name),
      publicNote: txt(inv.public_note),
      amount,
      discount,
      vat,
      net,
      retentionPercentage: num(inv.retention_percentage),
      retention: round2(Math.max(0, net - due)),
      due,
      lines,
      buyer: {
        name: txt(customer?.name) || txt(inv.customer_name),
        nameAr: txt(customer?.alias_name),
        buildingNo: txt(customer?.building_no),
        street: txt(customer?.street),
        district: txt(customer?.district),
        secondNo: txt(customer?.second_no),
        postalCode: txt(customer?.postal_code),
        city: txt(customer?.city),
        vatId: txt(customer?.vat_no),
        otherId: txt(customer?.other_id),
      },
    },
  };
}

function localData({ invoice, items, client }: LocalInput) {
  const fromNexora = invoice.source === "nexora";
  const lines: TaxInvoiceLine[] = items.map((it) => {
    const q = num(it.qty);
    const r = num(it.unit_price);
    const rate = num(it.tax_rate);
    const net = lineNet(q, r);
    return {
      description: txt(it.description),
      unit: "",
      qty: q,
      rate: r,
      amount: net,
      tax: vatAmount(net, rate),
      total: lineGross(q, r, rate),
    };
  });
  const net = num(invoice.grand_total);
  const due = fromNexora && invoice.nexora_due != null ? num(invoice.nexora_due) : net;
  const retention = fromNexora ? num(invoice.nexora_retention) : 0;
  const amount = num(invoice.subtotal);
  const discount = num(invoice.discount_amount);
  const date = parseDate(txt(invoice.invoice_date));
  const terms = txt(invoice.terms);
  const due_date = invoice.due_date
    ? parseDate(txt(invoice.due_date))
    : addDays(date, TERM_DAYS[terms] ?? 0);
  const base = Math.max(0, amount - discount);
  return {
    when: date,
    data: {
      variant: (invoice.title === "Proforma Invoice" ? "proforma" : "tax") as "tax" | "proforma",
      invoiceNumber: txt(invoice.number),
      invoiceDate: formatDate(date),
      dueDate: formatDate(due_date),
      paymentTerms: TERM_LABELS[terms] || terms,
      description: "",
      poNumber: "",
      projectName: "",
      publicNote: txt(invoice.notes),
      amount,
      discount,
      vat: num(invoice.tax_total),
      net,
      retentionPercentage: retention > 0 && base > 0 ? round2((retention / base) * 100) : 0,
      retention,
      due,
      lines,
      buyer: {
        name: txt(invoice.client_name) || txt(client?.name),
        buildingNo: "",
        street: txt(client?.address),
        district: "",
        secondNo: "",
        postalCode: txt(client?.postal_code),
        city: txt(client?.city),
        vatId: txt(client?.tax_number),
        otherId: "",
      },
    },
  };
}

export async function buildTaxInvoice(input: LocalInput): Promise<TaxInvoiceData> {
  const nexoraId = input.invoice.nexora_invoice_id;
  let remote = null;
  if (input.invoice.source === "nexora" && nexoraId != null) {
    try {
      remote = await fromNexora(Number(nexoraId));
    } catch {
      remote = null;
    }
  }
  const { when, data } = remote ? nexoraData(remote) : localData(input);

  let qr: string | null = null;
  let qrError: string | null = null;
  if (data.variant === "tax") {
    try {
      if (!when) throw new Error("Invoice date is missing, so the ZATCA QR code can't be made.");
      qr = await qrSvg(zatcaPayload(SELLER.name, SELLER.vatId, when, data.net, data.vat));
    } catch (e) {
      qrError = e instanceof Error ? e.message : "Unable to generate ZATCA QR code.";
    }
  }
  return { ...data, qrSvg: qr, qrError };
}

export function fmt(n: number) {
  const v = Number.isFinite(n) ? n : 0;
  return (Math.round(v * 100 + (v >= 0 ? 1e-7 : -1e-7)) / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function fmtQty(n: number) {
  return Number.isInteger(n) ? String(n) : String(round2(n));
}
