-- Wallets (where money is sent), a wallet per budget line, and per-month "sent" marks.

create table public.wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 30),
  created_at timestamptz not null default now()
);
create unique index wallets_unique_name on public.wallets (user_id, lower(name));

alter table public.wallets enable row level security;
create policy "own wallets: select" on public.wallets for select to authenticated using (user_id = auth.uid());
create policy "own wallets: insert" on public.wallets for insert to authenticated with check (user_id = auth.uid());
create policy "own wallets: update" on public.wallets for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own wallets: delete" on public.wallets for delete to authenticated using (user_id = auth.uid());

-- Deleting a wallet leaves its lines in place, unassigned.
alter table public.budget_lines add column wallet_id uuid references public.wallets (id) on delete set null;

-- One row = this budget line was sent in this month (YYYY-MM). A plan can run for many months,
-- so "sent" is kept per month rather than on the line itself.
create table public.transfer_marks (
  line_id uuid not null references public.budget_lines (id) on delete cascade,
  month text not null check (month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  sent_at timestamptz not null default now(),
  primary key (line_id, month)
);

alter table public.transfer_marks enable row level security;
create policy "own marks: select" on public.transfer_marks for select to authenticated using (user_id = auth.uid());
create policy "own marks: insert" on public.transfer_marks for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from public.budget_lines l where l.id = line_id and l.user_id = auth.uid()));
create policy "own marks: delete" on public.transfer_marks for delete to authenticated using (user_id = auth.uid());

-- Rollback: drop table public.transfer_marks; alter table public.budget_lines drop column wallet_id; drop table public.wallets;
