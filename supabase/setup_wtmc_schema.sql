-- ============================================================
-- WTMC Inventory Software — DATABASE SETUP in the SAME Supabase project
-- as papas-inventory-software (Faisal Ramadan).
--
-- Everything is created in its own schema "wtmc", so WTMC's clients,
-- invoices, stock, expenses and payroll stay completely separate from the
-- Faisal Ramadan data in "public". Nothing in "public" is touched.
--
-- 1. Supabase Dashboard → SQL Editor → paste this whole file → Run.
-- 2. Project Settings → Data API → "Exposed schemas" → add  wtmc  → Save.
-- Safe to run more than once.
-- ============================================================

create schema if not exists wtmc;
grant usage on schema wtmc to anon, authenticated, service_role;

-- >>>>>>>>>>>>>>>>>>>> nexora_migration.sql <<<<<<<<<<<<<<<<<<<<

-- ============================================================
-- WTMC Inventory Software — paste this entire file into
-- Supabase Dashboard → SQL Editor → Run
--
-- Safe to run more than once. Run the files in this order:
--   1. nexora_migration.sql   (tables, base views)
--   2. employees_and_vat.sql  (employees, 15% VAT columns)
--   3. accuracy_fixes.sql     (final, halala-accurate views — ALWAYS run last)
-- Re-running this file replaces the views with the basic versions, so run
-- 2 and 3 again afterwards.
-- ============================================================

create extension if not exists "pgcrypto";

-- ---------- company ----------
create table if not exists wtmc.company_settings (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Nexora Inventory Software',
  legal_name text,
  email text,
  phone text,
  address text,
  city text,
  state text,
  postal_code text,
  country text default 'Saudi Arabia',
  tax_number text,
  currency_code text not null default 'SAR',
  currency_symbol text not null default 'SAR',
  invoice_prefix text not null default 'INV-',
  next_invoice_number integer not null default 1,
  estimate_prefix text not null default 'EST-',
  next_estimate_number integer not null default 1,
  expense_prefix text not null default 'EXP-',
  next_expense_number integer not null default 1,
  default_notes text,
  default_terms text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into wtmc.company_settings (name)
select 'Nexora Inventory Software'
where not exists (select 1 from wtmc.company_settings);

-- ---------- clients ----------
create table if not exists wtmc.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  phone text,
  tax_number text,
  address text,
  city text,
  state text,
  postal_code text,
  country text,
  opening_balance numeric(14,2) not null default 0,
  notes text,
  created_at timestamptz not null default now()
);

-- ---------- vendors ----------
create table if not exists wtmc.vendors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  phone text,
  tax_number text,
  address text,
  city text,
  state text,
  postal_code text,
  country text,
  opening_balance numeric(14,2) not null default 0,
  notes text,
  created_at timestamptz not null default now()
);

-- ---------- expense categories ----------
create table if not exists wtmc.expense_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

insert into wtmc.expense_categories (name)
select x from unnest(array[
  'Office Supplies',
  'Rent',
  'Utilities',
  'Travel',
  'Marketing',
  'Professional Fees',
  'Inventory Purchase',
  'Maintenance',
  'Salaries',
  'Other'
]) as x
on conflict (name) do nothing;

-- ---------- products ----------
create table if not exists wtmc.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  unique_code text,
  barcode text,
  hsn_code text,
  unit text not null default 'pcs',
  unit_selling_price numeric(14,2) not null default 0,
  unit_purchase_price numeric(14,2) not null default 0,
  tax_name text,
  tax_rate numeric(8,2) not null default 0,
  track_inventory boolean not null default true,
  opening_stock numeric(14,3) not null default 0,
  reorder_level numeric(14,3) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists products_unique_code_idx
  on wtmc.products (unique_code)
  where unique_code is not null and unique_code <> '';

-- ---------- invoices ----------
create table if not exists wtmc.invoices (
  id uuid primary key default gen_random_uuid(),
  number text not null unique,
  title text not null default 'Invoice',
  client_id uuid references wtmc.clients(id) on delete set null,
  invoice_date date not null default current_date,
  due_date date,
  currency_code text not null default 'SAR',
  discount_amount numeric(14,2) not null default 0,
  notes text,
  terms text,
  status text not null default 'unpaid' check (status in ('draft','unpaid','partial','paid','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists wtmc.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references wtmc.invoices(id) on delete cascade,
  product_id uuid references wtmc.products(id) on delete set null,
  description text not null default '',
  qty numeric(14,3) not null default 1,
  unit_price numeric(14,2) not null default 0,
  tax_name text,
  tax_rate numeric(8,2) not null default 0,
  sort_order integer not null default 0
);

create table if not exists wtmc.payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references wtmc.invoices(id) on delete cascade,
  amount numeric(14,2) not null,
  payment_date date not null default current_date,
  payment_mode text not null default 'Cash',
  reference text,
  notes text,
  created_at timestamptz not null default now()
);

-- ---------- expenses / purchase bills ----------
create table if not exists wtmc.expenses (
  id uuid primary key default gen_random_uuid(),
  number text not null unique,
  type text not null default 'expense' check (type in ('expense','purchase_bill')),
  vendor_id uuid references wtmc.vendors(id) on delete set null,
  category_id uuid references wtmc.expense_categories(id) on delete set null,
  expense_date date not null default current_date,
  bill_number text,
  notes text,
  status text not null default 'unpaid' check (status in ('unpaid','partial','paid')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists wtmc.expense_items (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references wtmc.expenses(id) on delete cascade,
  product_id uuid references wtmc.products(id) on delete set null,
  description text not null default '',
  qty numeric(14,3) not null default 1,
  unit_price numeric(14,2) not null default 0,
  tax_name text,
  tax_amount numeric(14,2) not null default 0,
  sort_order integer not null default 0
);

create table if not exists wtmc.expense_payments (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references wtmc.expenses(id) on delete cascade,
  amount numeric(14,2) not null,
  payment_date date not null default current_date,
  payment_mode text not null default 'Cash',
  reference text,
  notes text,
  created_at timestamptz not null default now()
);

-- ---------- inventory view (purchased, sold, available) ----------
drop view if exists wtmc.product_inventory;
create view wtmc.product_inventory as
select
  p.*,
  coalesce((
    select sum(ei.qty)
    from wtmc.expense_items ei
    join wtmc.expenses e on e.id = ei.expense_id
    where ei.product_id = p.id
      and e.type = 'purchase_bill'
  ), 0) as purchased_units,
  coalesce((
    select sum(ii.qty)
    from wtmc.invoice_items ii
    join wtmc.invoices i on i.id = ii.invoice_id
    where ii.product_id = p.id
      and i.status <> 'cancelled'
      and i.status <> 'draft'
  ), 0) as sold_units,
  (
    p.opening_stock
    + coalesce((
        select sum(ei.qty)
        from wtmc.expense_items ei
        join wtmc.expenses e on e.id = ei.expense_id
        where ei.product_id = p.id
          and e.type = 'purchase_bill'
      ), 0)
    - coalesce((
        select sum(ii.qty)
        from wtmc.invoice_items ii
        join wtmc.invoices i on i.id = ii.invoice_id
        where ii.product_id = p.id
          and i.status <> 'cancelled'
          and i.status <> 'draft'
      ), 0)
  ) as available_units
from wtmc.products p;

-- ---------- invoice totals helper ----------
drop view if exists wtmc.invoice_totals;
create view wtmc.invoice_totals as
select
  i.*,
  c.name as client_name,
  coalesce(sum(ii.qty * ii.unit_price), 0) as subtotal,
  coalesce(sum(ii.qty * ii.unit_price * ii.tax_rate / 100.0), 0) as tax_total,
  coalesce(sum(ii.qty * ii.unit_price * (1 + ii.tax_rate / 100.0)), 0) - i.discount_amount as grand_total,
  coalesce((select sum(p.amount) from wtmc.payments p where p.invoice_id = i.id), 0) as paid_amount
from wtmc.invoices i
left join wtmc.clients c on c.id = i.client_id
left join wtmc.invoice_items ii on ii.invoice_id = i.id
group by i.id, c.name;

drop view if exists wtmc.expense_totals;
create view wtmc.expense_totals as
select
  e.*,
  v.name as vendor_name,
  cat.name as category_name,
  coalesce(sum(ei.qty * ei.unit_price + ei.tax_amount), 0) as grand_total,
  coalesce((select sum(p.amount) from wtmc.expense_payments p where p.expense_id = e.id), 0) as paid_amount
from wtmc.expenses e
left join wtmc.vendors v on v.id = e.vendor_id
left join wtmc.expense_categories cat on cat.id = e.category_id
left join wtmc.expense_items ei on ei.expense_id = e.id
group by e.id, v.name, cat.name;

drop view if exists wtmc.sales_details;
create view wtmc.sales_details as
select
  ii.id,
  i.id as invoice_id,
  i.number as invoice_number,
  i.invoice_date,
  c.name as client_name,
  p.id as product_id,
  coalesce(p.name, ii.description) as product_name,
  ii.qty,
  ii.unit_price,
  (ii.qty * ii.unit_price * (1 + ii.tax_rate / 100.0)) as amount
from wtmc.invoice_items ii
join wtmc.invoices i on i.id = ii.invoice_id
left join wtmc.clients c on c.id = i.client_id
left join wtmc.products p on p.id = ii.product_id
where i.status not in ('cancelled','draft');

-- ---------- next document number ----------
create or replace function wtmc.next_doc_number(kind text)
returns text
language plpgsql
as $$
declare
  settings wtmc.company_settings%rowtype;
  n integer;
  prefix text;
begin
  select * into settings from wtmc.company_settings limit 1;
  if kind = 'invoice' then
    n := settings.next_invoice_number;
    prefix := settings.invoice_prefix;
    update wtmc.company_settings set next_invoice_number = n + 1, updated_at = now() where id = settings.id;
  elsif kind = 'estimate' then
    n := settings.next_estimate_number;
    prefix := settings.estimate_prefix;
    update wtmc.company_settings set next_estimate_number = n + 1, updated_at = now() where id = settings.id;
  else
    n := settings.next_expense_number;
    prefix := settings.expense_prefix;
    update wtmc.company_settings set next_expense_number = n + 1, updated_at = now() where id = settings.id;
  end if;
  return prefix || lpad(n::text, 4, '0');
end;
$$;

-- ---------- RLS (single-tenant authenticated app) ----------
alter table wtmc.company_settings enable row level security;
alter table wtmc.clients enable row level security;
alter table wtmc.vendors enable row level security;
alter table wtmc.expense_categories enable row level security;
alter table wtmc.products enable row level security;
alter table wtmc.invoices enable row level security;
alter table wtmc.invoice_items enable row level security;
alter table wtmc.payments enable row level security;
alter table wtmc.expenses enable row level security;
alter table wtmc.expense_items enable row level security;
alter table wtmc.expense_payments enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array[
    'company_settings','clients','vendors','expense_categories','products',
    'invoices','invoice_items','payments','expenses','expense_items','expense_payments'
  ]
  loop
    execute format('drop policy if exists "auth all %I" on wtmc.%I', t, t);
    execute format(
      'create policy "auth all %I" on wtmc.%I for all to authenticated using (true) with check (true)',
      t, t
    );
    execute format('drop policy if exists "service all %I" on wtmc.%I', t, t);
    execute format(
      'create policy "service all %I" on wtmc.%I for all to service_role using (true) with check (true)',
      t, t
    );
  end loop;
end $$;

grant usage on schema wtmc to anon, authenticated, service_role;
grant select, insert, update, delete on all tables in schema wtmc to authenticated, service_role;
grant select on all tables in schema wtmc to anon;
grant usage, select on all sequences in schema wtmc to authenticated, service_role;
grant execute on function wtmc.next_doc_number(text) to authenticated, service_role;
grant select on wtmc.product_inventory, wtmc.invoice_totals, wtmc.expense_totals, wtmc.sales_details
  to authenticated, service_role, anon;

-- Switch company + invoices to Saudi Riyal (safe to re-run)
update wtmc.company_settings
set
  currency_code = 'SAR',
  currency_symbol = 'SAR',
  country = case when country is null or country = 'United States' then 'Saudi Arabia' else country end,
  updated_at = now();

update wtmc.invoices
set currency_code = 'SAR'
where currency_code is distinct from 'SAR';

-- Auth: enable Email in Authentication → Providers.
-- Authentication → Providers → Email → turn OFF "Confirm email" for first login.
-- Create a user under Authentication → Users, then sign in from the app.


-- >>>>>>>>>>>>>>>>>>>> employees_and_vat.sql <<<<<<<<<<<<<<<<<<<<

-- ============================================================
-- Nexora: Employees + 15% VAT
-- Paste in Supabase SQL Editor and Run
-- ============================================================

alter table wtmc.company_settings
  add column if not exists vat_name text not null default 'VAT';
alter table wtmc.company_settings
  add column if not exists vat_rate numeric(8,2) not null default 15;

update wtmc.company_settings
set vat_name = coalesce(nullif(vat_name, ''), 'VAT'),
    vat_rate = 15,
    updated_at = now();

update wtmc.products
set tax_name = coalesce(nullif(tax_name, ''), 'VAT'),
    tax_rate = 15
where tax_rate is null or tax_rate = 0;

alter table wtmc.expense_items
  add column if not exists tax_name text;
alter table wtmc.expense_items
  add column if not exists tax_rate numeric(8,2) not null default 15;

update wtmc.expense_items
set tax_name = coalesce(tax_name, 'VAT'),
    tax_rate = 15,
    tax_amount = round((qty * unit_price) * 0.15, 2)
where coalesce(tax_amount, 0) = 0 and qty * unit_price > 0;

update wtmc.invoice_items
set tax_name = coalesce(nullif(tax_name, ''), 'VAT'),
    tax_rate = 15
where tax_rate is null or tax_rate = 0;

create table if not exists wtmc.employees (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  job_title text,
  department text,
  email text,
  phone text,
  national_id text,
  hire_date date,
  basic_salary numeric(14,2) not null default 0,
  housing_allowance numeric(14,2) not null default 0,
  other_allowance numeric(14,2) not null default 0,
  status text not null default 'active' check (status in ('active','inactive')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace view wtmc.employee_payroll as
select
  e.*,
  (e.basic_salary + e.housing_allowance + e.other_allowance) as gross_salary
from wtmc.employees e;

drop view if exists wtmc.expense_totals;
create view wtmc.expense_totals as
select
  e.*,
  v.name as vendor_name,
  cat.name as category_name,
  coalesce(sum(ei.qty * ei.unit_price + ei.tax_amount), 0) as grand_total,
  coalesce((select sum(p.amount) from wtmc.expense_payments p where p.expense_id = e.id), 0) as paid_amount,
  coalesce(sum(ei.qty * ei.unit_price), 0) as subtotal,
  coalesce(sum(ei.tax_amount), 0) as tax_total
from wtmc.expenses e
left join wtmc.vendors v on v.id = e.vendor_id
left join wtmc.expense_categories cat on cat.id = e.category_id
left join wtmc.expense_items ei on ei.expense_id = e.id
group by e.id, v.name, cat.name;

alter table wtmc.employees enable row level security;

drop policy if exists "auth all employees" on wtmc.employees;
create policy "auth all employees" on wtmc.employees for all to authenticated using (true) with check (true);
drop policy if exists "service all employees" on wtmc.employees;
create policy "service all employees" on wtmc.employees for all to service_role using (true) with check (true);

grant select, insert, update, delete on wtmc.employees to authenticated, service_role;
grant select on wtmc.employee_payroll to authenticated, service_role, anon;
grant select on wtmc.expense_totals to authenticated, service_role, anon;


-- >>>>>>>>>>>>>>>>>>>> accuracy_fixes.sql <<<<<<<<<<<<<<<<<<<<

-- ============================================================
-- WTMC Inventory Software — accuracy fixes
-- Paste this entire file into Supabase Dashboard → SQL Editor → Run
-- Safe to run more than once.
--
-- What it fixes:
--   * Money is rounded to halalas (2 decimals) per line, like the app does.
--   * Invoice discounts are taken off BEFORE VAT (KSA VAT rule),
--     instead of being subtracted from the VAT-inclusive total.
--   * Proforma invoices are quotes: they no longer reduce stock or count as sales.
--   * Document numbers can't be handed out twice when two people save at once.
--   * Paid / partial / unpaid statuses are recalculated for every invoice and bill
--     (editing an invoice used to reset a paid invoice back to "unpaid").
-- ============================================================

-- ---------- app name ----------
alter table wtmc.company_settings
  alter column name set default 'WTMC Inventory Software';

update wtmc.company_settings
set name = 'WTMC Inventory Software', updated_at = now()
where name = 'Nexora Inventory Software';

-- ---------- invoice totals ----------
drop view if exists wtmc.invoice_totals;
create view wtmc.invoice_totals as
select
  i.*,
  c.name as client_name,
  l.subtotal,
  d.discount as applied_discount,
  l.subtotal - d.discount as taxable_amount,
  l.line_vat - round(d.discount * 15 / 100.0, 2) as tax_total,
  (l.subtotal - d.discount) + (l.line_vat - round(d.discount * 15 / 100.0, 2)) as grand_total,
  coalesce((select sum(p.amount) from wtmc.payments p where p.invoice_id = i.id), 0) as paid_amount
from wtmc.invoices i
left join wtmc.clients c on c.id = i.client_id
cross join lateral (
  select
    coalesce(sum(round(ii.qty * ii.unit_price, 2)), 0) as subtotal,
    coalesce(sum(round(round(ii.qty * ii.unit_price, 2) * ii.tax_rate / 100.0, 2)), 0) as line_vat
  from wtmc.invoice_items ii
  where ii.invoice_id = i.id
) l
cross join lateral (
  select least(greatest(i.discount_amount, 0), l.subtotal) as discount
) d;

-- ---------- expense totals ----------
drop view if exists wtmc.expense_totals;
create view wtmc.expense_totals as
select
  e.*,
  v.name as vendor_name,
  cat.name as category_name,
  l.subtotal + l.tax_total as grand_total,
  coalesce((select sum(p.amount) from wtmc.expense_payments p where p.expense_id = e.id), 0) as paid_amount,
  l.subtotal,
  l.tax_total
from wtmc.expenses e
left join wtmc.vendors v on v.id = e.vendor_id
left join wtmc.expense_categories cat on cat.id = e.category_id
cross join lateral (
  select
    coalesce(sum(round(ei.qty * ei.unit_price, 2)), 0) as subtotal,
    coalesce(sum(round(ei.tax_amount, 2)), 0) as tax_total
  from wtmc.expense_items ei
  where ei.expense_id = e.id
) l;

-- ---------- inventory (proforma invoices don't move stock) ----------
drop view if exists wtmc.product_inventory;
create view wtmc.product_inventory as
select
  p.*,
  pu.units as purchased_units,
  so.units as sold_units,
  p.opening_stock + pu.units - so.units as available_units
from wtmc.products p
cross join lateral (
  select coalesce(sum(ei.qty), 0) as units
  from wtmc.expense_items ei
  join wtmc.expenses e on e.id = ei.expense_id
  where ei.product_id = p.id
    and e.type = 'purchase_bill'
) pu
cross join lateral (
  select coalesce(sum(ii.qty), 0) as units
  from wtmc.invoice_items ii
  join wtmc.invoices i on i.id = ii.invoice_id
  where ii.product_id = p.id
    and i.status not in ('cancelled', 'draft')
    and i.title <> 'Proforma Invoice'
) so;

-- ---------- sales details ----------
drop view if exists wtmc.sales_details;
create view wtmc.sales_details as
select
  ii.id,
  i.id as invoice_id,
  i.number as invoice_number,
  i.invoice_date,
  c.name as client_name,
  p.id as product_id,
  coalesce(p.name, ii.description) as product_name,
  ii.qty,
  ii.unit_price,
  round(ii.qty * ii.unit_price, 2)
    + round(round(ii.qty * ii.unit_price, 2) * ii.tax_rate / 100.0, 2) as amount
from wtmc.invoice_items ii
join wtmc.invoices i on i.id = ii.invoice_id
left join wtmc.clients c on c.id = i.client_id
left join wtmc.products p on p.id = ii.product_id
where i.status not in ('cancelled', 'draft')
  and i.title <> 'Proforma Invoice';

-- ---------- document numbers: lock the row so two saves can't get the same number ----------
create or replace function wtmc.next_doc_number(kind text)
returns text
language plpgsql
as $$
declare
  settings wtmc.company_settings%rowtype;
  n integer;
  prefix text;
begin
  select * into settings from wtmc.company_settings order by created_at limit 1 for update;
  if kind = 'invoice' then
    n := settings.next_invoice_number;
    prefix := settings.invoice_prefix;
    update wtmc.company_settings set next_invoice_number = n + 1, updated_at = now() where id = settings.id;
  elsif kind = 'estimate' then
    n := settings.next_estimate_number;
    prefix := settings.estimate_prefix;
    update wtmc.company_settings set next_estimate_number = n + 1, updated_at = now() where id = settings.id;
  else
    n := settings.next_expense_number;
    prefix := settings.expense_prefix;
    update wtmc.company_settings set next_expense_number = n + 1, updated_at = now() where id = settings.id;
  end if;
  return prefix || lpad(n::text, 4, '0');
end;
$$;

-- ---------- payments must be positive (existing rows are not checked) ----------
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'payments_amount_positive' and connamespace = 'wtmc'::regnamespace) then
    alter table wtmc.payments add constraint payments_amount_positive check (amount > 0) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'expense_payments_amount_positive' and connamespace = 'wtmc'::regnamespace) then
    alter table wtmc.expense_payments add constraint expense_payments_amount_positive check (amount > 0) not valid;
  end if;
end $$;

-- ---------- recalculate paid / partial / unpaid ----------
update wtmc.invoices i
set status = case
    when t.grand_total > 0 and t.paid_amount >= t.grand_total then 'paid'
    when t.paid_amount > 0 then 'partial'
    else 'unpaid'
  end
from wtmc.invoice_totals t
where t.id = i.id
  and i.status not in ('cancelled', 'draft');

update wtmc.expenses e
set status = case
    when t.grand_total > 0 and t.paid_amount >= t.grand_total then 'paid'
    when t.paid_amount > 0 then 'partial'
    else 'unpaid'
  end
from wtmc.expense_totals t
where t.id = e.id;

-- ---------- permissions for the recreated views ----------
grant select on wtmc.invoice_totals, wtmc.expense_totals, wtmc.product_inventory, wtmc.sales_details
  to authenticated, service_role, anon;
grant execute on function wtmc.next_doc_number(text) to authenticated, service_role;


-- >>>>>>>>>>>>>>>>>>>> nexora_sync.sql <<<<<<<<<<<<<<<<<<<<

-- ============================================================
-- WTMC Inventory Software — Nexora Invoices sync
-- Paste this entire file into the INVENTORY Supabase project's
-- Dashboard → SQL Editor → Run.  Safe to run more than once.
--
-- Run it AFTER accuracy_fixes.sql. (If you re-run accuracy_fixes.sql later
-- that is fine too: its views pick up these columns automatically.)
--
-- Adds the columns that link inventory clients / invoices to the customers
-- and invoices created on the Nexora Invoices site (nexora-invoices-wtmc).
-- ============================================================

-- ---------- clients ← Nexora customers ----------
alter table wtmc.clients add column if not exists source text not null default 'manual';
alter table wtmc.clients add column if not exists nexora_customer_id bigint;
alter table wtmc.clients add column if not exists nexora_hash text;

create unique index if not exists clients_nexora_customer_id_key
  on wtmc.clients (nexora_customer_id);

-- ---------- invoices ← Nexora invoices ----------
alter table wtmc.invoices add column if not exists source text not null default 'manual';
alter table wtmc.invoices add column if not exists nexora_invoice_id bigint;
alter table wtmc.invoices add column if not exists nexora_hash text;
alter table wtmc.invoices add column if not exists nexora_customer_id bigint;
alter table wtmc.invoices add column if not exists nexora_customer_name text;
-- Totals exactly as Nexora calculated them (shown instead of re-calculating).
alter table wtmc.invoices add column if not exists nexora_subtotal numeric(14,2);
alter table wtmc.invoices add column if not exists nexora_vat numeric(14,2);
alter table wtmc.invoices add column if not exists nexora_net numeric(14,2);
alter table wtmc.invoices add column if not exists nexora_retention numeric(14,2);
alter table wtmc.invoices add column if not exists nexora_due numeric(14,2);

create unique index if not exists invoices_nexora_invoice_id_key
  on wtmc.invoices (nexora_invoice_id);

-- ---------- recreate invoice_totals so i.* includes the new columns ----------
-- (same definition as accuracy_fixes.sql)
drop view if exists wtmc.invoice_totals;
create view wtmc.invoice_totals as
select
  i.*,
  c.name as client_name,
  l.subtotal,
  d.discount as applied_discount,
  l.subtotal - d.discount as taxable_amount,
  l.line_vat - round(d.discount * 15 / 100.0, 2) as tax_total,
  (l.subtotal - d.discount) + (l.line_vat - round(d.discount * 15 / 100.0, 2)) as grand_total,
  coalesce((select sum(p.amount) from wtmc.payments p where p.invoice_id = i.id), 0) as paid_amount
from wtmc.invoices i
left join wtmc.clients c on c.id = i.client_id
cross join lateral (
  select
    coalesce(sum(round(ii.qty * ii.unit_price, 2)), 0) as subtotal,
    coalesce(sum(round(round(ii.qty * ii.unit_price, 2) * ii.tax_rate / 100.0, 2)), 0) as line_vat
  from wtmc.invoice_items ii
  where ii.invoice_id = i.id
) l
cross join lateral (
  select least(greatest(i.discount_amount, 0), l.subtotal) as discount
) d;

grant select on wtmc.invoice_totals to authenticated, service_role, anon;

-- Make the API see the new columns straight away.
notify pgrst, 'reload schema';


-- >>>>>>>>>>>>>>>>>>>> salary_payments.sql <<<<<<<<<<<<<<<<<<<<

-- ============================================================
-- WTMC Inventory Software — salary payments by month
-- Paste this entire file into Supabase Dashboard → SQL Editor → Run.
-- Safe to run more than once. Run it AFTER employees_and_vat.sql.
--
-- Adds:
--   * employees.salary_start_month — first month whose salary is tracked
--     (months before it are treated as already settled).
--   * salary_payments — every salary payment, tagged with the month it pays for
--     (e.g. 1,000 SAR paid on 3 Oct for September salary).
-- The app uses these to remind you which months are still unpaid or part-paid.
-- ============================================================

alter table wtmc.employees
  add column if not exists salary_start_month date;

create table if not exists wtmc.salary_payments (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references wtmc.employees(id) on delete cascade,
  salary_month date not null,               -- always the 1st day of the month paid for
  amount numeric(14,2) not null check (amount > 0),
  payment_date date not null default current_date,
  payment_mode text not null default 'Cash',
  reference text,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists salary_payments_employee_month_idx
  on wtmc.salary_payments (employee_id, salary_month);

alter table wtmc.salary_payments enable row level security;

drop policy if exists "auth all salary_payments" on wtmc.salary_payments;
create policy "auth all salary_payments" on wtmc.salary_payments
  for all to authenticated using (true) with check (true);
drop policy if exists "service all salary_payments" on wtmc.salary_payments;
create policy "service all salary_payments" on wtmc.salary_payments
  for all to service_role using (true) with check (true);

grant select, insert, update, delete on wtmc.salary_payments to authenticated, service_role;

-- employee_payroll is "e.*", so recreate it to pick up the new column.
drop view if exists wtmc.employee_payroll;
create view wtmc.employee_payroll as
select
  e.*,
  (e.basic_salary + e.housing_allowance + e.other_allowance) as gross_salary
from wtmc.employees e;

grant select on wtmc.employee_payroll to authenticated, service_role, anon;

-- Make the API see the new table and column straight away.
notify pgrst, 'reload schema';


-- Company name shown on prints
update wtmc.company_settings set legal_name = coalesce(nullif(legal_name, ''), 'Washika Tabassum Marwah Co.'), updated_at = now();


-- Company name shown on prints
update wtmc.company_settings
set name = 'WTMC Inventory Software',
    legal_name = coalesce(nullif(legal_name, ''), 'Washika Tabassum Marwah Co.'),
    updated_at = now();

notify pgrst, 'reload schema';
