-- rev-60: lending money to other people, and transfers to an account that is not yours ("Others").
-- A loan says who owes you, when you expect it back, and what it came out of (Wants, a budget line, a savings fund or a bonus).
-- The money's own transaction stays in transactions (as a transfer, so it is never spending or income).

create table if not exists public.loans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  borrower text not null check (char_length(borrower) between 1 and 80),
  amount bigint not null check (amount > 0 and amount <= 100000000000),
  lent_on date not null,
  due_on date not null,
  from_kind text not null default 'none' check (from_kind in ('none', 'wants', 'line', 'fund', 'bonus')),
  -- A budget line or fund id, or "rule id|year" for a bonus. The name is kept too, so a deleted source still reads right.
  from_ref text check (from_ref is null or char_length(from_ref) <= 80),
  from_name text check (from_name is null or char_length(from_name) <= 80),
  account_id uuid references public.accounts (id) on delete set null,
  txn_id uuid references public.transactions (id) on delete set null,
  -- true = the app added that transaction for this loan, so removing the loan removes it too.
  txn_added boolean not null default false,
  note text check (note is null or char_length(note) <= 200),
  created_at timestamptz not null default now()
);
create index if not exists loans_user_idx on public.loans (user_id, due_on);
create unique index if not exists loans_one_per_txn on public.loans (txn_id) where txn_id is not null;

create table if not exists public.loan_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  loan_id uuid not null references public.loans (id) on delete cascade,
  kind text not null check (kind in ('payment', 'postpone')),
  on_date date not null,
  amount bigint check (amount is null or (amount > 0 and amount <= 100000000000)),
  old_due date,
  new_due date,
  note text check (note is null or char_length(note) <= 200),
  txn_id uuid references public.transactions (id) on delete set null,
  txn_added boolean not null default false,
  created_at timestamptz not null default now(),
  check (kind <> 'payment' or amount is not null),
  check (kind <> 'postpone' or new_due is not null)
);
create index if not exists loan_events_loan_idx on public.loan_events (loan_id, created_at);
create unique index if not exists loan_events_one_per_txn on public.loan_events (txn_id) where txn_id is not null;

alter table public.loans enable row level security;
alter table public.loan_events enable row level security;

create policy "own loans: select" on public.loans for select to authenticated using (user_id = auth.uid());
create policy "own loans: delete" on public.loans for delete to authenticated using (user_id = auth.uid());
create policy "own loans: insert" on public.loans for insert to authenticated with check (
  user_id = auth.uid()
  and (account_id is null or exists (select 1 from public.accounts a where a.id = account_id and a.user_id = auth.uid()))
  and (txn_id is null or exists (select 1 from public.transactions t where t.id = txn_id and t.user_id = auth.uid()))
);
create policy "own loans: update" on public.loans for update to authenticated using (user_id = auth.uid()) with check (
  user_id = auth.uid()
  and (account_id is null or exists (select 1 from public.accounts a where a.id = account_id and a.user_id = auth.uid()))
  and (txn_id is null or exists (select 1 from public.transactions t where t.id = txn_id and t.user_id = auth.uid()))
);

create policy "own loan_events: select" on public.loan_events for select to authenticated using (user_id = auth.uid());
create policy "own loan_events: delete" on public.loan_events for delete to authenticated using (user_id = auth.uid());
create policy "own loan_events: insert" on public.loan_events for insert to authenticated with check (
  user_id = auth.uid()
  and exists (select 1 from public.loans l where l.id = loan_id and l.user_id = auth.uid())
  and (txn_id is null or exists (select 1 from public.transactions t where t.id = txn_id and t.user_id = auth.uid()))
);

-- A transfer to someone else's account: whose it is, and (when it is not spending or a loan) what it came out of.
alter table public.transactions
  add column if not exists other_owner text check (other_owner is null or char_length(other_owner) <= 80),
  add column if not exists from_kind text check (from_kind is null or from_kind in ('wants', 'line', 'fund', 'bonus')),
  add column if not exists from_ref text check (from_ref is null or char_length(from_ref) <= 80),
  add column if not exists from_name text check (from_name is null or char_length(from_name) <= 80);

-- A capture rule can say the money arrives in someone else's account, and whose.
alter table public.capture_rules
  add column if not exists to_other text check (to_other is null or char_length(to_other) <= 80);

-- Rollback:
--   drop table if exists public.loan_events;
--   drop table if exists public.loans;
--   alter table public.transactions drop column other_owner, drop column from_kind, drop column from_ref, drop column from_name;
--   alter table public.capture_rules drop column to_other;
