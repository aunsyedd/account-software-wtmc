import Link from "next/link";
import { money } from "@/lib/format";
import { reminderLines, type SalaryStatus } from "@/lib/salary";

/** "Zakria — September 2026: 1,000 SAR of 2,000 SAR still unpaid; October 2026 salary pending". */
export function SalaryReminders({
  statuses,
  symbol = "SAR",
  limit = 6,
}: {
  statuses: SalaryStatus[];
  symbol?: string;
  limit?: number;
}) {
  const due = statuses.filter((st) => st.pending.length > 0).sort((a, b) => b.totalPending - a.totalPending);
  if (due.length === 0) return null;
  return (
    <div className="reminder">
      <strong>
        Salary reminders · {due.length} employee{due.length === 1 ? "" : "s"} with unpaid salary
      </strong>
      <ul>
        {due.map((st) => {
          const lines = reminderLines(st, symbol);
          const shown = lines.slice(0, limit);
          return (
            <li key={st.employee.id}>
              <Link href={`/employees/${st.employee.id}#salary`}>{st.employee.name}</Link> —{" "}
              <strong>{money(st.totalPending, symbol)}</strong> pending
              <ul>
                {shown.map((l) => (
                  <li key={l}>{l}</li>
                ))}
                {lines.length > shown.length ? (
                  <li className="muted">…and {lines.length - shown.length} more month(s)</li>
                ) : null}
              </ul>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
