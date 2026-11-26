-- rev-54: "This month only" on the payslip builder. One row changes one line's amount in one month; the saved layout is untouched.
-- amount null = use the calculated amount that month, even if your layout has a typed one.
create table if not exists public.payslip_month_edits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  month date not null check (extract(day from month) = 1),
  cutoff text not null check (cutoff in ('first', 'second')),
  source text not null check (source in ('income_tax', 'sss', 'philhealth', 'pagibig', 'penboost', 'custom')),
  label text not null check (char_length(label) between 1 and 60),
  amount bigint check (amount >= 0 and amount <= 10000000000),
  unique (user_id, month, cutoff, source, label)
);

alter table public.payslip_month_edits enable row level security;
create policy "own payslip_month_edits: select" on public.payslip_month_edits for select to authenticated using (user_id = auth.uid());
create policy "own payslip_month_edits: insert" on public.payslip_month_edits for insert to authenticated with check (user_id = auth.uid());
create policy "own payslip_month_edits: update" on public.payslip_month_edits for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own payslip_month_edits: delete" on public.payslip_month_edits for delete to authenticated using (user_id = auth.uid());

-- Rollback:
-- drop table if exists public.payslip_month_edits;
