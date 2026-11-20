-- v13 rehaul, slice 1a: new tables (additive). Nothing old is dropped or changed except new columns on user_settings,
-- so the current app keeps working until slice 7 retires it. See docs/rehaul/model.md.
-- Money = centavos (bigint), percentages = basis points (int), months = date on the 1st.
-- NAMING: the new budget table is `budget_lines_v2` because `budget_lines` (with plan_id) still serves the old pages.
-- Slice 7 drops the old one and renames this one.
-- SECURITY: every table has user_id default auth.uid() and single-owner RLS (policies built at the bottom).
-- Child rows may only point at parents the same user owns. No card numbers, CVV, PIN or raw notification text anywhere.

-- ---------- settings ----------
alter table public.user_settings
  add column first_payday_day integer not null default 10 check (first_payday_day between 1 and 28),
  add column second_payday_day integer not null default 25 check (second_payday_day between 1 and 28),
  add column timezone text not null default 'Asia/Manila',
  add column notif_capture_enabled boolean not null default false,
  add column hide_amounts boolean not null default false,
  add column office_days smallint[] not null default '{1,2}' check (office_days <@ array[1,2,3,4,5,6,7]::smallint[]),
  add column rto_amount bigint not null default 0 check (rto_amount >= 0);

-- ---------- accounts and balances ----------
create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 30),
  kind text not null default 'ewallet' check (kind in ('ewallet', 'debit', 'savings', 'credit', 'cash')),
  institution text check (institution is null or char_length(institution) between 1 and 40),
  last4 text check (last4 is null or last4 ~ '^[0-9]{4}$'),
  color text check (color is null or color ~ '^#[0-9a-fA-F]{6}$'),
  receive_qr_path text check (receive_qr_path is null or char_length(receive_qr_path) <= 200),
  credit_limit bigint check (credit_limit is null or (credit_limit > 0 and credit_limit <= 100000000000)),
  statement_day smallint check (statement_day is null or statement_day between 1 and 31),
  due_day smallint check (due_day is null or due_day between 1 and 31),
  sort integer not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  constraint accounts_credit_only check (kind = 'credit' or (credit_limit is null and statement_day is null and due_day is null))
);
create unique index accounts_unique_name on public.accounts (user_id, lower(name)) where archived_at is null;

create table public.balance_anchors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  account_id uuid not null references public.accounts (id) on delete cascade,
  as_of timestamptz not null,
  amount bigint not null check (amount between -100000000000 and 100000000000),
  source text not null check (source in ('wizard', 'reconcile', 'import', 'migration'))
);
create index balance_anchors_latest on public.balance_anchors (account_id, as_of desc);

-- ---------- categories and budget lines ----------
create table public.category_groups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  sort integer not null default 0,
  feeds_savings boolean not null default false,
  archived_at timestamptz
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  group_id uuid not null references public.category_groups (id) on delete restrict,
  name text not null check (char_length(name) between 1 and 60),
  color text check (color is null or color ~ '^#[0-9a-fA-F]{6}$'),
  sort integer not null default 0,
  archived_at timestamptz
);

create table public.budget_lines_v2 (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete restrict,
  name text not null check (char_length(name) between 1 and 60),
  rule text not null default 'fixed' check (rule in ('fixed', 'pct', 'rest')),
  amount bigint check (amount between -10000000000 and 10000000000),
  pct_bp integer check (pct_bp between 0 and 10000),
  cutoff text not null check (cutoff in ('first', 'second', 'both')),
  account_id uuid references public.accounts (id) on delete set null,
  starts_on date,
  ends_on date,
  is_draft boolean not null default false,
  sort integer not null default 0,
  source text not null default 'manual' check (source in ('manual', 'installment', 'subscription')),
  source_id uuid,
  counts_to_daily boolean not null default false,
  kind text not null default 'normal' check (kind in ('normal', 'rto', 'rto_contingency')),
  created_at timestamptz not null default now(),
  constraint v2_rule_fields check (
    (rule = 'fixed' and amount is not null) or (rule = 'pct' and pct_bp is not null) or rule = 'rest'),
  constraint v2_dates check (ends_on is null or starts_on is null or ends_on >= starts_on)
);
create unique index budget_lines_v2_one_contingency on public.budget_lines_v2 (user_id) where kind = 'rto_contingency';
create index budget_lines_v2_category on public.budget_lines_v2 (category_id);

-- ---------- transactions ----------
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  account_id uuid not null references public.accounts (id) on delete cascade,
  occurred_at timestamptz not null,
  amount bigint not null check (amount between -100000000000 and 100000000000), -- negative = money out
  merchant text check (merchant is null or char_length(merchant) <= 80),
  kind text not null check (kind in ('expense', 'income', 'transfer')),
  category_id uuid references public.categories (id) on delete set null,
  budget_line_id uuid references public.budget_lines_v2 (id) on delete set null,
  transfer_peer_id uuid references public.transactions (id) on delete set null,
  source text not null check (source in ('notification', 'manual', 'transfer', 'import', 'bonus')),
  status text not null default 'confirmed' check (status in ('pending', 'confirmed', 'ignored')),
  confirmed_at timestamptz,
  note text check (note is null or char_length(note) <= 200),
  dedupe_hash text, -- hash of account+amount+time+merchant; the raw notification text is never stored
  created_at timestamptz not null default now()
);
create unique index transactions_dedupe on public.transactions (user_id, dedupe_hash) where dedupe_hash is not null;
create index transactions_account_time on public.transactions (account_id, occurred_at);
create index transactions_status on public.transactions (user_id, status);
create index transactions_category_time on public.transactions (category_id, occurred_at);

create table public.merchant_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  pattern text not null check (char_length(pattern) between 1 and 80),
  category_id uuid not null references public.categories (id) on delete cascade,
  account_id uuid references public.accounts (id) on delete cascade,
  priority integer not null default 0,
  created_at timestamptz not null default now()
);

-- ---------- salary ----------
create table public.allowances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  payslip_cutoff text not null check (payslip_cutoff in ('first', 'second')),
  name text not null check (char_length(name) between 1 and 60),
  amount bigint not null check (amount >= 0),
  frequency text not null default 'monthly' check (frequency in ('monthly', 'yearly')),
  pay_month integer check (pay_month between 1 and 12),
  taxable boolean not null default false,
  starts_on date not null,
  ends_on date,
  constraint allowance_yearly_month check (frequency = 'monthly' or pay_month is not null)
);

create table public.salary_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  effective_month date not null check (extract(day from effective_month) = 1),
  kind text not null check (kind in ('start', 'merit', 'promotion', 'allowance', 'adjustment')),
  pct_bp integer check (pct_bp between -10000 and 100000), -- merit by percent
  new_base bigint check (new_base > 0), -- monthly base: start, promotion, merit by amount
  allowance_id uuid references public.allowances (id) on delete set null,
  one_off_amount bigint check (one_off_amount between -100000000000 and 100000000000),
  one_off_taxable boolean not null default false,
  title text check (title is null or char_length(title) <= 60),
  grade text check (grade is null or char_length(grade) <= 30),
  status text not null default 'confirmed' check (status in ('confirmed', 'expected')),
  note text check (note is null or char_length(note) <= 200),
  created_at timestamptz not null default now(),
  constraint salary_event_fields check (
    (kind = 'start' and new_base is not null) or
    (kind = 'promotion' and new_base is not null) or
    (kind = 'merit' and (pct_bp is not null or new_base is not null)) or
    (kind = 'allowance' and allowance_id is not null) or
    (kind = 'adjustment' and one_off_amount is not null))
);
create index salary_events_month on public.salary_events (user_id, effective_month);

create table public.raise_allocations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  salary_event_id uuid not null references public.salary_events (id) on delete cascade,
  budget_line_id uuid not null references public.budget_lines_v2 (id) on delete cascade,
  mode text not null check (mode in ('amount', 'percent')),
  amount bigint check (amount >= 0),
  pct_bp integer check (pct_bp between 0 and 10000),
  constraint raise_alloc_fields check ((mode = 'amount' and amount is not null) or (mode = 'percent' and pct_bp is not null))
);

create table public.pay_settings (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  sss_override bigint check (sss_override >= 0),
  philhealth_override bigint check (philhealth_override >= 0),
  pagibig_override bigint check (pagibig_override >= 0),
  tax_override_first bigint check (tax_override_first >= 0),
  tax_override_second bigint check (tax_override_second >= 0),
  other_deduction bigint not null default 0 check (other_deduction >= 0),
  savings_plan_bp integer not null default 0 check (savings_plan_bp between 0 and 10000),
  updated_at timestamptz not null default now()
);

create table public.tax_table_versions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  effective_from date not null,
  kind text not null check (kind in ('income_tax', 'sss', 'philhealth', 'pagibig')),
  params jsonb not null,
  unique (user_id, kind, effective_from)
);

create table public.plan_assumptions (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  cip_multiplier_num integer not null default 125 check (cip_multiplier_num > 0),
  assumed_raise_on boolean not null default false,
  assumed_raise_bp integer not null default 0 check (assumed_raise_bp between 0 and 100000),
  assumed_raise_month integer not null default 3 check (assumed_raise_month between 1 and 12)
);

create table public.payslip_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  cutoff text not null check (cutoff in ('first', 'second')),
  effective_month date not null check (extract(day from effective_month) = 1),
  unique (user_id, cutoff, effective_month)
);

create table public.payslip_lines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  template_id uuid not null references public.payslip_templates (id) on delete cascade,
  kind text not null check (kind in ('earning', 'deduction')),
  label text not null check (char_length(label) between 1 and 60),
  source text not null check (source in ('base_share', 'income_tax', 'sss', 'philhealth', 'pagibig', 'allowance', 'custom')),
  share_bp integer check (share_bp between 0 and 10000),
  allowance_id uuid references public.allowances (id) on delete set null,
  amount_override bigint check (amount_override >= 0),
  sort integer not null default 0
);

-- ---------- bonuses ----------
create table public.bonus_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  payslip_cutoff text not null check (payslip_cutoff in ('first', 'second')),
  recurrence text not null check (recurrence in ('yearly', 'once')),
  kind text not null check (kind in ('thirteenth', 'cip', 'custom', 'oneoff')),
  name text not null check (char_length(name) between 1 and 60),
  pay_month integer not null check (pay_month between 1 and 12),
  once_on date,
  formula text not null check (formula in ('base_multiple', 'eligible_x_component_x_multiplier', 'fixed')),
  base_multiple_bp integer check (base_multiple_bp > 0),
  eligible_amount bigint check (eligible_amount > 0), -- CIP: eligible earnings
  component_num bigint check (component_num > 0), -- over 10,000,000
  fixed_amount bigint check (fixed_amount > 0),
  de_minimis bigint not null default 0 check (de_minimis >= 0 and de_minimis <= 100000000000),
  sort integer not null default 0,
  archived_at timestamptz,
  constraint bonus_no_de_minimis_on_13th check (kind <> 'thirteenth' or de_minimis = 0),
  constraint bonus_once_has_date check (recurrence = 'yearly' or once_on is not null),
  constraint bonus_formula_fields check (
    (formula = 'base_multiple' and base_multiple_bp is not null) or
    (formula = 'eligible_x_component_x_multiplier' and eligible_amount is not null and component_num is not null) or
    (formula = 'fixed' and fixed_amount is not null))
);

create table public.bonus_splits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  rule_id uuid not null references public.bonus_rules (id) on delete cascade,
  target_kind text not null check (target_kind in ('fund', 'gift', 'purchase', 'debt', 'wants', 'account')),
  target_id uuid,
  label text check (label is null or char_length(label) <= 60),
  mode text not null default 'amount' check (mode in ('amount', 'percent')),
  amount bigint check (amount >= 0),
  pct_bp integer check (pct_bp between 0 and 10000),
  sort integer not null default 0,
  constraint split_fields check ((mode = 'amount' and amount is not null) or (mode = 'percent' and pct_bp is not null))
);

create table public.bonus_instances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  rule_id uuid not null references public.bonus_rules (id) on delete cascade,
  year integer not null check (year between 2000 and 2200),
  multiplier_num integer check (multiplier_num > 0),
  status text not null default 'planned' check (status in ('planned', 'received')),
  gross_actual bigint,
  de_minimis_actual bigint,
  tax_actual bigint,
  net_actual bigint,
  received_transaction_id uuid references public.transactions (id) on delete set null,
  unique (rule_id, year)
);

create table public.bonus_instance_splits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  instance_id uuid not null references public.bonus_instances (id) on delete cascade,
  target_kind text not null check (target_kind in ('fund', 'gift', 'purchase', 'debt', 'wants', 'account')),
  target_id uuid,
  label text check (label is null or char_length(label) <= 60),
  amount bigint not null check (amount >= 0),
  done boolean not null default false,
  done_transaction_id uuid references public.transactions (id) on delete set null
);

-- ---------- funds and overrides ----------
create table public.funds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  color text check (color is null or color ~ '^#[0-9a-fA-F]{6}$'),
  priority integer not null default 1 check (priority >= 1),
  rule text not null check (rule in ('steps', 'cap', 'reset', 'fixed')),
  target bigint check (target >= 0),
  tranches bigint[],
  max_per_month bigint check (max_per_month >= 0),
  fixed_amount bigint check (fixed_amount >= 0),
  reset_month integer check (reset_month between 1 and 12),
  linked_account_id uuid references public.accounts (id) on delete set null,
  share_bp integer check (share_bp between 0 and 10000), -- virtual share of a linked account shared with other funds
  start_balance bigint check (start_balance >= 0),
  archived_at timestamptz
);

create table public.month_overrides (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  month date not null check (extract(day from month) = 1),
  fund_order uuid[],
  note text check (note is null or char_length(note) <= 200),
  created_at timestamptz not null default now(),
  unique (user_id, month)
);

create table public.month_fund_overrides (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  override_id uuid not null references public.month_overrides (id) on delete cascade,
  fund_id uuid not null references public.funds (id) on delete cascade,
  pin_amount bigint check (pin_amount >= 0),
  skip boolean not null default false,
  unique (override_id, fund_id),
  constraint pin_or_skip check (not (skip and pin_amount is not null))
);

-- ---------- pools and office days ----------
create table public.pools (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  budget_line_id uuid references public.budget_lines_v2 (id) on delete set null,
  keep_up_to bigint check (keep_up_to >= 0)
);

create table public.pool_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  pool_id uuid not null references public.pools (id) on delete cascade,
  occurred_on date not null,
  kind text not null check (kind in ('fund', 'use', 'to_wants', 'settle_to_pool', 'settle_to_wants', 'over_from_wants', 'over_from_excess')),
  amount bigint not null check (amount between -100000000000 and 100000000000),
  note text check (note is null or char_length(note) <= 200),
  transaction_id uuid references public.transactions (id) on delete set null
);

create table public.office_day_overrides (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day date not null,
  in_office boolean not null,
  primary key (user_id, day)
);

-- ---------- row level security ----------
-- spec: 'table' or 'table:fk_column:parent_table'. Child inserts must point at a parent the same user owns.
do $$
declare
  spec text;
  t text;
  fk text;
  parent text;
  parts text[];
  check_sql text;
  checks text[];
begin
  foreach spec in array array[
    'accounts', 'balance_anchors:account_id:accounts',
    'category_groups', 'categories:group_id:category_groups',
    'budget_lines_v2:category_id:categories',
    'transactions:account_id:accounts', 'merchant_rules:category_id:categories',
    'allowances', 'salary_events', 'raise_allocations:salary_event_id:salary_events',
    'pay_settings', 'tax_table_versions', 'plan_assumptions',
    'payslip_templates', 'payslip_lines:template_id:payslip_templates',
    'bonus_rules', 'bonus_splits:rule_id:bonus_rules', 'bonus_instances:rule_id:bonus_rules',
    'bonus_instance_splits:instance_id:bonus_instances',
    'funds', 'month_overrides', 'month_fund_overrides:override_id:month_overrides',
    'pools', 'pool_entries:pool_id:pools', 'office_day_overrides'
  ] loop
    parts := string_to_array(spec, ':');
    t := parts[1];
    check_sql := 'user_id = auth.uid()';
    if array_length(parts, 1) = 3 then
      fk := parts[2];
      parent := parts[3];
      check_sql := check_sql || format(' and exists (select 1 from public.%I p where p.id = %I and p.user_id = auth.uid())', parent, fk);
    end if;
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select to authenticated using (user_id = auth.uid())', 'own ' || t || ': select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (%s)', 'own ' || t || ': insert', t, check_sql);
    execute format('create policy %I on public.%I for update to authenticated using (user_id = auth.uid()) with check (%s)', 'own ' || t || ': update', t, check_sql);
    execute format('create policy %I on public.%I for delete to authenticated using (user_id = auth.uid())', 'own ' || t || ': delete', t);
  end loop;
end $$;

-- Rollback (children first; nothing old was touched):
-- drop table public.office_day_overrides, public.pool_entries, public.pools, public.month_fund_overrides, public.month_overrides,
--   public.funds, public.bonus_instance_splits, public.bonus_instances, public.bonus_splits, public.bonus_rules,
--   public.payslip_lines, public.payslip_templates, public.plan_assumptions, public.tax_table_versions, public.pay_settings,
--   public.raise_allocations, public.salary_events, public.allowances, public.merchant_rules, public.transactions,
--   public.budget_lines_v2, public.categories, public.category_groups, public.balance_anchors, public.accounts;
-- alter table public.user_settings drop column first_payday_day, drop column second_payday_day, drop column timezone,
--   drop column notif_capture_enabled, drop column hide_amounts, drop column office_days, drop column rto_amount;
