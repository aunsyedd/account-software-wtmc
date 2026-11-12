"use client";

import { useFormStatus } from "react-dom";

/**
 * Submit button that shows a spinner while its form's server action runs.
 * When a form has several submit buttons (name="intent"), only the one that
 * was clicked shows the spinner; the others are disabled to avoid double saves.
 */
export function SubmitButton({
  children,
  className = "btn btn-green",
  name,
  value,
  pendingLabel = "Saving…",
}: {
  children: React.ReactNode;
  className?: string;
  name?: string;
  value?: string;
  pendingLabel?: string;
}) {
  const { pending, data } = useFormStatus();
  const mine = pending && (!name || data?.get(name) === value);
  return (
    <button
      className={className + (mine ? " is-loading" : "")}
      type="submit"
      name={name}
      value={value}
      disabled={pending}
      aria-busy={mine || undefined}
    >
      {mine ? (
        <>
          <span className="btn-spinner" aria-hidden />
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </button>
  );
}
