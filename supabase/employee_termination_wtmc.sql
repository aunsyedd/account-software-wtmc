-- ============================================================
-- WTMC Inventory Software — terminate employees
-- Paste this entire file into Supabase Dashboard → SQL Editor → Run.
-- Safe to run more than once. Run it AFTER salary_payments_wtmc.sql.
--
-- Adds:
--   * status 'terminated' for employees_wtmc (besides active / inactive)
--   * employees_wtmc.last_salary_month — the last month the employee is paid for;
--     no salary is expected after it.
--   * employees_wtmc.last_salary_date  — the date of the employee's last salary.
-- The employee and all their salary payments stay on record, marked TERMINATED.
-- ============================================================

alter table public.employees_wtmc
  add column if not exists last_salary_month date,
  add column if not exists last_salary_date date;

alter table public.employees_wtmc drop constraint if exists employees_wtmc_status_check;
alter table public.employees_wtmc
  add constraint employees_wtmc_status_check check (status in ('active','inactive','terminated'));

-- employee_payroll_wtmc is "e.*", so recreate it to pick up the new columns.
drop view if exists public.employee_payroll_wtmc;
create view public.employee_payroll_wtmc as
select
  e.*,
  (e.basic_salary + e.housing_allowance + e.other_allowance) as gross_salary
from public.employees_wtmc e;

grant select on public.employee_payroll_wtmc to authenticated, service_role, anon;

notify pgrst, 'reload schema';
