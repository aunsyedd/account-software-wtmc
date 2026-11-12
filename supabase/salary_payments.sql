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

alter table public.employees
  add column if not exists salary_start_month date;

create table if not exists public.salary_payments (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  salary_month date not null,               -- always the 1st day of the month paid for
  amount numeric(14,2) not null check (amount > 0),
  payment_date date not null default current_date,
  payment_mode text not null default 'Cash',
  reference text,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists salary_payments_employee_month_idx
  on public.salary_payments (employee_id, salary_month);

alter table public.salary_payments enable row level security;

drop policy if exists "auth all salary_payments" on public.salary_payments;
create policy "auth all salary_payments" on public.salary_payments
  for all to authenticated using (true) with check (true);
drop policy if exists "service all salary_payments" on public.salary_payments;
create policy "service all salary_payments" on public.salary_payments
  for all to service_role using (true) with check (true);

grant select, insert, update, delete on public.salary_payments to authenticated, service_role;

-- employee_payroll is "e.*", so recreate it to pick up the new column.
drop view if exists public.employee_payroll;
create view public.employee_payroll as
select
  e.*,
  (e.basic_salary + e.housing_allowance + e.other_allowance) as gross_salary
from public.employees e;

grant select on public.employee_payroll to authenticated, service_role, anon;

-- Make the API see the new table and column straight away.
notify pgrst, 'reload schema';
