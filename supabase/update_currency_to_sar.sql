-- Paste this in Supabase SQL Editor if you already ran the first migration.
-- Switches Nexora to Saudi Riyal (SAR).

alter table public.company_settings
  alter column currency_code set default 'SAR',
  alter column currency_symbol set default 'SAR',
  alter column country set default 'Saudi Arabia';

alter table public.invoices
  alter column currency_code set default 'SAR';

update public.company_settings
set
  currency_code = 'SAR',
  currency_symbol = 'SAR',
  country = case when country is null or country = 'United States' then 'Saudi Arabia' else country end,
  updated_at = now();

update public.invoices
set currency_code = 'SAR'
where currency_code is distinct from 'SAR';
