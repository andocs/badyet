-- rev-36: the account your pay goes into (asked once on payday, remembered), and which categories the Now
-- "Planned vs spent" panel shows (null = all of them). Both are additive; nothing existing changes.
alter table public.user_settings
  add column if not exists pay_account_id uuid references public.accounts (id) on delete set null,
  add column if not exists now_categories uuid[];

-- Rollback:
-- alter table public.user_settings drop column if exists pay_account_id, drop column if exists now_categories;
