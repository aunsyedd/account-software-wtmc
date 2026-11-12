import { getSupabase } from "./supabase";
import { documentTotals, lineGross, lineNet, NON_SALE_TITLES, round2, sumMoney } from "./vat";

type Row = Record<string, unknown>;
type PageResult = PromiseLike<{ data: unknown[] | null; error: unknown }>;

/**
 * Supabase returns at most 1000 rows per request. Fetch every page so totals
 * on dashboards and reports are never silently cut off.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fetchAll<T = any>(page: (from: number, to: number) => PageResult): Promise<T[]> {
  const size = 1000;
  const out: T[] = [];
  for (let from = 0; ; from += size) {
    const { data, error } = await page(from, from + size - 1);
    if (error) throw error;
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < size) break;
  }
  return out;
}

type InvoiceItemLite = { invoice_id: string; qty: number; unit_price: number; tax_rate: number };
type ExpenseItemLite = { expense_id: string; qty: number; unit_price: number; tax_amount: number };

/** Recalculate invoice money from its line items (per-line VAT rounding, discount before VAT). */
function applyInvoiceTotals<T extends Row>(invoice: T, items: InvoiceItemLite[]) {
  const client_name = invoice.client_name ?? invoice.nexora_customer_name ?? null;
  // Invoices synced from Nexora Invoices keep the exact totals Nexora calculated.
  if (invoice.source === "nexora" && invoice.nexora_net != null) {
    const subtotal = round2(invoice.nexora_subtotal as number);
    const discount = round2(invoice.discount_amount as number);
    return {
      ...invoice,
      client_name,
      subtotal,
      discount_amount: discount,
      taxable_amount: round2(subtotal - discount),
      tax_total: round2(invoice.nexora_vat as number),
      grand_total: round2(invoice.nexora_net as number),
      paid_amount: round2(invoice.paid_amount as number),
    };
  }
  const t = documentTotals(items, Number(invoice.discount_amount || 0));
  return {
    ...invoice,
    client_name,
    subtotal: t.subtotal,
    discount_amount: t.discount,
    taxable_amount: t.taxable,
    tax_total: t.vat,
    grand_total: t.total,
    paid_amount: round2(invoice.paid_amount as number),
  };
}

/** Recalculate expense money from its line items (VAT is stored per line). */
function applyExpenseTotals<T extends Row>(expense: T, items: ExpenseItemLite[]) {
  const subtotal = sumMoney(items, (i) => lineNet(Number(i.qty), Number(i.unit_price)));
  const tax_total = sumMoney(items, (i) => i.tax_amount);
  return {
    ...expense,
    subtotal,
    tax_total,
    grand_total: round2(subtotal + tax_total),
    paid_amount: round2(expense.paid_amount as number),
  };
}

function groupBy<T extends Row>(rows: T[], key: keyof T) {
  const map = new Map<string, T[]>();
  for (const r of rows) {
    const k = String(r[key]);
    const list = map.get(k);
    if (list) list.push(r);
    else map.set(k, [r]);
  }
  return map;
}

export async function getCompany() {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("company_settings")
    .select("*")
    .limit(1)
    .single();
  if (error) throw error;
  return data;
}

export async function getProducts() {
  const supabase = getSupabase();
  return fetchAll((from, to) =>
    supabase.from("product_inventory").select("*").order("name").order("id").range(from, to)
  );
}

export async function getProduct(id: string) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("product_inventory")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

export async function getClients() {
  const supabase = getSupabase();
  return fetchAll((from, to) =>
    supabase.from("clients").select("*").order("name").order("id").range(from, to)
  );
}

export async function getVendors() {
  const supabase = getSupabase();
  return fetchAll((from, to) =>
    supabase.from("vendors").select("*").order("name").order("id").range(from, to)
  );
}

export async function getCategories() {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("expense_categories")
    .select("*")
    .order("name");
  if (error) throw error;
  return data ?? [];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getInvoices(): Promise<any[]> {
  const supabase = getSupabase();
  const [invoices, items] = await Promise.all([
    fetchAll((from, to) =>
      supabase
        .from("invoice_totals")
        .select("*")
        .order("invoice_date", { ascending: false })
        .order("number", { ascending: false })
        .range(from, to)
    ),
    fetchAll<InvoiceItemLite>((from, to) =>
      supabase.from("invoice_items").select("invoice_id, qty, unit_price, tax_rate").order("id").range(from, to)
    ),
  ]);
  const byInvoice = groupBy(items, "invoice_id");
  return invoices.map((inv) => applyInvoiceTotals(inv, byInvoice.get(String(inv.id)) ?? []));
}

export async function getInvoice(id: string) {
  const supabase = getSupabase();
  const { data: invoice, error } = await supabase
    .from("invoice_totals")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  const { data: items } = await supabase
    .from("invoice_items")
    .select("*")
    .eq("invoice_id", id)
    .order("sort_order");
  const { data: payments } = await supabase
    .from("payments")
    .select("*")
    .eq("invoice_id", id)
    .order("payment_date");
  const { data: client } = invoice.client_id
    ? await supabase.from("clients").select("*").eq("id", invoice.client_id).maybeSingle()
    : { data: null };
  return {
    invoice: applyInvoiceTotals(invoice, items ?? []),
    items: items ?? [],
    payments: payments ?? [],
    client: client as Record<string, string | number | null> | null,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getExpenses(): Promise<any[]> {
  const supabase = getSupabase();
  const [expenses, items] = await Promise.all([
    fetchAll((from, to) =>
      supabase
        .from("expense_totals")
        .select("*")
        .order("expense_date", { ascending: false })
        .order("number", { ascending: false })
        .range(from, to)
    ),
    fetchAll<ExpenseItemLite>((from, to) =>
      supabase.from("expense_items").select("expense_id, qty, unit_price, tax_amount").order("id").range(from, to)
    ),
  ]);
  const byExpense = groupBy(items, "expense_id");
  return expenses.map((e) => applyExpenseTotals(e, byExpense.get(String(e.id)) ?? []));
}

export async function getExpense(id: string) {
  const supabase = getSupabase();
  const { data: expense, error } = await supabase
    .from("expense_totals")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  const { data: items } = await supabase
    .from("expense_items")
    .select("*")
    .eq("expense_id", id)
    .order("sort_order");
  const { data: payments } = await supabase
    .from("expense_payments")
    .select("*")
    .eq("expense_id", id)
    .order("payment_date");
  return {
    expense: applyExpenseTotals(expense, items ?? []),
    items: items ?? [],
    payments: payments ?? [],
  };
}

/** Grand total and paid amount for one invoice, calculated the same way as everywhere else. */
export async function getInvoiceBalance(id: string) {
  const { invoice } = await getInvoice(id);
  return invoice as { status: string; grand_total: number; paid_amount: number };
}

/** Grand total and paid amount for one expense, calculated the same way as everywhere else. */
export async function getExpenseBalance(id: string) {
  const { expense } = await getExpense(id);
  return expense as { status: string; grand_total: number; paid_amount: number };
}

export async function getEmployees() {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("employee_payroll")
    .select("*")
    .order("name");
  if (error) {
    const fallback = await supabase.from("employees").select("*").order("name");
    if (fallback.error) throw fallback.error;
    return (fallback.data ?? []).map((e: Record<string, unknown>) => ({
      ...e,
      gross_salary: round2(
        Number(e.basic_salary || 0) +
          Number(e.housing_allowance || 0) +
          Number(e.other_allowance || 0)
      ),
    }));
  }
  return data ?? [];
}

export async function getEmployee(id: string) {
  const employees = await getEmployees();
  return employees.find((e: { id: string }) => e.id === id) ?? null;
}

export async function getSalesDetails() {
  const supabase = getSupabase();
  const [rows, quotes] = await Promise.all([
    fetchAll((from, to) =>
      supabase
        .from("sales_details")
        .select("*")
        .order("invoice_date", { ascending: false })
        .order("id")
        .range(from, to)
    ),
    // Proforma invoices are quotes, not sales.
    fetchAll<{ id: string }>((from, to) =>
      supabase.from("invoices").select("id").in("title", NON_SALE_TITLES).order("id").range(from, to)
    ),
  ]);
  const skip = new Set(quotes.map((q) => q.id));
  return rows
    .filter((r) => !skip.has(r.invoice_id))
    .map((r) => ({ ...r, amount: lineGross(Number(r.qty), Number(r.unit_price)) }));
}
