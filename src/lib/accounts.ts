import { getSupabase } from "./supabase";
import { fetchAll, getClients, getEmployees, getExpenses, getInvoices, getProducts, getVendors } from "./queries";
import { dayBefore, inRange } from "./periods";
import { currentMonthKey, expectedMonths, getSalaryPayments, monthKey, type SalaryEmployee, type SalaryPayment } from "./salary";
import { isSaleInvoice, round2, sumMoney } from "./vat";

/**
 * Books derived from the documents in the app (there is no manual journal).
 *
 *   Sale invoice      Dr Receivables (total)      Cr Sales (net)  Cr Output VAT
 *   Customer receipt  Dr Cash & bank              Cr Receivables
 *   Bill / expense    Dr Purchases or Expense (net) Dr Input VAT   Cr Payables (total)
 *   Vendor payment    Dr Payables                 Cr Cash & bank
 *   Monthly salary    Dr Salaries & wages         Cr Salaries payable
 *   Salary payment    Dr Salaries payable         Cr Cash & bank
 *   Opening balances  client / vendor balances and opening stock → Opening balance equity
 *   Stock (periodic)  Inventory at cost; the change in stock adjusts cost of sales
 *
 * Every entry has equal debits and credits, so the trial balance always balances.
 */

type Money = number;

export type Books = {
  invoices: Row[];
  expenses: Row[];
  receipts: { invoice_id: string; amount: Money; payment_date: string }[];
  vendorPayments: { expense_id: string; amount: Money; payment_date: string }[];
  salaryPayments: SalaryPayment[];
  salaryReady: boolean;
  employees: SalaryEmployee[];
  clients: Row[];
  vendors: Row[];
  products: Row[];
  invoiceItems: { invoice_id: string; product_id: string | null; qty: number }[];
  expenseItems: { expense_id: string; product_id: string | null; qty: number }[];
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = any;

export async function loadBooks(): Promise<Books> {
  const supabase = getSupabase();
  const [invoices, expenses, receipts, vendorPayments, salary, employees, clients, vendors, products, invoiceItems, expenseItems] =
    await Promise.all([
      getInvoices(),
      getExpenses(),
      fetchAll((f, t) => supabase.from("payments").select("invoice_id, amount, payment_date").order("id").range(f, t)),
      fetchAll((f, t) => supabase.from("expense_payments").select("expense_id, amount, payment_date").order("id").range(f, t)),
      getSalaryPayments(),
      getEmployees().catch(() => []),
      getClients(),
      getVendors(),
      getProducts(),
      fetchAll((f, t) => supabase.from("invoice_items").select("invoice_id, product_id, qty").order("id").range(f, t)),
      fetchAll((f, t) => supabase.from("expense_items").select("expense_id, product_id, qty").order("id").range(f, t)),
    ]);
  return {
    invoices,
    expenses,
    receipts,
    vendorPayments,
    salaryPayments: salary.payments,
    salaryReady: salary.ready,
    employees: employees as SalaryEmployee[],
    clients,
    vendors,
    products,
    invoiceItems,
    expenseItems,
  };
}

const upTo = (asOf: string) => (d: string | null | undefined) => inRange(d, "", asOf);

/** Stock value at cost on a date ("" = before any document, i.e. opening stock only). */
export function stockValue(b: Books, asOf: string | null) {
  const qty = new Map<string, number>();
  for (const p of b.products) qty.set(p.id, Number(p.opening_stock || 0));
  if (asOf !== null) {
    const ok = upTo(asOf);
    const sales = new Set(b.invoices.filter((i) => isSaleInvoice(i) && ok(i.invoice_date)).map((i) => i.id));
    const bills = new Set(
      b.expenses.filter((e) => e.type === "purchase_bill" && ok(e.expense_date)).map((e) => e.id)
    );
    for (const it of b.invoiceItems) {
      if (it.product_id && sales.has(it.invoice_id) && qty.has(it.product_id))
        qty.set(it.product_id, qty.get(it.product_id)! - Number(it.qty || 0));
    }
    for (const it of b.expenseItems) {
      if (it.product_id && bills.has(it.expense_id) && qty.has(it.product_id))
        qty.set(it.product_id, qty.get(it.product_id)! + Number(it.qty || 0));
    }
  }
  return sumMoney(b.products, (p) => round2(Math.max(0, qty.get(p.id) ?? 0) * Number(p.unit_purchase_price || 0)));
}

export type AccountType = "asset" | "liability" | "equity" | "income" | "expense";
export type Account = { key: string; name: string; type: AccountType; balance: Money /* debit + / credit − */ };

/** Cumulative account balances up to and including `asOf` (YYYY-MM-DD, "" = everything). */
export function balancesAt(b: Books, asOf: string): Account[] {
  const ok = upTo(asOf);
  const sales = b.invoices.filter((i) => isSaleInvoice(i) && ok(i.invoice_date));
  const bills = b.expenses.filter((e) => ok(e.expense_date));
  const receipts = b.receipts.filter((r) => ok(r.payment_date));
  const vendorPaid = b.vendorPayments.filter((p) => ok(p.payment_date));
  const salaryPaid = b.salaryPayments.filter((p) => ok(p.payment_date));

  const salesTotal = sumMoney(sales, (i) => i.grand_total);
  const outputVat = sumMoney(sales, (i) => i.tax_total);
  const salesNet = round2(salesTotal - outputVat);

  const billsTotal = sumMoney(bills, (e) => e.grand_total);
  const inputVat = sumMoney(bills, (e) => e.tax_total);
  const purchases = sumMoney(
    bills.filter((e) => e.type === "purchase_bill"),
    (e) => e.subtotal
  );
  const opex = new Map<string, number>();
  for (const e of bills.filter((x) => x.type !== "purchase_bill")) {
    const name = e.category_name || "General expenses";
    opex.set(name, round2((opex.get(name) || 0) + Number(e.subtotal || 0)));
  }

  // Salary accrues for every month up to the as-of month (never beyond the current month).
  const today = currentMonthKey();
  const asOfMonth = asOf ? monthKey(asOf) : today;
  const salaryMonth = asOfMonth && asOfMonth < today ? asOfMonth : today;
  let salaries = 0;
  for (const emp of b.employees) {
    const own = b.salaryPayments.filter((p) => p.employee_id === emp.id);
    for (const v of expectedMonths(emp, own, salaryMonth).values()) salaries = round2(salaries + v);
  }
  const salaryPaidTotal = sumMoney(salaryPaid, (p) => p.amount);

  const clientOpening = sumMoney(b.clients, (c) => c.opening_balance);
  const vendorOpening = sumMoney(b.vendors, (v) => v.opening_balance);
  const openingStock = stockValue(b, null);
  const closingStock = stockValue(b, asOf || "9999-12-31");

  const received = sumMoney(receipts, (r) => r.amount);
  const paidVendors = sumMoney(vendorPaid, (p) => p.amount);

  const accounts: Account[] = [
    { key: "cash", name: "Cash & bank", type: "asset", balance: round2(received - paidVendors - salaryPaidTotal) },
    { key: "ar", name: "Accounts receivable (customers)", type: "asset", balance: round2(salesTotal + clientOpening - received) },
    { key: "inventory", name: "Inventory (stock at cost)", type: "asset", balance: closingStock },
    { key: "vat_in", name: "Input VAT (on purchases)", type: "asset", balance: inputVat },
    { key: "ap", name: "Accounts payable (vendors)", type: "liability", balance: -round2(billsTotal + vendorOpening - paidVendors) },
    { key: "vat_out", name: "Output VAT (on sales)", type: "liability", balance: -outputVat },
    { key: "salaries_payable", name: "Salaries payable", type: "liability", balance: -round2(salaries - salaryPaidTotal) },
    {
      key: "opening_equity",
      name: "Opening balances (owner's equity)",
      type: "equity",
      balance: -round2(openingStock + clientOpening - vendorOpening),
    },
    { key: "sales", name: "Sales (excl. VAT, after discounts)", type: "income", balance: -salesNet },
    { key: "purchases", name: "Purchases (excl. VAT)", type: "expense", balance: purchases },
    { key: "stock_change", name: "Change in stock (closing − opening)", type: "expense", balance: -round2(closingStock - openingStock) },
    ...[...opex.entries()]
      .sort((a, b2) => a[0].localeCompare(b2[0]))
      .map(([name, v]) => ({ key: "opex:" + name, name, type: "expense" as const, balance: v })),
    { key: "salaries", name: "Salaries & wages", type: "expense", balance: salaries },
  ];
  return accounts;
}

export function get(accounts: Account[], key: string) {
  return accounts.find((a) => a.key === key)?.balance ?? 0;
}

export function trialBalance(accounts: Account[]) {
  const rows = accounts
    .filter((a) => a.balance !== 0 || ["cash", "ar", "ap", "sales"].includes(a.key))
    .map((a) => ({ ...a, debit: a.balance > 0 ? a.balance : 0, credit: a.balance < 0 ? -a.balance : 0 }));
  return {
    rows,
    debit: sumMoney(rows, (r) => r.debit),
    credit: sumMoney(rows, (r) => r.credit),
  };
}

/** Profit and loss for [from, to]: movements of income / expense accounts in the period. */
export function profitAndLoss(b: Books, from: string, to: string) {
  const end = balancesAt(b, to);
  const start = from ? balancesAt(b, dayBefore(from)) : null;
  const move = (key: string) => round2(get(end, key) - (start ? get(start, key) : 0));
  const sales = -move("sales");
  const openingStock = from ? stockValue(b, dayBefore(from)) : stockValue(b, null);
  const closingStock = stockValue(b, to || "9999-12-31");
  const purchases = move("purchases");
  const costOfSales = round2(openingStock + purchases - closingStock);
  const grossProfit = round2(sales - costOfSales);
  const expenses = end
    .filter((a) => a.key.startsWith("opex:"))
    .map((a) => ({ name: a.name, amount: move(a.key) }))
    .filter((e) => e.amount !== 0);
  const salaries = move("salaries");
  const totalExpenses = round2(sumMoney(expenses, (e) => e.amount) + salaries);
  const netProfit = round2(grossProfit - totalExpenses);
  return { sales, openingStock, purchases, closingStock, costOfSales, grossProfit, expenses, salaries, totalExpenses, netProfit };
}

export function balanceSheet(accounts: Account[]) {
  const cash = get(accounts, "cash");
  const ar = get(accounts, "ar");
  const inventory = get(accounts, "inventory");
  const vatNet = round2(get(accounts, "vat_in") + get(accounts, "vat_out")); // + = refundable
  const ap = -get(accounts, "ap");
  const salariesPayable = -get(accounts, "salaries_payable");
  const opening = -get(accounts, "opening_equity");
  const profit = -round2(
    accounts.filter((a) => a.type === "income" || a.type === "expense").reduce((s, a) => s + Math.round(a.balance * 100), 0) / 100
  );

  const assets = [
    { name: "Cash & bank", amount: cash, note: cash < 0 ? "Negative: more was paid out than received in the app (e.g. owner funded)." : "" },
    { name: "Accounts receivable (customers)", amount: ar, note: "" },
    { name: "Inventory (stock at cost)", amount: inventory, note: "" },
    ...(vatNet > 0 ? [{ name: "VAT refundable", amount: vatNet, note: "" }] : []),
    ...(salariesPayable < 0 ? [{ name: "Salary advances", amount: -salariesPayable, note: "" }] : []),
  ];
  const liabilities = [
    { name: "Accounts payable (vendors)", amount: ap, note: "" },
    ...(vatNet <= 0 ? [{ name: "VAT payable", amount: -vatNet, note: "" }] : []),
    ...(salariesPayable >= 0 ? [{ name: "Salaries payable", amount: salariesPayable, note: "" }] : []),
  ];
  const equity = [
    { name: "Opening balances (owner's equity)", amount: opening, note: "" },
    { name: "Retained profit (to date)", amount: profit, note: "" },
  ];
  const totalAssets = sumMoney(assets, (a) => a.amount);
  const totalLiabilities = sumMoney(liabilities, (a) => a.amount);
  const totalEquity = sumMoney(equity, (a) => a.amount);
  return { assets, liabilities, equity, totalAssets, totalLiabilities, totalEquity };
}

/** VAT for a date range, using the same rules as the VAT return. */
export function vatFor(invoices: Row[], expenses: Row[], from: string, to: string) {
  const sales = invoices.filter((i) => isSaleInvoice(i) && inRange(i.invoice_date, from, to));
  const bills = expenses.filter((e) => inRange(e.expense_date, from, to));
  const output = sumMoney(sales, (i) => i.tax_total);
  const input = sumMoney(bills, (e) => e.tax_total);
  const salesTotal = sumMoney(sales, (i) => i.grand_total);
  return {
    salesNet: round2(salesTotal - output),
    salesTotal,
    output,
    purchasesNet: sumMoney(bills, (e) => e.subtotal),
    purchasesTotal: sumMoney(bills, (e) => e.grand_total),
    input,
    net: round2(output - input),
    salesCount: sales.length,
    billsCount: bills.length,
  };
}

