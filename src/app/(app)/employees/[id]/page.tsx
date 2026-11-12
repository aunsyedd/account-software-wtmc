import { notFound } from "next/navigation";
import Link from "next/link";
import { deleteSalaryPayment, saveSalaryPayment } from "@/app/actions";
import { ConfirmDelete } from "@/components/ConfirmDelete";
import { EmployeeForm } from "@/components/EmployeeForm";
import { PrintButton } from "@/components/PrintButton";
import { PrintHeader } from "@/components/PrintHeader";
import { SalarySetupNotice } from "@/components/SalarySetupNotice";
import { SubmitButton } from "@/components/SubmitButton";
import { displayDate, money, todayISO } from "@/lib/format";
import { getCompany, getEmployee } from "@/lib/queries";
import {
  addMonths,
  currentMonthKey,
  getSalaryPayments,
  monthOptions,
  reminderLines,
  salaryStatus,
  type SalaryEmployee,
} from "@/lib/salary";

const ERRORS: Record<string, string> = {
  amount: "Payment amount must be more than zero.",
  month: "Choose which month the salary is for.",
  setup: "Salary payments can't be saved yet: run supabase/salary_payments.sql in Supabase first.",
};

export default async function EmployeePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { id } = await params;
  const { error, saved } = await searchParams;
  const [employee, company, salary] = await Promise.all([getEmployee(id), getCompany(), getSalaryPayments()]);
  if (!employee) notFound();
  const s = company.currency_symbol;
  const status = salaryStatus(employee as SalaryEmployee, salary.payments);
  const reminders = reminderLines(status, s);
  const current = currentMonthKey();
  const firstMonth = status.months[0]?.key ?? current;
  const options = monthOptions(
    firstMonth < addMonths(current, -36) ? firstMonth : addMonths(current, -36),
    addMonths(current, 2)
  );
  const next = status.nextMonthToPay;
  const gross = Number(employee.gross_salary || 0);

  return (
    <div className="report-sheet">
      <PrintHeader company={company} title={`Salary statement — ${employee.name}`} subtitle={employee.job_title || undefined} />
      <div className="page-head">
        <div>
          <h1>{employee.name}</h1>
          <p className="hint">
            {[employee.job_title, employee.department].filter(Boolean).join(" · ") || "Employee"} · Monthly salary{" "}
            {money(gross, s)}
          </p>
        </div>
        <div className="head-actions no-print">
          <PrintButton label="Print salary statement" filename={`Salary statement - ${employee.name}`} />
          <Link className="btn btn-gray" href="/employees">
            ← All employees
          </Link>
        </div>
      </div>

      {!salary.ready ? <SalarySetupNotice /> : null}

      <div className="stats" id="salary">
        <div className="stat">
          <div className="k">Monthly salary</div>
          <div className="v">{money(gross, s)}</div>
        </div>
        <div className="stat">
          <div className="k">Total pending</div>
          <div className={"v" + (status.totalPending > 0 ? " text-danger" : "")}>{money(status.totalPending, s)}</div>
        </div>
        <div className="stat">
          <div className="k">Unpaid months</div>
          <div className="v">{status.pending.length}</div>
        </div>
        <div className="stat">
          <div className="k">Total paid</div>
          <div className="v">{money(status.totalPaid, s)}</div>
        </div>
      </div>

      {reminders.length ? (
        <div className="reminder">
          <strong>Salary reminder for {employee.name}</strong>
          <ul>
            {reminders.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      ) : salary.ready ? (
        <div className="notice notice-ok">All salary up to {status.months.at(-1)?.label ?? "this month"} is paid.</div>
      ) : null}

      {salary.ready ? (
        <section className="no-print">
          <h2 className="report-title">Record salary payment</h2>
          {error && ERRORS[error] ? <div className="alert">{ERRORS[error]}</div> : null}
          {saved ? <div className="notice notice-ok">Salary payment saved.</div> : null}
          <form action={saveSalaryPayment} className="form" style={{ maxWidth: 1000 }}>
            <input type="hidden" name="employee_id" value={employee.id} />
            <div className="grid-3">
              <div className="field">
                <label htmlFor="sp-month">Salary for month</label>
                <select id="sp-month" name="salary_month" defaultValue={next?.key ?? current} required>
                  {options.map((m) => (
                    <option key={m.key} value={m.key}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="sp-amount">Amount ({s})</label>
                <input
                  id="sp-amount"
                  name="amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  defaultValue={next ? next.balance.toFixed(2) : gross ? gross.toFixed(2) : ""}
                />
              </div>
              <div className="field">
                <label htmlFor="sp-date">Paid on</label>
                <input id="sp-date" name="payment_date" type="date" defaultValue={todayISO()} />
              </div>
              <div className="field">
                <label htmlFor="sp-mode">Paid by</label>
                <select id="sp-mode" name="payment_mode" defaultValue="Cash">
                  <option>Cash</option>
                  <option>Bank</option>
                  <option>Cheque</option>
                  <option>Online</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="sp-ref">Reference</label>
                <input id="sp-ref" name="reference" placeholder="Cheque / transfer no." />
              </div>
              <div className="field">
                <label htmlFor="sp-notes">Notes</label>
                <input id="sp-notes" name="notes" />
              </div>
            </div>
            {next ? (
              <p className="hint">
                Pre-filled with the oldest unpaid month ({next.label}, {money(next.balance, s)} left).
              </p>
            ) : null}
            <SubmitButton className="btn btn-green" pendingLabel="Saving…">
              Save salary payment
            </SubmitButton>
          </form>
        </section>
      ) : null}

      <h2 className="report-title">Salary by month</h2>
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Month</th>
              <th className="num">Salary</th>
              <th className="num">Paid</th>
              <th className="num">Balance</th>
              <th>Status</th>
              <th>Payments</th>
            </tr>
          </thead>
          <tbody>
            {status.months.length === 0 ? (
              <tr>
                <td colSpan={6} className="muted">
                  No salary months yet.
                </td>
              </tr>
            ) : (
              [...status.months].reverse().map((m) => (
                <tr key={m.key} className={m.balance > 0 && !m.isCurrent ? "low" : undefined}>
                  <td>
                    <strong>{m.label}</strong>
                    {m.isCurrent ? <span className="muted"> · this month</span> : null}
                  </td>
                  <td className="num">{money(m.expected, s)}</td>
                  <td className="num">{money(m.paid, s)}</td>
                  <td className="num">{money(m.balance, s)}</td>
                  <td>
                    <span className={"badge " + m.status}>
                      {m.status === "advance" ? "advance" : m.status === "unpaid" && m.isCurrent ? "due" : m.status}
                    </span>
                  </td>
                  <td className="pay-list">
                    {m.payments.length === 0
                      ? "—"
                      : m.payments.map((p) => (
                          <div key={p.id}>
                            {money(p.amount, s)} on {displayDate(p.payment_date)}
                            {p.payment_mode ? ` · ${p.payment_mode}` : ""}
                            {p.reference ? ` · ${p.reference}` : ""}
                            <span className="no-print">
                              {" "}
                              <ConfirmDelete
                                action={deleteSalaryPayment}
                                id={p.id}
                                what={`this ${money(p.amount, s)} payment`}
                                label="Remove"
                              />
                            </span>
                          </div>
                        ))}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <section className="no-print">
        <h2 className="report-title">Employee details</h2>
        <EmployeeForm employee={employee} />
      </section>
    </div>
  );
}
