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
alter table public.company_settings
  alter column name set default 'WTMC Inventory Software';

update public.company_settings
set name = 'WTMC Inventory Software', updated_at = now()
where name = 'Nexora Inventory Software';

-- ---------- invoice totals ----------
drop view if exists public.invoice_totals;
create view public.invoice_totals as
select
  i.*,
  c.name as client_name,
  l.subtotal,
  d.discount as applied_discount,
  l.subtotal - d.discount as taxable_amount,
  l.line_vat - round(d.discount * 15 / 100.0, 2) as tax_total,
  (l.subtotal - d.discount) + (l.line_vat - round(d.discount * 15 / 100.0, 2)) as grand_total,
  coalesce((select sum(p.amount) from public.payments p where p.invoice_id = i.id), 0) as paid_amount
from public.invoices i
left join public.clients c on c.id = i.client_id
cross join lateral (
  select
    coalesce(sum(round(ii.qty * ii.unit_price, 2)), 0) as subtotal,
    coalesce(sum(round(round(ii.qty * ii.unit_price, 2) * ii.tax_rate / 100.0, 2)), 0) as line_vat
  from public.invoice_items ii
  where ii.invoice_id = i.id
) l
cross join lateral (
  select least(greatest(i.discount_amount, 0), l.subtotal) as discount
) d;

-- ---------- expense totals ----------
drop view if exists public.expense_totals;
create view public.expense_totals as
select
  e.*,
  v.name as vendor_name,
  cat.name as category_name,
  l.subtotal + l.tax_total as grand_total,
  coalesce((select sum(p.amount) from public.expense_payments p where p.expense_id = e.id), 0) as paid_amount,
  l.subtotal,
  l.tax_total
from public.expenses e
left join public.vendors v on v.id = e.vendor_id
left join public.expense_categories cat on cat.id = e.category_id
cross join lateral (
  select
    coalesce(sum(round(ei.qty * ei.unit_price, 2)), 0) as subtotal,
    coalesce(sum(round(ei.tax_amount, 2)), 0) as tax_total
  from public.expense_items ei
  where ei.expense_id = e.id
) l;

-- ---------- inventory (proforma invoices don't move stock) ----------
drop view if exists public.product_inventory;
create view public.product_inventory as
select
  p.*,
  pu.units as purchased_units,
  so.units as sold_units,
  p.opening_stock + pu.units - so.units as available_units
from public.products p
cross join lateral (
  select coalesce(sum(ei.qty), 0) as units
  from public.expense_items ei
  join public.expenses e on e.id = ei.expense_id
  where ei.product_id = p.id
    and e.type = 'purchase_bill'
) pu
cross join lateral (
  select coalesce(sum(ii.qty), 0) as units
  from public.invoice_items ii
  join public.invoices i on i.id = ii.invoice_id
  where ii.product_id = p.id
    and i.status not in ('cancelled', 'draft')
    and i.title <> 'Proforma Invoice'
) so;

-- ---------- sales details ----------
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
  round(ii.qty * ii.unit_price, 2)
    + round(round(ii.qty * ii.unit_price, 2) * ii.tax_rate / 100.0, 2) as amount
from public.invoice_items ii
join public.invoices i on i.id = ii.invoice_id
left join public.clients c on c.id = i.client_id
left join public.products p on p.id = ii.product_id
where i.status not in ('cancelled', 'draft')
  and i.title <> 'Proforma Invoice';

-- ---------- document numbers: lock the row so two saves can't get the same number ----------
create or replace function public.next_doc_number(kind text)
returns text
language plpgsql
as $$
declare
  settings public.company_settings%rowtype;
  n integer;
  prefix text;
begin
  select * into settings from public.company_settings order by created_at limit 1 for update;
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

-- ---------- payments must be positive (existing rows are not checked) ----------
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'payments_amount_positive') then
    alter table public.payments add constraint payments_amount_positive check (amount > 0) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'expense_payments_amount_positive') then
    alter table public.expense_payments add constraint expense_payments_amount_positive check (amount > 0) not valid;
  end if;
end $$;

-- ---------- recalculate paid / partial / unpaid ----------
update public.invoices i
set status = case
    when t.grand_total > 0 and t.paid_amount >= t.grand_total then 'paid'
    when t.paid_amount > 0 then 'partial'
    else 'unpaid'
  end
from public.invoice_totals t
where t.id = i.id
  and i.status not in ('cancelled', 'draft');

update public.expenses e
set status = case
    when t.grand_total > 0 and t.paid_amount >= t.grand_total then 'paid'
    when t.paid_amount > 0 then 'partial'
    else 'unpaid'
  end
from public.expense_totals t
where t.id = e.id;

-- ---------- permissions for the recreated views ----------
grant select on public.invoice_totals, public.expense_totals, public.product_inventory, public.sales_details
  to authenticated, service_role, anon;
grant execute on function public.next_doc_number(text) to authenticated, service_role;
