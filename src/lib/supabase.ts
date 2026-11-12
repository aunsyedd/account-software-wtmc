import { unstable_noStore as noStore } from "next/cache";
import { createClient } from "@supabase/supabase-js";

/**
 * WTMC shares the Supabase project with the Faisal Ramadan app. Every WTMC
 * table, view and function ends in this suffix (employees_wtmc, expenses_wtmc,
 * invoices_wtmc, ...), created by supabase/setup_wtmc.sql, so the two apps
 * never read or write each other's data.
 * Code keeps using the short names: getSupabase() adds the suffix itself.
 */
export const TABLE_SUFFIX = "_wtmc";

export function getSupabase() {
  noStore();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY");
  }
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const from = client.from.bind(client);
  const rpc = client.rpc.bind(client);
  client.from = ((name: string) => from(name + TABLE_SUFFIX)) as typeof client.from;
  client.rpc = ((fn: string, ...rest: unknown[]) =>
    (rpc as (...a: unknown[]) => unknown)(fn + TABLE_SUFFIX, ...rest)) as typeof client.rpc;
  return client;
}
