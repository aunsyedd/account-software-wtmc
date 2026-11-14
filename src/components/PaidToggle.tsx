"use client";

import { useEffect, useState } from "react";
import { createPortal, useFormStatus } from "react-dom";

type Action = (formData: FormData) => void | Promise<void>;

function ToggleButton({ active, tone, children }: { active: boolean; tone: "paid" | "unpaid"; children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className={`paid-toggle-btn is-${tone}` + (active ? " is-active" : "")}
      aria-pressed={active}
      disabled={pending || active}
    >
      {pending ? <span className="btn-spinner" aria-hidden /> : null}
      {children}
    </button>
  );
}

function ConfirmButtons({ onCancel }: { onCancel: () => void }) {
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
          "Mark as unpaid"
        )}
      </button>
    </div>
  );
}

/**
 * Paid / Unpaid switch for an invoice.
 *  - Paid records one payment for the balance still owed.
 *  - Unpaid removes the payments recorded on it (asks first), so the full amount is owed again.
 */
export function PaidToggle({
  invoiceId,
  status,
  owedLabel,
  paidLabel,
  markPaid,
  markUnpaid,
}: {
  invoiceId: string;
  status: "paid" | "partial" | "unpaid";
  owedLabel: string;
  paidLabel: string;
  markPaid: Action;
  markUnpaid: Action;
}) {
  const [confirm, setConfirm] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!confirm) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setConfirm(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [confirm]);

  return (
    <div className="paid-toggle" role="group" aria-label="Payment status">
      <form action={markPaid}>
        <input type="hidden" name="invoice_id" value={invoiceId} />
        <ToggleButton active={status === "paid"} tone="paid">
          Paid
        </ToggleButton>
      </form>
      <button
        type="button"
        className={"paid-toggle-btn is-unpaid" + (status === "unpaid" ? " is-active" : "")}
        aria-pressed={status === "unpaid"}
        disabled={status === "unpaid"}
        onClick={() => setConfirm(true)}
      >
        Unpaid
      </button>

      {confirm && mounted
        ? createPortal(
            <div className="modal-backdrop" onMouseDown={() => setConfirm(false)}>
              <div
                className="modal"
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="unpaid-title"
                onMouseDown={(e) => e.stopPropagation()}
              >
                <h3 id="unpaid-title">Mark this invoice as unpaid?</h3>
                <p>
                  The {paidLabel} recorded as received will be removed, and the customer will owe {owedLabel} again.
                </p>
                <form action={markUnpaid}>
                  <input type="hidden" name="invoice_id" value={invoiceId} />
                  <ConfirmButtons onCancel={() => setConfirm(false)} />
                </form>
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
