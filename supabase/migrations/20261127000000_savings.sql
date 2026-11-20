-- Savings forecast settings, one row per plan, plus optional per-month "this fund leads" overrides.
-- Amounts in centavos. The projection itself is calculated by the app (nothing is stored for it).

create table public.savings_settings (
  plan_id uuid primary key references public.plans (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  start_month text not null check (start_month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  start_ef bigint not null default 0 check (start_ef >= 0),
  start_travel bigint not null default 0 check (start_travel >= 0),
  start_wants bigint not null default 0 check (start_wants >= 0),
  ef_tranche bigint not null check (ef_tranche > 0),
  ef_hard_cap bigint not null default 0 check (ef_hard_cap >= 0), -- 0 = no hard cap
  travel_cap bigint not null default 0 check (travel_cap >= 0),
  wants_cap bigint not null default 0 check (wants_cap >= 0), -- 0 = Wants fund disabled
  priority text not null default 'EF,TRAVEL,WANTS'
    check (priority in ('EF,TRAVEL,WANTS', 'EF,WANTS,TRAVEL', 'TRAVEL,EF,WANTS', 'TRAVEL,WANTS,EF', 'WANTS,EF,TRAVEL', 'WANTS,TRAVEL,EF')),
  updated_at timestamptz not null default now()
);

create table public.savings_overrides (
  plan_id uuid not null references public.plans (id) on delete cascade,
  month text not null check (month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  goal text not null check (goal in ('EF', 'TRAVEL', 'WANTS')),
  primary key (plan_id, month)
);

alter table public.savings_settings enable row level security;
alter table public.savings_overrides enable row level security;

create policy "own savings settings: select" on public.savings_settings for select to authenticated using (user_id = auth.uid());
create policy "own savings settings: insert" on public.savings_settings for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from public.plans p where p.id = plan_id and p.user_id = auth.uid()));
create policy "own savings settings: update" on public.savings_settings for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own savings settings: delete" on public.savings_settings for delete to authenticated using (user_id = auth.uid());

create policy "own overrides: select" on public.savings_overrides for select to authenticated using (user_id = auth.uid());
create policy "own overrides: insert" on public.savings_overrides for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from public.plans p where p.id = plan_id and p.user_id = auth.uid()));
create policy "own overrides: update" on public.savings_overrides for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own overrides: delete" on public.savings_overrides for delete to authenticated using (user_id = auth.uid());

-- Rollback: drop table public.savings_overrides; drop table public.savings_settings;
