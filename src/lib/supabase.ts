import { unstable_noStore as noStore } from "next/cache";
import { createClient } from "@supabase/supabase-js";

export function getSupabase() {
  noStore();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY");
  }
  // WTMC shares the Supabase project with the Faisal Ramadan app but keeps all
  // of its data in its own schema (see supabase/setup_wtmc_schema.sql).
  const schema = process.env.SUPABASE_DB_SCHEMA || "public";
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema },
  });
}
