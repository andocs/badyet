-- Budget lines: what each cutoff's net pay is split into. Amounts in centavos.
-- Amount is signed: reimbursements and prepayments are negative (see domain/budget.ts).

create table public.budget_lines (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  cutoff text not null check (cutoff in ('first', 'second')),
  bucket text not null check (bucket in ('essentials', 'wants', 'savings')),
  name text not null check (char_length(name) between 1 and 60),
  amount bigint not null check (amount between -10000000000 and 10000000000),
  created_at timestamptz not null default now()
);

create index budget_lines_plan on public.budget_lines (plan_id, cutoff, bucket, created_at);

alter table public.budget_lines enable row level security;

create policy "own lines: select" on public.budget_lines for select to authenticated using (user_id = auth.uid());
create policy "own lines: insert" on public.budget_lines for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from public.plans p where p.id = plan_id and p.user_id = auth.uid()));
create policy "own lines: update" on public.budget_lines for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own lines: delete" on public.budget_lines for delete to authenticated using (user_id = auth.uid());

-- Rollback: drop table public.budget_lines;
