-- rev-57: a reimbursement counts in the budget only once it has arrived. The app spots a matching deposit by itself; these rows are
-- your own "Mark received" (true) or "Not yet" (false) for one line in one cutoff, which win over what it spotted.
create table if not exists public.reimbursement_marks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  budget_line_id uuid not null references public.budget_lines_v2 (id) on delete cascade,
  month date not null check (extract(day from month) = 1),
  cutoff text not null check (cutoff in ('first', 'second')),
  received boolean not null,
  unique (user_id, budget_line_id, month, cutoff)
);

alter table public.reimbursement_marks enable row level security;
create policy "own reimbursement_marks: select" on public.reimbursement_marks for select to authenticated using (user_id = auth.uid());
create policy "own reimbursement_marks: insert" on public.reimbursement_marks for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from public.budget_lines_v2 l where l.id = budget_line_id and l.user_id = auth.uid()));
create policy "own reimbursement_marks: update" on public.reimbursement_marks for update to authenticated using (user_id = auth.uid())
  with check (user_id = auth.uid() and exists (select 1 from public.budget_lines_v2 l where l.id = budget_line_id and l.user_id = auth.uid()));
create policy "own reimbursement_marks: delete" on public.reimbursement_marks for delete to authenticated using (user_id = auth.uid());

-- Rollback:
-- drop table if exists public.reimbursement_marks;
