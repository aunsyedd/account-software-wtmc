"use client";

import { useEffect, useState } from "react";
import { createPortal, useFormStatus } from "react-dom";

type Action = (formData: FormData) => void | Promise<void>;

function DialogButtons({ onCancel }: { onCancel: () => void }) {
  const { pending } = useFormStatus();
  return (
    <div className="modal-actions">
      <button type="button" className="btn btn-gray" onClick={onCancel} disabled={pending}>
        Cancel
      </button>
      <button type="submit" className="btn btn-danger-solid" disabled={pending}>
        {pending ? (
          <>
            <span className="btn-spinner" /> Deleting…
          </>
        ) : (
          "Delete"
        )}
      </button>
    </div>
  );
}

/**
 * Delete link for tables. Opens a confirmation dialog first so a single
 * mis-click can no longer wipe an invoice, expense, product or contact.
 */
export function ConfirmDelete({
  action,
  id,
  what,
  label = "Delete",
  className = "link-danger",
}: {
  action: Action;
  id: string;
  what: string;
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        {label}
      </button>
      {open && mounted
        ? createPortal(
            <div className="modal-backdrop" onMouseDown={() => setOpen(false)}>
              <div
                className="modal"
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="confirm-title"
                onMouseDown={(e) => e.stopPropagation()}
              >
                <div className="modal-icon" aria-hidden>
                  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" />
                  </svg>
                </div>
                <h3 id="confirm-title">Delete {what}?</h3>
                <p>This permanently removes it and cannot be undone.</p>
                <form action={action}>
                  <input type="hidden" name="id" value={id} />
                  <DialogButtons onCancel={() => setOpen(false)} />
                </form>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
