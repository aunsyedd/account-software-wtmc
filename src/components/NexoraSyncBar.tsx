import { syncNexoraNow } from "@/app/actions";
import type { SyncResult } from "@/lib/nexora";
import { SubmitButton } from "@/components/SubmitButton";

function time(ms?: number) {
  if (!ms) return "";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Riyadh",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(ms));
}

/** Shows where Nexora Invoices data comes from, when it last synced, and a "Sync now" button. */
export function NexoraSyncBar({ result, back }: { result: SyncResult; back: string }) {
  if (!result.configured) {
    return (
      <div className="sync-bar no-print">
        <span className="muted">
          Nexora Invoices sync is not set up. Add <code>NEXORA_SUPABASE_URL</code> and{" "}
          <code>NEXORA_SUPABASE_ANON_KEY</code> (or <code>NEXORA_SUPABASE_SECRET_KEY</code>) to the environment variables.
        </span>
      </div>
    );
  }
  return (
    <div className={"sync-bar no-print" + (result.ok ? "" : " is-error")}>
      <span>
        {result.ok ? (
          <>
            <strong>Synced with Nexora Invoices</strong>
            <span className="muted">
              {" "}
              at {time(result.at)} · {result.customers ?? 0} customers, {result.invoices ?? 0} invoices
            </span>
          </>
        ) : (
          <>
            <strong>Nexora sync failed:</strong> {result.error}
          </>
        )}
      </span>
      <form action={syncNexoraNow}>
        <input type="hidden" name="back" value={back} />
        <SubmitButton className="btn btn-gray btn-sm" pendingLabel="Syncing…">
          Sync now
        </SubmitButton>
      </form>
    </div>
  );
}
