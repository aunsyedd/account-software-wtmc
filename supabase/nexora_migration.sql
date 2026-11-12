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
create table if not exists public.company_settings (
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

insert into public.company_settings (name)
select 'Nexora Inventory Software'
where not exists (select 1 from public.company_settings);

-- ---------- clients ----------
create table if not exists public.clients (
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
create table if not exists public.vendors (
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
create table if not exists public.expense_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

insert into public.expense_categories (name)
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
create table if not exists public.products (
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
  on public.products (unique_code)
  where unique_code is not null and unique_code <> '';

-- ---------- invoices ----------
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  number text not null unique,
  title text not null default 'Invoice',
  client_id uuid references public.clients(id) on delete set null,
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

create table if not exists public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  description text not null default '',
  qty numeric(14,3) not null default 1,
  unit_price numeric(14,2) not null default 0,
  tax_name text,
  tax_rate numeric(8,2) not null default 0,
  sort_order integer not null default 0
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  amount numeric(14,2) not null,
  payment_date date not null default current_date,
  payment_mode text not null default 'Cash',
  reference text,
  notes text,
  created_at timestamptz not null default now()
);

-- ---------- expenses / purchase bills ----------
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  number text not null unique,
  type text not null default 'expense' check (type in ('expense','purchase_bill')),
  vendor_id uuid references public.vendors(id) on delete set null,
  category_id uuid references public.expense_categories(id) on delete set null,
  expense_date date not null default current_date,
  bill_number text,
  notes text,
  status text not null default 'unpaid' check (status in ('unpaid','partial','paid')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.expense_items (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.expenses(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  description text not null default '',
  qty numeric(14,3) not null default 1,
  unit_price numeric(14,2) not null default 0,
  tax_name text,
  tax_amount numeric(14,2) not null default 0,
  sort_order integer not null default 0
);

create table if not exists public.expense_payments (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.expenses(id) on delete cascade,
  amount numeric(14,2) not null,
  payment_date date not null default current_date,
  payment_mode text not null default 'Cash',
  reference text,
  notes text,
  created_at timestamptz not null default now()
);

-- ---------- inventory view (purchased, sold, available) ----------
drop view if exists public.product_inventory;
create view public.product_inventory as
select
  p.*,
  coalesce((
    select sum(ei.qty)
    from public.expense_items ei
    join public.expenses e on e.id = ei.expense_id
    where ei.product_id = p.id
      and e.type = 'purchase_bill'
  ), 0) as purchased_units,
  coalesce((
    select sum(ii.qty)
    from public.invoice_items ii
    join public.invoices i on i.id = ii.invoice_id
    where ii.product_id = p.id
      and i.status <> 'cancelled'
      and i.status <> 'draft'
  ), 0) as sold_units,
  (
    p.opening_stock
    + coalesce((
        select sum(ei.qty)
        from public.expense_items ei
        join public.expenses e on e.id = ei.expense_id
        where ei.product_id = p.id
          and e.type = 'purchase_bill'
      ), 0)
    - coalesce((
        select sum(ii.qty)
        from public.invoice_items ii
        join public.invoices i on i.id = ii.invoice_id
        where ii.product_id = p.id
          and i.status <> 'cancelled'
          and i.status <> 'draft'
      ), 0)
  ) as available_units
from public.products p;

-- ---------- invoice totals helper ----------
drop view if exists public.invoice_totals;
create view public.invoice_totals as
select
  i.*,
  c.name as client_name,
  coalesce(sum(ii.qty * ii.unit_price), 0) as subtotal,
  coalesce(sum(ii.qty * ii.unit_price * ii.tax_rate / 100.0), 0) as tax_total,
  coalesce(sum(ii.qty * ii.unit_price * (1 + ii.tax_rate / 100.0)), 0) - i.discount_amount as grand_total,
  coalesce((select sum(p.amount) from public.payments p where p.invoice_id = i.id), 0) as paid_amount
from public.invoices i
left join public.clients c on c.id = i.client_id
left join public.invoice_items ii on ii.invoice_id = i.id
group by i.id, c.name;

drop view if exists public.expense_totals;
create view public.expense_totals as
select
  e.*,
  v.name as vendor_name,
  cat.name as category_name,
  coalesce(sum(ei.qty * ei.unit_price + ei.tax_amount), 0) as grand_total,
  coalesce((select sum(p.amount) from public.expense_payments p where p.expense_id = e.id), 0) as paid_amount
from public.expenses e
left join public.vendors v on v.id = e.vendor_id
left join public.expense_categories cat on cat.id = e.category_id
left join public.expense_items ei on ei.expense_id = e.id
group by e.id, v.name, cat.name;

drop view if exists public.sales_details;
create view public.sales_details as
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
from public.invoice_items ii
join public.invoices i on i.id = ii.invoice_id
left join public.clients c on c.id = i.client_id
left join public.products p on p.id = ii.product_id
where i.status not in ('cancelled','draft');

-- ---------- next document number ----------
create or replace function public.next_doc_number(kind text)
returns text
language plpgsql
as $$
declare
  settings public.company_settings%rowtype;
  n integer;
  prefix text;
begin
  select * into settings from public.company_settings limit 1;
  if kind = 'invoice' then
    n := settings.next_invoice_number;
    prefix := settings.invoice_prefix;
    update public.company_settings set next_invoice_number = n + 1, updated_at = now() where id = settings.id;
  elsif kind = 'estimate' then
    n := settings.next_estimate_number;
    prefix := settings.estimate_prefix;
    update public.company_settings set next_estimate_number = n + 1, updated_at = now() where id = settings.id;
  else
    n := settings.next_expense_number;
    prefix := settings.expense_prefix;
    update public.company_settings set next_expense_number = n + 1, updated_at = now() where id = settings.id;
  end if;
  return prefix || lpad(n::text, 4, '0');
end;
$$;

-- ---------- RLS (single-tenant authenticated app) ----------
alter table public.company_settings enable row level security;
alter table public.clients enable row level security;
alter table public.vendors enable row level security;
alter table public.expense_categories enable row level security;
alter table public.products enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
alter table public.payments enable row level security;
alter table public.expenses enable row level security;
alter table public.expense_items enable row level security;
alter table public.expense_payments enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array[
    'company_settings','clients','vendors','expense_categories','products',
    'invoices','invoice_items','payments','expenses','expense_items','expense_payments'
  ]
  loop
    execute format('drop policy if exists "auth all %I" on public.%I', t, t);
    execute format(
      'create policy "auth all %I" on public.%I for all to authenticated using (true) with check (true)',
      t, t
    );
    execute format('drop policy if exists "service all %I" on public.%I', t, t);
    execute format(
      'create policy "service all %I" on public.%I for all to service_role using (true) with check (true)',
      t, t
    );
  end loop;
end $$;

grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to authenticated, service_role;
grant select on all tables in schema public to anon;
grant usage, select on all sequences in schema public to authenticated, service_role;
grant execute on function public.next_doc_number(text) to authenticated, service_role;
grant select on public.product_inventory, public.invoice_totals, public.expense_totals, public.sales_details
  to authenticated, service_role, anon;

-- Switch company + invoices to Saudi Riyal (safe to re-run)
update public.company_settings
set
  currency_code = 'SAR',
  currency_symbol = 'SAR',
  country = case when country is null or country = 'United States' then 'Saudi Arabia' else country end,
  updated_at = now();

update public.invoices
set currency_code = 'SAR'
where currency_code is distinct from 'SAR';

-- Auth: enable Email in Authentication → Providers.
-- Authentication → Providers → Email → turn OFF "Confirm email" for first login.
-- Create a user under Authentication → Users, then sign in from the app.
