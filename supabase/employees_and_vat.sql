-- ============================================================
-- Nexora: Employees + 15% VAT
-- Paste in Supabase SQL Editor and Run
-- ============================================================

alter table public.company_settings
  add column if not exists vat_name text not null default 'VAT';
alter table public.company_settings
  add column if not exists vat_rate numeric(8,2) not null default 15;

update public.company_settings
set vat_name = coalesce(nullif(vat_name, ''), 'VAT'),
    vat_rate = 15,
    updated_at = now();

update public.products
set tax_name = coalesce(nullif(tax_name, ''), 'VAT'),
    tax_rate = 15
where tax_rate is null or tax_rate = 0;

alter table public.expense_items
  add column if not exists tax_name text;
alter table public.expense_items
  add column if not exists tax_rate numeric(8,2) not null default 15;

update public.expense_items
set tax_name = coalesce(tax_name, 'VAT'),
    tax_rate = 15,
    tax_amount = round((qty * unit_price) * 0.15, 2)
where coalesce(tax_amount, 0) = 0 and qty * unit_price > 0;

update public.invoice_items
set tax_name = coalesce(nullif(tax_name, ''), 'VAT'),
    tax_rate = 15
where tax_rate is null or tax_rate = 0;

create table if not exists public.employees (
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

create or replace view public.employee_payroll as
select
  e.*,
  (e.basic_salary + e.housing_allowance + e.other_allowance) as gross_salary
from public.employees e;

drop view if exists public.expense_totals;
create view public.expense_totals as
select
  e.*,
  v.name as vendor_name,
  cat.name as category_name,
  coalesce(sum(ei.qty * ei.unit_price + ei.tax_amount), 0) as grand_total,
  coalesce((select sum(p.amount) from public.expense_payments p where p.expense_id = e.id), 0) as paid_amount,
  coalesce(sum(ei.qty * ei.unit_price), 0) as subtotal,
  coalesce(sum(ei.tax_amount), 0) as tax_total
from public.expenses e
left join public.vendors v on v.id = e.vendor_id
left join public.expense_categories cat on cat.id = e.category_id
left join public.expense_items ei on ei.expense_id = e.id
group by e.id, v.name, cat.name;

alter table public.employees enable row level security;

drop policy if exists "auth all employees" on public.employees;
create policy "auth all employees" on public.employees for all to authenticated using (true) with check (true);
drop policy if exists "service all employees" on public.employees;
create policy "service all employees" on public.employees for all to service_role using (true) with check (true);

grant select, insert, update, delete on public.employees to authenticated, service_role;
grant select on public.employee_payroll to authenticated, service_role, anon;
grant select on public.expense_totals to authenticated, service_role, anon;
