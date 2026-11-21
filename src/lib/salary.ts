import { getSupabase } from "./supabase";
import { fetchAll } from "./queries";
import { money, todayISO } from "./format";
import { round2, sumMoney } from "./vat";

/**
 * Salary tracking by month.
 *
 * Every salary payment is tagged with the month it pays for. From an employee's
 * start month up to the current month, each month is expected to be paid in full
 * (gross salary); anything less shows up as a reminder.
 */

export type SalaryPayment = {
  id: string;
  employee_id: string;
  salary_month: string; // YYYY-MM-01
  amount: number;
  payment_date: string;
  payment_mode: string | null;
  reference: string | null;
  notes: string | null;
};

export type SalaryEmployee = {
  id: string;
  name: string;
  status?: string | null;
  gross_salary: number | string;
  hire_date?: string | null;
  created_at?: string | null;
  salary_start_month?: string | null;
  last_salary_month?: string | null; // terminated: last month paid for
  last_salary_date?: string | null; // terminated: date of the last salary
};

export function isTerminated(emp: { status?: string | null }) {
  return emp.status === "terminated";
}

export type SalaryMonth = {
  key: string; // YYYY-MM
  label: string; // September 2026
  expected: number;
  paid: number;
  balance: number; // still to pay (never negative)
  status: "paid" | "partial" | "unpaid" | "advance";
  isCurrent: boolean;
  isFuture: boolean;
  payments: SalaryPayment[];
};

export type SalaryStatus = {
  employee: SalaryEmployee;
  months: SalaryMonth[]; // oldest first
  pending: SalaryMonth[]; // months with a balance, oldest first
  overdue: SalaryMonth[]; // pending months before the current month
  totalPending: number;
  totalOverdue: number;
  totalPaid: number;
  nextMonthToPay: SalaryMonth | null;
};

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** "2026-09-14" or "2026-09" → "2026-09". */
export function monthKey(date: string | null | undefined) {
  const d = String(date || "").slice(0, 7);
  return /^\d{4}-\d{2}$/.test(d) ? d : "";
}

export function monthStartISO(key: string) {
  return `${key}-01`;
}

export function monthLabel(key: string, short = false) {
  const [y, m] = key.split("-").map(Number);
  const name = MONTHS[(m || 1) - 1] ?? "";
  return `${short ? name.slice(0, 3) : name} ${y}`;
}

export function addMonths(key: string, n: number) {
  const [y, m] = key.split("-").map(Number);
  const total = y * 12 + (m - 1) + n;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return `${ny}-${String(nm).padStart(2, "0")}`;
}

export function currentMonthKey() {
  return monthKey(todayISO());
}

/** Month keys from `from` to `to` inclusive. */
export function monthRange(from: string, to: string) {
  const out: string[] = [];
  if (!from || !to || from > to) return out;
  for (let k = from; k <= to; k = addMonths(k, 1)) {
    out.push(k);
    if (out.length > 600) break; // safety
  }
  return out;
}

/** Month options for a <select>, newest first. */
export function monthOptions(from: string, to: string) {
  return monthRange(from, to)
    .reverse()
    .map((key) => ({ key, label: monthLabel(key) }));
}

/** First month whose salary is tracked for this employee. */
export function salaryStartMonth(emp: SalaryEmployee, payments: SalaryPayment[]) {
  const earliestPaid = payments
    .map((p) => monthKey(p.salary_month))
    .filter(Boolean)
    .sort()[0];
  const configured =
    monthKey(emp.salary_start_month) || monthKey(emp.hire_date) || monthKey(emp.created_at) || currentMonthKey();
  return earliestPaid && earliestPaid < configured ? earliestPaid : configured;
}

/**
 * Salary expected for each month from the start month to `upTo` (inclusive).
 * Inactive employees are only expected to be paid up to the last month that has a payment.
 * Terminated employees are expected to be paid up to their last salaried month, never after.
 */
export function expectedMonths(emp: SalaryEmployee, payments: SalaryPayment[], upTo = currentMonthKey()) {
  const gross = round2(Number(emp.gross_salary || 0));
  const start = salaryStartMonth(emp, payments);
  let end = upTo;
  if (emp.status === "inactive") {
    const lastPaid = payments
      .map((p) => monthKey(p.salary_month))
      .filter(Boolean)
      .sort()
      .pop();
    end = lastPaid && lastPaid < upTo ? lastPaid : lastPaid ? upTo : "";
  } else if (isTerminated(emp)) {
    const last = monthKey(emp.last_salary_month);
    if (last && last < end) end = last;
  }
  const map = new Map<string, number>();
  for (const k of monthRange(start, end)) map.set(k, gross);
  return map;
}

export function salaryStatus(emp: SalaryEmployee, allPayments: SalaryPayment[]): SalaryStatus {
  const payments = allPayments.filter((p) => p.employee_id === emp.id);
  const current = currentMonthKey();
  const expected = expectedMonths(emp, payments, current);

  const keys = new Set<string>(expected.keys());
  for (const p of payments) if (monthKey(p.salary_month)) keys.add(monthKey(p.salary_month));

  const months: SalaryMonth[] = [...keys].sort().map((key) => {
    const paidRows = payments.filter((p) => monthKey(p.salary_month) === key);
    const exp = expected.get(key) ?? 0;
    const paid = sumMoney(paidRows, (p) => p.amount);
    const balance = round2(Math.max(0, exp - paid));
    let status: SalaryMonth["status"] = "unpaid";
    if (exp === 0 && paid > 0) status = "advance";
    else if (balance === 0) status = "paid";
    else if (paid > 0) status = "partial";
    return {
      key,
      label: monthLabel(key),
      expected: exp,
      paid,
      balance,
      status,
      isCurrent: key === current,
      isFuture: key > current,
      payments: paidRows.sort((a, b) => String(a.payment_date).localeCompare(String(b.payment_date))),
    };
  });

  const pending = months.filter((m) => m.balance > 0);
  const overdue = pending.filter((m) => m.key < current);
  return {
    employee: emp,
    months,
    pending,
    overdue,
    totalPending: sumMoney(pending, (m) => m.balance),
    totalOverdue: sumMoney(overdue, (m) => m.balance),
    totalPaid: sumMoney(payments, (p) => p.amount),
    nextMonthToPay: pending[0] ?? null,
  };
}

/** Short human reminders, e.g. "September 2026: 1,000.00 SAR of 2,000.00 SAR still unpaid". */
export function reminderLines(status: SalaryStatus, symbol = "SAR") {
  return status.pending.map((m) => {
    const when = m.isCurrent ? " (due this month)" : "";
    if (m.paid > 0) {
      return `${m.label}: ${money(m.balance, symbol)} of ${money(m.expected, symbol)} still unpaid${when}`;
    }
    return `${m.label} salary pending — ${money(m.balance, symbol)}${when}`;
  });
}

function isMissingTable(error: unknown) {
  const e = error as { code?: string; message?: string } | null;
  if (!e) return false;
  return (
    e.code === "PGRST205" ||
    e.code === "42P01" ||
    /salary_payments/i.test(String(e.message || ""))
  );
}

/** All salary payments. `ready` is false until supabase/salary_payments.sql has been run. */
export async function getSalaryPayments(): Promise<{ ready: boolean; payments: SalaryPayment[] }> {
  const supabase = getSupabase();
  try {
    const payments = await fetchAll<SalaryPayment>((from, to) =>
      supabase
        .from("salary_payments")
        .select("*")
        .order("salary_month")
        .order("payment_date")
        .order("id")
        .range(from, to)
    );
    return {
      ready: true,
      payments: payments.map((p) => ({ ...p, amount: round2(p.amount), salary_month: monthStartISO(monthKey(p.salary_month)) })),
    };
  } catch (error) {
    if (isMissingTable(error)) return { ready: false, payments: [] };
    throw error;
  }
}

/** Month choices, default month and unpaid balances for the TERMINATED dialog. */
export function terminationChoices(status: SalaryStatus) {
  const current = currentMonthKey();
  const first = status.months[0]?.key ?? current;
  const from = first < addMonths(current, -36) ? first : addMonths(current, -36);
  const lastPaid = [...status.months].reverse().find((m) => m.paid > 0)?.key;
  const balances: Record<string, number> = {};
  for (const m of status.months) if (m.balance > 0) balances[m.key] = m.balance;
  return {
    months: monthOptions(from, addMonths(current, 1)),
    defaultMonth: lastPaid ?? current,
    balances,
  };
}
