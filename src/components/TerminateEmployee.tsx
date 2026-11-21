"use client";

import { useEffect, useState } from "react";
import { createPortal, useFormStatus } from "react-dom";
import { terminateEmployee } from "@/app/actions";

type MonthOption = { key: string; label: string };

function Buttons({ onCancel }: { onCancel: () => void }) {
  const { pending } = useFormStatus();
  return (
    <div className="modal-actions">
      <button type="button" className="btn btn-gray" onClick={onCancel} disabled={pending}>
        Cancel
      </button>
      <button type="submit" className="btn btn-danger-solid" disabled={pending}>
        {pending ? (
          <>
            <span className="btn-spinner" /> Saving…
          </>
        ) : (
          "Mark TERMINATED"
        )}
      </button>
    </div>
  );
}

function fmt(n: number, symbol: string) {
  return `${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${symbol}`;
}

/**
 * "TERMINATED" button. Asks which month the employee's last salary was for and the
 * date of that last salary, then marks the employee TERMINATED. All salary records stay.
 */
export function TerminateEmployee({
  id,
  name,
  months,
  defaultMonth,
  balances,
  today,
  symbol = "SAR",
  back = "detail",
  label = "TERMINATED",
  className = "link-danger",
}: {
  id: string;
  name: string;
  months: MonthOption[]; // newest first
  defaultMonth: string;
  balances: Record<string, number>; // unpaid balance per month key
  today: string;
  symbol?: string;
  back?: "list" | "detail";
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [month, setMonth] = useState(defaultMonth);
  const [recordFinal, setRecordFinal] = useState(true);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const balance = balances[month] ?? 0;
  const monthLabel = months.find((m) => m.key === month)?.label ?? month;
  const earlierUnpaid = Object.entries(balances).filter(([k, v]) => k < month && v > 0);

  return (
    <>
      <button
        type="button"
        className={className}
        onClick={() => {
          setMonth(defaultMonth);
          setRecordFinal(true);
          setOpen(true);
        }}
      >
        {label}
      </button>
      {open && mounted
        ? createPortal(
            <div className="modal-backdrop" onMouseDown={() => setOpen(false)}>
              <div
                className="modal modal-form"
                role="dialog"
                aria-modal="true"
                aria-labelledby="terminate-title"
                onMouseDown={(e) => e.stopPropagation()}
              >
                <h3 id="terminate-title">Terminate {name}?</h3>
                <p>
                  Choose the month of the last salary and the date it was paid. No salary is expected after that
                  month. All of {name}&apos;s salary records stay saved under their name, marked TERMINATED.
                </p>
                <form action={terminateEmployee} className="form">
                  <input type="hidden" name="id" value={id} />
                  <input type="hidden" name="back" value={back} />
                  <div className="field">
                    <label htmlFor={`term-month-${id}`}>Last salary paid for month</label>
                    <select
                      id={`term-month-${id}`}
                      name="last_salary_month"
                      value={month}
                      onChange={(e) => setMonth(e.target.value)}
                      required
                    >
                      {months.map((m) => (
                        <option key={m.key} value={m.key}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor={`term-date-${id}`}>Last salary date</label>
                    <input id={`term-date-${id}`} name="last_salary_date" type="date" defaultValue={today} required />
                  </div>

                  {balance > 0 ? (
                    <div className="term-final">
                      <label className="check">
                        <input
                          type="checkbox"
                          name="record_final"
                          checked={recordFinal}
                          onChange={(e) => setRecordFinal(e.target.checked)}
                        />{" "}
                        {monthLabel} still has <strong>{fmt(balance, symbol)}</strong> unpaid — record it as paid on
                        the date above
                      </label>
                      {recordFinal ? (
                        <div className="grid-2">
                          <div className="field">
                            <label htmlFor={`term-amt-${id}`}>Amount ({symbol})</label>
                            <input
                              key={month}
                              id={`term-amt-${id}`}
                              name="final_amount"
                              type="number"
                              step="0.01"
                              min="0.01"
                              defaultValue={balance.toFixed(2)}
                            />
                          </div>
                          <div className="field">
                            <label htmlFor={`term-mode-${id}`}>Paid by</label>
                            <select id={`term-mode-${id}`} name="final_mode" defaultValue="Cash">
                              <option>Cash</option>
                              <option>Bank</option>
                              <option>Cheque</option>
                              <option>Online</option>
                            </select>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <p className="hint">{monthLabel} is fully paid.</p>
                  )}
                  {earlierUnpaid.length ? (
                    <p className="hint text-danger">
                      {earlierUnpaid.length} earlier month(s) still unpaid (
                      {fmt(
                        earlierUnpaid.reduce((t, [, v]) => t + v, 0),
                        symbol
                      )}
                      ). They stay as pending salary.
                    </p>
                  ) : null}
                  <Buttons onCancel={() => setOpen(false)} />
                </form>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
