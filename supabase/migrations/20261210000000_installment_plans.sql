-- rev-17: installments (card plans and loans). One row per plan; each plan also owns one budget line (source 'installment',
-- source_id = this row's id) that runs from the first due month to the last, so it sits in the budget like any other line.
-- Paid so far is worked out from the due dates, not stored. The old installments tables are left alone.
-- Rollback: delete from budget_lines_v2 where source = 'installment'; drop table installment_plans;

create table installment_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  kind text not null default 'card' check (kind in ('card', 'loan')),
  price bigint not null check (price > 0 and price <= 100000000000),
  down_payment bigint not null default 0 check (down_payment >= 0 and down_payment < price),
  term_count integer not null check (term_count between 1 and 600),
  -- Annual rate in basis points; 0 = no interest.
  rate_bp integer not null default 0 check (rate_bp between 0 and 10000),
  first_due_on date not null,
  cutoff text not null check (cutoff in ('first', 'second')),
  account_id uuid references accounts (id) on delete set null,
  created_at timestamptz not null default now()
);

create index installment_plans_user_idx on installment_plans (user_id, first_due_on);

alter table installment_plans enable row level security;

create policy "own installment_plans: select" on installment_plans for select using (user_id = auth.uid());
create policy "own installment_plans: insert" on installment_plans for insert with check (
  user_id = auth.uid() and (account_id is null or exists (select 1 from accounts a where a.id = account_id and a.user_id = auth.uid()))
);
create policy "own installment_plans: update" on installment_plans for update using (user_id = auth.uid()) with check (
  user_id = auth.uid() and (account_id is null or exists (select 1 from accounts a where a.id = account_id and a.user_id = auth.uid()))
);
create policy "own installment_plans: delete" on installment_plans for delete using (user_id = auth.uid());
