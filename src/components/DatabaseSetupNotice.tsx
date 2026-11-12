import type { SetupProblem } from "@/lib/setup";

/** Full-page instructions shown while the database schema isn't set up yet. */
export function DatabaseSetupNotice({ problem }: { problem: SetupProblem }) {
  const sqlFile = problem.schema === "public" ? "supabase/setup_all.sql" : `supabase/setup_${problem.schema}_schema.sql`;
  return (
    <div className="state-card">
      <h2>One-time database setup needed</h2>
      {problem.kind === "schema-not-exposed" ? (
        <p>
          Supabase isn&apos;t sharing the <code>{problem.schema}</code> schema yet. In the Supabase dashboard open{" "}
          <strong>Project Settings → Data API → Exposed schemas</strong>, add <code>{problem.schema}</code> and press
          Save. If you haven&apos;t yet, also run <code>{sqlFile}</code> in the SQL Editor. Then reload this page.
        </p>
      ) : (
        <p>
          The tables for this app don&apos;t exist yet. In the Supabase dashboard open the <strong>SQL Editor</strong>,
          paste the whole file <code>{sqlFile}</code> and press Run. Then reload this page.
        </p>
      )}
      <p className="hint">Supabase said: {problem.message}</p>
    </div>
  );
}
