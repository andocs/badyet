-- Windfalls: 13th month, CIP and other bonuses, each with an allocation checklist. Amounts in centavos.
-- The net amount is worked out by the app from the plan's pay profile (not stored), so it stays in step with Pay.

create table public.windfall_events (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('thirteenth', 'cip', 'bonus')),
  name text not null check (char_length(name) between 1 and 60),
  cutoff text not null check (cutoff in ('first', 'second')),
  pay_date date not null,
  -- Gross amount. Null for a 13th month means "one month of basic pay"; unused for CIP.
  gross bigint check (gross > 0),
  -- CIP inputs: gross = eligible earnings x component x multiplier.
  cip_eligible bigint check (cip_eligible > 0),
  cip_component_num bigint check (cip_component_num > 0), -- over 10,000,000 (13.81505% = 1381505)
  cip_multiplier_num integer check (cip_multiplier_num > 0), -- over 100 (1.25 = 125)
  created_at timestamptz not null default now(),
  check (kind <> 'cip' or (cip_eligible is not null and cip_component_num is not null and cip_multiplier_num is not null)),
  check (kind <> 'bonus' or gross is not null)
);

create table public.windfall_allocations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.windfall_events (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  amount bigint not null check (amount > 0),
  done boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.windfall_events enable row level security;
alter table public.windfall_allocations enable row level security;

create policy "own events: select" on public.windfall_events for select to authenticated using (user_id = auth.uid());
create policy "own events: insert" on public.windfall_events for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from public.plans p where p.id = plan_id and p.user_id = auth.uid()));
create policy "own events: update" on public.windfall_events for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own events: delete" on public.windfall_events for delete to authenticated using (user_id = auth.uid());

create policy "own allocations: select" on public.windfall_allocations for select to authenticated using (user_id = auth.uid());
create policy "own allocations: insert" on public.windfall_allocations for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from public.windfall_events e where e.id = event_id and e.user_id = auth.uid()));
create policy "own allocations: update" on public.windfall_allocations for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own allocations: delete" on public.windfall_allocations for delete to authenticated using (user_id = auth.uid());

-- Rollback: drop table public.windfall_allocations; drop table public.windfall_events;
