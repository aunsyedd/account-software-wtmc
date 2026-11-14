"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { getExpenseBalance, getInvoiceBalance } from "@/lib/queries";
import { signIn, signOut, signUp } from "@/lib/auth";
import { syncFromNexora } from "@/lib/nexora";
import { lineNet, paymentStatus, round2, VAT_NAME, VAT_RATE, vatAmount } from "@/lib/vat";
import { todayISO } from "@/lib/format";

async function nextNumber(kind: "invoice" | "expense") {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc("next_doc_number", { kind });
  if (error) throw error;
  return data as string;
}

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") || "");
  const password = String(formData.get("password") || "");
  const { error } = await signIn(email, password);
  if (error) redirect("/login?error=" + encodeURIComponent(error));
  redirect("/dashboard");
}

export async function signupAction(formData: FormData) {
  const email = String(formData.get("email") || "");
  const password = String(formData.get("password") || "");
  const { error } = await signUp(email, password);
  if (error) redirect("/signup?error=" + encodeURIComponent(error));
  redirect("/dashboard");
}

export async function logoutAction() {
  await signOut();
  redirect("/login");
}

/** Delete one row by id and surface database errors instead of silently ignoring them. */
async function removeRow(table: string, id: string) {
  if (!id) return;
  const supabase = getSupabase();
  const { error } = await supabase.from(table).delete().eq("id", id);
  if (error) throw error;
}

function str(form: FormData, key: string) {
  const v = form.get(key);
  return v == null ? "" : String(v);
}
function num(form: FormData, key: string) {
  const v = str(form, key).trim();
  if (v === "") return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
/** Parse a non-negative number from a form value (bad input becomes 0). */
function nonNeg(v: string | undefined) {
  const n = Number(v || 0);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

async function refreshInvoiceStatus(invoiceId: string) {
  const supabase = getSupabase();
  const inv = await getInvoiceBalance(invoiceId).catch(() => null);
  if (!inv || inv.status === "cancelled" || inv.status === "draft") return;
  const status = paymentStatus(Number(inv.paid_amount || 0), Number(inv.grand_total || 0));
  if (status !== inv.status) {
    await supabase.from("invoices").update({ status }).eq("id", invoiceId);
  }
}

async function refreshExpenseStatus(expenseId: string) {
  const supabase = getSupabase();
  const exp = await getExpenseBalance(expenseId).catch(() => null);
  if (!exp) return;
  const status = paymentStatus(Number(exp.paid_amount || 0), Number(exp.grand_total || 0));
  if (status !== exp.status) {
    await supabase.from("expenses").update({ status }).eq("id", expenseId);
  }
}

export async function saveProduct(formData: FormData) {
  const supabase = getSupabase();
  const id = str(formData, "id");
  const intent = str(formData, "intent") || "exit";
  const payload = {
    name: str(formData, "name"),
    description: str(formData, "description"),
    unique_code: str(formData, "unique_code") || null,
    barcode: str(formData, "barcode") || null,
    hsn_code: str(formData, "hsn_code") || null,
    unit: str(formData, "unit") || "pcs",
    unit_selling_price: round2(Math.max(0, num(formData, "unit_selling_price"))),
    unit_purchase_price: round2(Math.max(0, num(formData, "unit_purchase_price"))),
    tax_name: str(formData, "tax_name") || VAT_NAME,
    tax_rate: num(formData, "tax_rate") || VAT_RATE,
    track_inventory: formData.get("track_inventory") === "on",
    opening_stock: Math.max(0, num(formData, "opening_stock")),
    reorder_level: Math.max(0, num(formData, "reorder_level")),
    updated_at: new Date().toISOString(),
  };
  let productId = id;
  if (id) {
    const { error } = await supabase.from("products").update(payload).eq("id", id);
    if (error) throw error;
  } else {
    const { data, error } = await supabase.from("products").insert(payload).select("id").single();
    if (error) throw error;
    productId = data.id;
  }
  revalidatePath("/products");
  if (intent === "new") redirect("/products/new");
  if (intent === "purchase") redirect(`/expenses/new?type=purchase_bill&product=${productId}`);
  redirect("/products");
}

export async function deleteProduct(formData: FormData) {
  const supabase = getSupabase();
  const id = str(formData, "id");
  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/products");
  redirect("/products");
}

export async function saveClient(formData: FormData) {
  const supabase = getSupabase();
  const id = str(formData, "id");
  const payload = {
    name: str(formData, "name"),
    email: str(formData, "email") || null,
    phone: str(formData, "phone") || null,
    tax_number: str(formData, "tax_number") || null,
    address: str(formData, "address") || null,
    city: str(formData, "city") || null,
    country: str(formData, "country") || null,
    opening_balance: num(formData, "opening_balance"),
    notes: str(formData, "notes") || null,
  };
  if (id) {
    const { error } = await supabase.from("clients").update(payload).eq("id", id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("clients").insert(payload);
    if (error) throw error;
  }
  revalidatePath("/clients");
  redirect("/clients");
}

export async function deleteClient(formData: FormData) {
  await removeRow("clients", str(formData, "id"));
  revalidatePath("/clients");
  redirect("/clients");
}

export async function saveVendor(formData: FormData) {
  const supabase = getSupabase();
  const id = str(formData, "id");
  const payload = {
    name: str(formData, "name"),
    email: str(formData, "email") || null,
    phone: str(formData, "phone") || null,
    tax_number: str(formData, "tax_number") || null,
    address: str(formData, "address") || null,
    city: str(formData, "city") || null,
    country: str(formData, "country") || null,
    opening_balance: num(formData, "opening_balance"),
    notes: str(formData, "notes") || null,
  };
  if (id) {
    const { error } = await supabase.from("vendors").update(payload).eq("id", id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("vendors").insert(payload);
    if (error) throw error;
  }
  revalidatePath("/vendors");
  redirect("/vendors");
}

export async function deleteVendor(formData: FormData) {
  await removeRow("vendors", str(formData, "id"));
  revalidatePath("/vendors");
  redirect("/vendors");
}

/** True when the invoice was synced from Nexora Invoices (edit it there, not here). */
async function isNexoraInvoice(id: string) {
  if (!id) return false;
  const supabase = getSupabase();
  const { data } = await supabase.from("invoices").select("*").eq("id", id).maybeSingle();
  return data?.source === "nexora";
}

export async function syncNexoraNow(formData: FormData) {
  const back = str(formData, "back");
  const target = back.startsWith("/") && !back.startsWith("//") ? back : "/invoices";
  await syncFromNexora({ force: true });
  revalidatePath("/", "layout");
  redirect(target);
}

export async function saveInvoice(formData: FormData) {
  const supabase = getSupabase();
  const id = str(formData, "id");
  if (await isNexoraInvoice(id)) redirect(`/invoices/${id}`);
  const client_id = str(formData, "client_id") || null;
  const payload = {
    title: str(formData, "title") || "Invoice",
    client_id,
    invoice_date: str(formData, "invoice_date") || todayISO(),
    due_date: str(formData, "due_date") || null,
    discount_amount: round2(Math.max(0, num(formData, "discount_amount"))),
    notes: str(formData, "notes") || null,
    terms: str(formData, "terms") || null,
    updated_at: new Date().toISOString(),
  };

  const descriptions = formData.getAll("item_description").map(String);
  const productIds = formData.getAll("item_product_id").map(String);
  const qtys = formData.getAll("item_qty").map(String);
  const prices = formData.getAll("item_unit_price").map(String);
  const taxNames = formData.getAll("item_tax_name").map(String);
  const taxRates = formData.getAll("item_tax_rate").map(String);

  let invoiceId = id;
  if (id) {
    const { error } = await supabase.from("invoices").update(payload).eq("id", id);
    if (error) throw error;
    const cleared = await supabase.from("invoice_items").delete().eq("invoice_id", id);
    if (cleared.error) throw cleared.error;
  } else {
    const number = await nextNumber("invoice");
    const { data, error } = await supabase
      .from("invoices")
      .insert({ ...payload, number, status: "unpaid" })
      .select("id")
      .single();
    if (error) throw error;
    invoiceId = data.id;
  }

  const items = descriptions
    .map((description, i) => ({
      invoice_id: invoiceId,
      product_id: productIds[i] || null,
      description,
      qty: nonNeg(qtys[i]),
      unit_price: round2(nonNeg(prices[i])),
      tax_name: taxNames[i] || VAT_NAME,
      tax_rate: Number(taxRates[i] || VAT_RATE) || VAT_RATE,
      sort_order: i,
    }))
    .filter((row) => row.description || row.product_id);

  if (items.length) {
    const { error } = await supabase.from("invoice_items").insert(items);
    if (error) throw error;
  }

  // Keep paid / partial / unpaid correct when an edited invoice changes its total.
  await refreshInvoiceStatus(invoiceId);

  revalidatePath("/invoices");
  revalidatePath("/products");
  revalidatePath("/dashboard");
  revalidatePath("/reports");
  redirect(`/invoices/${invoiceId}`);
}

export async function deleteInvoice(formData: FormData) {
  // Nexora invoices would just come back on the next sync; delete them in Nexora.
  if (await isNexoraInvoice(str(formData, "id"))) redirect(`/invoices/${str(formData, "id")}`);
  await removeRow("invoices", str(formData, "id"));
  revalidatePath("/invoices");
  revalidatePath("/products");
  revalidatePath("/dashboard");
  revalidatePath("/reports");
  redirect("/invoices");
}

export async function savePayment(formData: FormData) {
  const supabase = getSupabase();
  const invoice_id = str(formData, "invoice_id");
  const amount = round2(num(formData, "amount"));
  if (amount <= 0) redirect(`/invoices/${invoice_id}?error=amount`);
  const { error } = await supabase.from("payments").insert({
    invoice_id,
    amount,
    payment_date: str(formData, "payment_date") || todayISO(),
    payment_mode: str(formData, "payment_mode") || "Cash",
    reference: str(formData, "reference") || null,
    notes: str(formData, "notes") || null,
  });
  if (error) throw error;

  await refreshInvoiceStatus(invoice_id);
  revalidatePath("/invoices");
  revalidatePath("/dashboard");
  revalidatePath("/reports");
  redirect(`/invoices/${invoice_id}`);
}

/** "Paid" button: record one payment for whatever is still owed on the invoice. */
export async function markInvoicePaid(formData: FormData) {
  const supabase = getSupabase();
  const invoice_id = str(formData, "invoice_id");
  const inv = await getInvoiceBalance(invoice_id);
  const owed = round2(Number(inv.grand_total || 0) - Number(inv.paid_amount || 0));
  if (owed > 0) {
    const { error } = await supabase.from("payments").insert({
      invoice_id,
      amount: owed,
      payment_date: str(formData, "payment_date") || todayISO(),
      payment_mode: str(formData, "payment_mode") || "Cash",
      reference: "Marked as paid",
      notes: null,
    });
    if (error) throw error;
  }
  await refreshInvoiceStatus(invoice_id);
  revalidatePath("/invoices");
  revalidatePath("/dashboard");
  revalidatePath("/reports");
  revalidatePath("/clients");
  redirect(`/invoices/${invoice_id}`);
}

/** "Unpaid" button: remove the payments recorded on the invoice so the full amount is owed again. */
export async function markInvoiceUnpaid(formData: FormData) {
  const supabase = getSupabase();
  const invoice_id = str(formData, "id") || str(formData, "invoice_id");
  if (!invoice_id) redirect("/invoices");
  const { error } = await supabase.from("payments").delete().eq("invoice_id", invoice_id);
  if (error) throw error;
  await refreshInvoiceStatus(invoice_id);
  revalidatePath("/invoices");
  revalidatePath("/dashboard");
  revalidatePath("/reports");
  revalidatePath("/clients");
  redirect(`/invoices/${invoice_id}`);
}

export async function saveExpense(formData: FormData) {
  const supabase = getSupabase();
  const id = str(formData, "id");
  const type = str(formData, "type") === "purchase_bill" ? "purchase_bill" : "expense";
  const payload = {
    type,
    vendor_id: str(formData, "vendor_id") || null,
    category_id: str(formData, "category_id") || null,
    expense_date: str(formData, "expense_date") || todayISO(),
    bill_number: str(formData, "bill_number") || null,
    notes: str(formData, "notes") || null,
    updated_at: new Date().toISOString(),
  };

  const descriptions = formData.getAll("item_description").map(String);
  const productIds = formData.getAll("item_product_id").map(String);
  const qtys = formData.getAll("item_qty").map(String);
  const prices = formData.getAll("item_unit_price").map(String);
  const taxRates = formData.getAll("item_tax_rate").map(String);
  const taxNames = formData.getAll("item_tax_name").map(String);

  let expenseId = id;
  if (id) {
    const { error } = await supabase.from("expenses").update(payload).eq("id", id);
    if (error) throw error;
    const cleared = await supabase.from("expense_items").delete().eq("expense_id", id);
    if (cleared.error) throw cleared.error;
  } else {
    const number = await nextNumber("expense");
    const { data, error } = await supabase
      .from("expenses")
      .insert({ ...payload, number, status: "unpaid" })
      .select("id")
      .single();
    if (error) throw error;
    expenseId = data.id;
  }

  const items = descriptions
    .map((description, i) => {
      const qty = nonNeg(qtys[i]);
      const unit_price = round2(nonNeg(prices[i]));
      const tax_rate = Number(taxRates[i] || VAT_RATE) || VAT_RATE;
      const net = lineNet(qty, unit_price);
      return {
        expense_id: expenseId,
        product_id: productIds[i] || null,
        description,
        qty,
        unit_price,
        tax_name: taxNames[i] || VAT_NAME,
        tax_rate,
        tax_amount: vatAmount(net, tax_rate),
        sort_order: i,
      };
    })
    .filter((row) => row.description || row.product_id || row.unit_price);

  if (items.length) {
    let { error } = await supabase.from("expense_items").insert(items);
    if (error) {
      const slim = items.map(({ tax_name: _n, tax_rate: _r, ...rest }) => rest);
      const retry = await supabase.from("expense_items").insert(slim);
      error = retry.error;
    }
    if (error) throw error;
  }

  // Keep paid / partial / unpaid correct when an edited bill changes its total.
  await refreshExpenseStatus(expenseId);

  revalidatePath("/expenses");
  revalidatePath("/products");
  revalidatePath("/dashboard");
  revalidatePath("/reports");
  const intent = str(formData, "intent");
  if (intent === "pay") redirect(`/expenses/${expenseId}?pay=1`);
  if (intent === "new") redirect(`/expenses/new?type=${type}`);
  redirect("/expenses");
}

export async function deleteExpense(formData: FormData) {
  await removeRow("expenses", str(formData, "id"));
  revalidatePath("/expenses");
  revalidatePath("/products");
  revalidatePath("/dashboard");
  revalidatePath("/reports");
  redirect("/expenses");
}

export async function saveExpensePayment(formData: FormData) {
  const supabase = getSupabase();
  const expense_id = str(formData, "expense_id");
  const amount = round2(num(formData, "amount"));
  if (amount <= 0) redirect(`/expenses/${expense_id}?error=amount`);
  const { error } = await supabase.from("expense_payments").insert({
    expense_id,
    amount,
    payment_date: str(formData, "payment_date") || todayISO(),
    payment_mode: str(formData, "payment_mode") || "Cash",
    reference: str(formData, "reference") || null,
  });
  if (error) throw error;
  await refreshExpenseStatus(expense_id);
  revalidatePath("/expenses");
  revalidatePath("/dashboard");
  revalidatePath("/reports");
  redirect(`/expenses/${expense_id}`);
}

export async function saveCategory(formData: FormData) {
  const supabase = getSupabase();
  const name = str(formData, "name").trim();
  if (!name) redirect("/settings");
  const { error } = await supabase.from("expense_categories").insert({ name });
  if (error) throw error;
  revalidatePath("/settings");
  redirect("/settings");
}

export async function deleteCategory(formData: FormData) {
  await removeRow("expense_categories", str(formData, "id"));
  revalidatePath("/settings");
  redirect("/settings");
}

export async function saveCompany(formData: FormData) {
  const supabase = getSupabase();
  const id = str(formData, "id");
  const payload = {
    name: str(formData, "name"),
    legal_name: str(formData, "legal_name") || null,
    email: str(formData, "email") || null,
    phone: str(formData, "phone") || null,
    address: str(formData, "address") || null,
    city: str(formData, "city") || null,
    country: str(formData, "country") || null,
    tax_number: str(formData, "tax_number") || null,
    currency_code: str(formData, "currency_code") || "SAR",
    currency_symbol: str(formData, "currency_symbol") || "SAR",
    invoice_prefix: str(formData, "invoice_prefix") || "INV-",
    default_notes: str(formData, "default_notes") || null,
    default_terms: str(formData, "default_terms") || null,
    vat_name: VAT_NAME,
    vat_rate: VAT_RATE,
    updated_at: new Date().toISOString(),
  };
  let { error } = await supabase.from("company_settings").update(payload).eq("id", id);
  if (error) {
    const { vat_name: _vn, vat_rate: _vr, ...rest } = payload;
    const retry = await supabase.from("company_settings").update(rest).eq("id", id);
    error = retry.error;
  }
  if (error) throw error;
  revalidatePath("/settings");
  redirect("/settings");
}

/** "2026-09" → "2026-09-01"; anything else → "". */
function monthToDate(v: string) {
  const m = v.trim().slice(0, 7);
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(m) ? `${m}-01` : "";
}

/** PostgREST error for a column / table that doesn't exist yet (SQL migration not run). */
function isMissingSchema(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  return ["PGRST204", "PGRST205", "42P01", "42703"].includes(String(error.code)) ||
    /salary_start_month|salary_payments/i.test(String(error.message || ""));
}

export async function saveEmployee(formData: FormData) {
  const supabase = getSupabase();
  const id = str(formData, "id");
  const paidMonth = monthToDate(str(formData, "paid_month"));
  const startMonthInput = monthToDate(str(formData, "salary_start_month"));
  const hireDate = str(formData, "hire_date");
  const gross = round2(
    Math.max(0, num(formData, "basic_salary")) +
      Math.max(0, num(formData, "housing_allowance")) +
      Math.max(0, num(formData, "other_allowance"))
  );
  // New employee: tracking starts at the month they say was last paid (earlier months are settled),
  // otherwise at the hire month. Editing: whatever the "track salary from" field says.
  const salary_start_month = id
    ? startMonthInput || null
    : paidMonth || startMonthInput || (hireDate ? monthToDate(hireDate) : "") || null;
  const payload = {
    name: str(formData, "name"),
    job_title: str(formData, "job_title") || null,
    department: str(formData, "department") || null,
    email: str(formData, "email") || null,
    phone: str(formData, "phone") || null,
    national_id: str(formData, "national_id") || null,
    hire_date: str(formData, "hire_date") || null,
    basic_salary: round2(Math.max(0, num(formData, "basic_salary"))),
    housing_allowance: round2(Math.max(0, num(formData, "housing_allowance"))),
    other_allowance: round2(Math.max(0, num(formData, "other_allowance"))),
    status: str(formData, "status") === "inactive" ? "inactive" : "active",
    notes: str(formData, "notes") || null,
    updated_at: new Date().toISOString(),
  };
  const full = { ...payload, salary_start_month };
  let employeeId = id;
  if (id) {
    let { error } = await supabase.from("employees").update(full).eq("id", id);
    if (isMissingSchema(error)) ({ error } = await supabase.from("employees").update(payload).eq("id", id));
    if (error) throw error;
  } else {
    let res = await supabase.from("employees").insert(full).select("id").single();
    if (isMissingSchema(res.error)) res = await supabase.from("employees").insert(payload).select("id").single();
    if (res.error) throw res.error;
    employeeId = res.data.id;
  }

  let setupNeeded = false;
  if (!id && paidMonth) {
    const paidAmount = round2(num(formData, "paid_amount"));
    const amount = paidAmount > 0 ? paidAmount : gross;
    if (amount > 0) {
      const { error } = await supabase.from("salary_payments").insert({
        employee_id: employeeId,
        salary_month: paidMonth,
        amount,
        payment_date: str(formData, "paid_date") || todayISO(),
        payment_mode: str(formData, "paid_mode") || "Cash",
        notes: "Recorded when the employee was added",
      });
      if (isMissingSchema(error)) setupNeeded = true;
      else if (error) throw error;
    }
  }
  revalidatePath("/employees");
  revalidatePath("/dashboard");
  revalidatePath("/reports");
  redirect(id ? `/employees/${id}` : setupNeeded ? "/employees?setup=salary" : "/employees");
}

export async function deleteEmployee(formData: FormData) {
  await removeRow("employees", str(formData, "id"));
  revalidatePath("/employees");
  revalidatePath("/dashboard");
  revalidatePath("/reports");
  redirect("/employees");
}

export async function saveSalaryPayment(formData: FormData) {
  const supabase = getSupabase();
  const employee_id = str(formData, "employee_id");
  const salary_month = monthToDate(str(formData, "salary_month"));
  const amount = round2(num(formData, "amount"));
  if (!employee_id) redirect("/employees");
  if (!salary_month) redirect(`/employees/${employee_id}?error=month#salary`);
  if (amount <= 0) redirect(`/employees/${employee_id}?error=amount#salary`);
  const { error } = await supabase.from("salary_payments").insert({
    employee_id,
    salary_month,
    amount,
    payment_date: str(formData, "payment_date") || todayISO(),
    payment_mode: str(formData, "payment_mode") || "Cash",
    reference: str(formData, "reference") || null,
    notes: str(formData, "notes") || null,
  });
  if (isMissingSchema(error)) redirect(`/employees/${employee_id}?error=setup#salary`);
  if (error) throw error;
  revalidatePath("/employees");
  revalidatePath("/dashboard");
  revalidatePath("/reports");
  redirect(`/employees/${employee_id}?saved=1#salary`);
}

export async function deleteSalaryPayment(formData: FormData) {
  const supabase = getSupabase();
  const id = str(formData, "id");
  const { data } = await supabase.from("salary_payments").select("employee_id").eq("id", id).maybeSingle();
  await removeRow("salary_payments", id);
  revalidatePath("/employees");
  revalidatePath("/dashboard");
  revalidatePath("/reports");
  redirect(data?.employee_id ? `/employees/${data.employee_id}#salary` : "/employees");
}

export async function deletePayment(formData: FormData) {
  const supabase = getSupabase();
  const id = str(formData, "id");
  const { data } = await supabase.from("payments").select("invoice_id").eq("id", id).maybeSingle();
  await removeRow("payments", id);
  if (data?.invoice_id) await refreshInvoiceStatus(data.invoice_id);
  revalidatePath("/invoices");
  revalidatePath("/dashboard");
  revalidatePath("/reports");
  redirect(data?.invoice_id ? `/invoices/${data.invoice_id}` : "/invoices");
}

export async function deleteExpensePayment(formData: FormData) {
  const supabase = getSupabase();
  const id = str(formData, "id");
  const { data } = await supabase.from("expense_payments").select("expense_id").eq("id", id).maybeSingle();
  await removeRow("expense_payments", id);
  if (data?.expense_id) await refreshExpenseStatus(data.expense_id);
  revalidatePath("/expenses");
  revalidatePath("/dashboard");
  revalidatePath("/reports");
  redirect(data?.expense_id ? `/expenses/${data.expense_id}` : "/expenses");
}
