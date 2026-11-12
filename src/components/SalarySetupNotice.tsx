/** Shown until supabase/salary_payments.sql has been run in Supabase. */
export function SalarySetupNotice() {
  return (
    <div className="notice notice-warn no-print">
      <strong>One-time setup needed for salary tracking.</strong> Open Supabase → SQL Editor, paste the file{" "}
      <code>supabase/salary_payments.sql</code> and press Run. Until then, salary payments by month can&apos;t be saved.
    </div>
  );
}
