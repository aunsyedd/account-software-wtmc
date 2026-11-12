import { getSupabase } from "./supabase";

export type SetupProblem = { kind: "schema-not-exposed" | "tables-missing" | "other"; schema: string; message: string };

let ready = false;

/**
 * Checks once that this app's _wtmc tables are reachable, so a half-finished
 * setup shows clear instructions instead of "Something went wrong" on every page.
 * After the first success it is never checked again (until the server restarts).
 */
export async function checkDatabaseSetup(): Promise<SetupProblem | null> {
  if (ready) return null;
  const schema = "public";
  const { error } = await getSupabase().from("company_settings").select("id").limit(1);
  if (!error) {
    ready = true;
    return null;
  }
  const msg = error.message || String(error);
  if (error.code === "PGRST106" || /invalid schema/i.test(msg)) return { kind: "schema-not-exposed", schema, message: msg };
  if (error.code === "PGRST205" || error.code === "42P01" || /could not find the table|does not exist/i.test(msg))
    return { kind: "tables-missing", schema, message: msg };
  // Network hiccups etc. are left to the normal error page.
  return null;
}
