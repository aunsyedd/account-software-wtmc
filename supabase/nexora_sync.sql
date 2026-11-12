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
alter table public.clients add column if not exists source text not null default 'manual';
alter table public.clients add column if not exists nexora_customer_id bigint;
alter table public.clients add column if not exists nexora_hash text;

create unique index if not exists clients_nexora_customer_id_key
  on public.clients (nexora_customer_id);

-- ---------- invoices ← Nexora invoices ----------
alter table public.invoices add column if not exists source text not null default 'manual';
alter table public.invoices add column if not exists nexora_invoice_id bigint;
alter table public.invoices add column if not exists nexora_hash text;
alter table public.invoices add column if not exists nexora_customer_id bigint;
alter table public.invoices add column if not exists nexora_customer_name text;
-- Totals exactly as Nexora calculated them (shown instead of re-calculating).
alter table public.invoices add column if not exists nexora_subtotal numeric(14,2);
alter table public.invoices add column if not exists nexora_vat numeric(14,2);
alter table public.invoices add column if not exists nexora_net numeric(14,2);
alter table public.invoices add column if not exists nexora_retention numeric(14,2);
alter table public.invoices add column if not exists nexora_due numeric(14,2);

create unique index if not exists invoices_nexora_invoice_id_key
  on public.invoices (nexora_invoice_id);

-- ---------- recreate invoice_totals so i.* includes the new columns ----------
-- (same definition as accuracy_fixes.sql)
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

grant select on public.invoice_totals to authenticated, service_role, anon;

-- Make the API see the new columns straight away.
notify pgrst, 'reload schema';
