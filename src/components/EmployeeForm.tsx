import { saveEmployee } from "@/app/actions";
import { SubmitButton } from "@/components/SubmitButton";
import { todayISO } from "@/lib/format";
import { addMonths, currentMonthKey, monthKey, monthOptions } from "@/lib/salary";

type Employee = {
  id?: string;
  name?: string;
  job_title?: string | null;
  department?: string | null;
  email?: string | null;
  phone?: string | null;
  national_id?: string | null;
  hire_date?: string | null;
  basic_salary?: number;
  housing_allowance?: number;
  other_allowance?: number;
  status?: string;
  notes?: string | null;
  salary_start_month?: string | null;
};

const PAY_MODES = ["Cash", "Bank", "Cheque", "Online"];

export function EmployeeForm({ employee }: { employee?: Employee }) {
  const isNew = !employee?.id;
  const current = currentMonthKey();
  // Recent months for the "salary paid for" picker (newest first).
  const months = monthOptions(addMonths(current, -36), addMonths(current, 1));

  return (
    <form action={saveEmployee} className="form" style={{ maxWidth: 1000 }}>
      {employee?.id ? <input type="hidden" name="id" value={employee.id} /> : null}

      <h3 className="form-section">Personal details</h3>
      <div className="grid-2">
        <div className="field">
          <label htmlFor="emp-name">Employee name *</label>
          <input id="emp-name" name="name" required defaultValue={employee?.name || ""} />
        </div>
        <div className="field">
          <label htmlFor="emp-title">Job title</label>
          <input id="emp-title" name="job_title" defaultValue={employee?.job_title || ""} />
        </div>
        <div className="field">
          <label htmlFor="emp-dept">Department</label>
          <input id="emp-dept" name="department" placeholder="Sales, Warehouse…" defaultValue={employee?.department || ""} />
        </div>
        <div className="field">
          <label htmlFor="emp-phone">Phone</label>
          <input id="emp-phone" name="phone" defaultValue={employee?.phone || ""} />
        </div>
        <div className="field">
          <label htmlFor="emp-email">Email</label>
          <input id="emp-email" name="email" type="email" defaultValue={employee?.email || ""} />
        </div>
        <div className="field">
          <label htmlFor="emp-nid">National ID / Iqama</label>
          <input id="emp-nid" name="national_id" defaultValue={employee?.national_id || ""} />
        </div>
        <div className="field">
          <label htmlFor="emp-hire">Hire date</label>
          <input id="emp-hire" name="hire_date" type="date" defaultValue={employee?.hire_date || ""} />
        </div>
        <div className="field">
          <label htmlFor="emp-status">Status</label>
          {employee?.status === "terminated" ? (
            <>
              <input type="hidden" name="status" value="terminated" />
              <input id="emp-status" value="TERMINATED" disabled readOnly />
              <div className="hint">Use &ldquo;Undo termination&rdquo; at the top of the page to make them active again.</div>
            </>
          ) : (
            <select id="emp-status" name="status" defaultValue={employee?.status || "active"}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          )}
        </div>
      </div>

      <h3 className="form-section">Monthly salary (&#x20C1;)</h3>
      <div className="grid-3">
        <div className="field">
          <label htmlFor="emp-basic">Basic salary</label>
          <input id="emp-basic" name="basic_salary" type="number" step="0.01" min="0" defaultValue={employee?.basic_salary ?? 0} />
        </div>
        <div className="field">
          <label htmlFor="emp-housing">Housing allowance</label>
          <input id="emp-housing" name="housing_allowance" type="number" step="0.01" min="0" defaultValue={employee?.housing_allowance ?? 0} />
        </div>
        <div className="field">
          <label htmlFor="emp-other">Other allowance</label>
          <input id="emp-other" name="other_allowance" type="number" step="0.01" min="0" defaultValue={employee?.other_allowance ?? 0} />
        </div>
      </div>
      <p className="hint">Total monthly salary = basic + housing + other. Salaries are not subject to VAT.</p>

      {isNew ? (
        <>
          <h3 className="form-section">Salary already paid</h3>
          <div className="grid-2">
            <div className="field">
              <label htmlFor="emp-paid-month">Salary paid for month</label>
              <select id="emp-paid-month" name="paid_month" defaultValue="">
                <option value="">Nothing paid yet</option>
                {months.map((m) => (
                  <option key={m.key} value={m.key}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="emp-paid-amount">Amount paid for that month</label>
              <input id="emp-paid-amount" name="paid_amount" type="number" step="0.01" min="0" placeholder="Full salary" />
              <div className="hint">Leave empty if the full salary was paid.</div>
            </div>
            <div className="field">
              <label htmlFor="emp-paid-date">Paid on</label>
              <input id="emp-paid-date" name="paid_date" type="date" defaultValue={todayISO()} />
            </div>
            <div className="field">
              <label htmlFor="emp-paid-mode">Paid by</label>
              <select id="emp-paid-mode" name="paid_mode" defaultValue="Cash">
                {PAY_MODES.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </div>
          </div>
        </>
      ) : (
        <>
          <h3 className="form-section">Salary tracking</h3>
          <div className="grid-2">
            <div className="field">
              <label htmlFor="emp-start">Track salary from month</label>
              <select id="emp-start" name="salary_start_month" defaultValue={monthKey(employee?.salary_start_month)}>
                <option value="">Hire month (or first recorded payment)</option>
                {months.map((m) => (
                  <option key={m.key} value={m.key}>
                    {m.label}
                  </option>
                ))}
              </select>
              <div className="hint">Months before this are treated as settled.</div>
            </div>
          </div>
        </>
      )}

      <div className="field full" style={{ marginTop: 6 }}>
        <label htmlFor="emp-notes">Notes</label>
        <textarea id="emp-notes" name="notes" defaultValue={employee?.notes || ""} />
      </div>
      <div className="btn-row">
        <SubmitButton className="btn btn-green" pendingLabel="Saving…">
          Save employee
        </SubmitButton>
      </div>
    </form>
  );
}
