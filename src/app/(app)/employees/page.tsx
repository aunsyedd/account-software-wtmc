import Link from "next/link";
import { deleteEmployee } from "@/app/actions";
import { PrintButton } from "@/components/PrintButton";
import { PrintHeader } from "@/components/PrintHeader";
import { SalarySetupNotice } from "@/components/SalarySetupNotice";
import { SalaryReminders } from "@/components/SalaryReminders";
import { displayDate, money } from "@/lib/format";
import { getCompany, getEmployees } from "@/lib/queries";
import { getSalaryPayments, salaryStatus, type SalaryEmployee } from "@/lib/salary";
import { sumMoney } from "@/lib/vat";
import { ConfirmDelete } from "@/components/ConfirmDelete";

type Emp = SalaryEmployee & {
  job_title: string | null;
  department: string | null;
  phone: string | null;
  hire_date: string | null;
  basic_salary: number;
  gross_salary: number;
  status: string;
};

export default async function EmployeesPage() {
  const [employees, company, salary] = await Promise.all([getEmployees(), getCompany(), getSalaryPayments()]);
  const s = company.currency_symbol;
  const list = employees as Emp[];
  const payroll = sumMoney(list, (e) => (e.status === "inactive" ? 0 : Number(e.gross_salary || 0)));
  const statuses = list.map((e) => salaryStatus(e, salary.payments));
  const byId = new Map(statuses.map((st) => [st.employee.id, st]));
  const pendingTotal = sumMoney(statuses, (st) => st.totalPending);

  return (
    <div className="report-sheet">
      <PrintHeader company={company} title="Employees & salaries" />
      <div className="page-head">
        <h1>Employees</h1>
        <div className="head-actions no-print">
          <PrintButton filename="Employees and salaries" />
          <Link className="btn btn-green" href="/employees/new">
            + Add employee
          </Link>
        </div>
      </div>
      {!salary.ready ? <SalarySetupNotice /> : null}
      <div className="stats stats-3">
        <div className="stat">
          <div className="k">People</div>
          <div className="v">{list.length}</div>
        </div>
        <div className="stat">
          <div className="k">Active monthly payroll</div>
          <div className="v">{money(payroll, s)}</div>
        </div>
        <div className="stat">
          <div className="k">Salary pending</div>
          <div className={"v" + (pendingTotal > 0 ? " text-danger" : "")}>{money(pendingTotal, s)}</div>
        </div>
      </div>

      <SalaryReminders statuses={statuses} symbol={s} />

      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Name</th>
              <th>Job title</th>
              <th>Department</th>
              <th>Phone</th>
              <th>Hire date</th>
              <th className="num">Monthly salary</th>
              <th className="num">Pending</th>
              <th>Next to pay</th>
              <th className="no-print">Actions</th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 ? (
              <tr>
                <td colSpan={9} className="muted">
                  No employees yet. Add staff to track salaries.
                </td>
              </tr>
            ) : (
              list.map((e) => {
                const st = byId.get(e.id);
                return (
                  <tr key={e.id}>
                    <td>
                      <Link href={`/employees/${e.id}`}>{e.name}</Link>
                    </td>
                    <td>{e.job_title}</td>
                    <td>{e.department}</td>
                    <td>{e.phone}</td>
                    <td>{displayDate(e.hire_date)}</td>
                    <td className="num">{money(e.gross_salary, s)}</td>
                    <td className={"num" + (st && st.totalPending > 0 ? " text-danger" : "")}>
                      {money(st?.totalPending ?? 0, s)}
                    </td>
                    <td>{st?.nextMonthToPay ? st.nextMonthToPay.label : <span className="muted">Up to date</span>}</td>
                    <td className="actions no-print">
                      <Link href={`/employees/${e.id}#salary`}>Pay salary</Link>
                      <Link href={`/employees/${e.id}`}>Edit</Link>
                      <ConfirmDelete action={deleteEmployee} id={e.id} what={`employee ${e.name}`} />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
