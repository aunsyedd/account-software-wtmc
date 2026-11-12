-- ============================================================
-- ONE-TIME: copy WTMC rows from the old "wtmc" schema into the new
-- *_wtmc tables (run AFTER setup_wtmc.sql). Safe to run more than once:
-- rows already copied (same id) are skipped. Faisal Ramadan tables untouched.
-- ============================================================
do $$
declare
  t text;
  cols text;
begin
  if to_regclass('public.company_settings_wtmc') is null then
    raise exception 'The _wtmc tables do not exist yet. Run supabase/setup_wtmc.sql first, then this file.';
  end if;
  if not exists (select 1 from information_schema.schemata where schema_name = 'wtmc') then
    raise notice 'No wtmc schema, nothing to copy';
    return;
  end if;

  -- company settings: keep the WTMC row that was already there
  if exists (select 1 from information_schema.tables where table_schema = 'wtmc' and table_name = 'company_settings') then
    execute 'delete from public.company_settings_wtmc where id not in (select id from wtmc.company_settings)';
  end if;

  -- parents first so foreign keys are satisfied
  foreach t in array array[
    'company_settings','clients','vendors','expense_categories','products','employees',
    'invoices','invoice_items','payments','expenses','expense_items','expense_payments','salary_payments'
  ]
  loop
    if not exists (select 1 from information_schema.tables where table_schema = 'wtmc' and table_name = t) then
      continue;
    end if;
    select string_agg(quote_ident(n.column_name), ', ' order by n.ordinal_position) into cols
    from information_schema.columns n
    join information_schema.columns o
      on o.table_schema = 'wtmc' and o.table_name = t and o.column_name = n.column_name
    where n.table_schema = 'public' and n.table_name = t || '_wtmc'
      and n.is_generated = 'NEVER';
    -- expense_categories are unique by name, everything else by id
    execute format(
      'insert into public.%I (%s) select %s from wtmc.%I on conflict do nothing',
      t || '_wtmc', cols, cols, t
    );
  end loop;
end $$;

select 'clients_wtmc' as table_name, count(*) from public.clients_wtmc
union all select 'invoices_wtmc', count(*) from public.invoices_wtmc
union all select 'payments_wtmc', count(*) from public.payments_wtmc
union all select 'employees_wtmc', count(*) from public.employees_wtmc
union all select 'expenses_wtmc', count(*) from public.expenses_wtmc;
