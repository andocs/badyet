-- Installments (with optional interest) and subscriptions. Amounts in centavos.
-- "cutoff" says which cutoff the payment is made in. They feed one Essentials budget line each (see budget_lines.source).

create table public.installments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  price bigint not null check (price > 0),
  down_payment bigint not null default 0 check (down_payment >= 0),
  term_count integer not null check (term_count between 1 and 600),
  rate_bp integer check (rate_bp between 0 and 10000),
  first_due_on date not null,
  cutoff text not null check (cutoff in ('first', 'second')),
  wallet_id uuid references public.wallets (id) on delete set null,
  created_at timestamptz not null default now(),
  check (down_payment < price)
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  amount bigint not null check (amount > 0),
  cutoff text not null check (cutoff in ('first', 'second')),
  wallet_id uuid references public.wallets (id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.installments enable row level security;
alter table public.subscriptions enable row level security;

create policy "own installments: all" on public.installments for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own subscriptions: all" on public.subscriptions for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Budget lines kept in step with these lists (one per plan, cutoff and source).
alter table public.budget_lines add column source text check (source in ('installments', 'subscriptions'));
create unique index budget_lines_one_per_source on public.budget_lines (plan_id, cutoff, source) where source is not null;

-- Rollback: alter table public.budget_lines drop column source; drop table public.subscriptions; drop table public.installments;
