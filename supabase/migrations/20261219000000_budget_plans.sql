-- rev-37: budget plans over date ranges. A plan is a full set of budget lines (copied from the normal budget, then edited) that
-- replaces the normal budget for the cutoffs it covers. Plans start and end on whole cutoffs and never overlap (checked by the app).
create table if not exists public.budget_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  -- First day of the month the plan starts / ends in, plus which cutoff of that month.
  start_month date not null,
  start_cutoff text not null check (start_cutoff in ('first', 'second')),
  end_month date not null,
  end_cutoff text not null check (end_cutoff in ('first', 'second')),
  created_at timestamptz not null default now(),
  constraint budget_plans_order check (start_month < end_month or (start_month = end_month and (start_cutoff = 'first' or end_cutoff = 'second')))
);

alter table public.budget_plans enable row level security;
create policy "own budget_plans: select" on public.budget_plans for select using (user_id = auth.uid());
create policy "own budget_plans: insert" on public.budget_plans for insert with check (user_id = auth.uid());
create policy "own budget_plans: update" on public.budget_plans for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own budget_plans: delete" on public.budget_plans for delete using (user_id = auth.uid());

-- A line with no plan is the normal budget. Deleting a plan deletes its lines.
alter table public.budget_lines_v2 add column if not exists plan_id uuid references public.budget_plans (id) on delete cascade;
create index if not exists budget_lines_v2_plan_idx on public.budget_lines_v2 (plan_id);

-- One RTO contingency line per budget (the normal one, and each plan), instead of one per user.
drop index if exists public.budget_lines_v2_one_contingency;
create unique index budget_lines_v2_one_contingency
  on public.budget_lines_v2 (user_id, coalesce(plan_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where kind = 'rto_contingency';

-- Rollback (deletes every plan and its lines):
-- drop index if exists public.budget_lines_v2_one_contingency;
-- delete from public.budget_lines_v2 where plan_id is not null;
-- alter table public.budget_lines_v2 drop column if exists plan_id;
-- create unique index budget_lines_v2_one_contingency on public.budget_lines_v2 (user_id) where kind = 'rto_contingency';
-- drop table if exists public.budget_plans;
