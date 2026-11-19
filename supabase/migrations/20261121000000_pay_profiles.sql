-- One pay profile per plan: the inputs to the salary calculation (amounts in centavos).
-- Overrides are nullable: null means "use the calculated value".

create table public.pay_profiles (
  plan_id uuid primary key references public.plans (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  annual_base bigint not null check (annual_base > 0),
  allowance_second bigint not null default 0 check (allowance_second >= 0),
  sss bigint not null default 0 check (sss >= 0),
  pagibig bigint not null default 0 check (pagibig >= 0),
  savings_plan_bp integer not null default 0 check (savings_plan_bp between 0 and 10000),
  philhealth_override bigint check (philhealth_override >= 0),
  tax_override_first bigint check (tax_override_first >= 0),
  tax_override_second bigint check (tax_override_second >= 0),
  updated_at timestamptz not null default now()
);

alter table public.pay_profiles enable row level security;

-- A profile may only be written for a plan the user owns.
create policy "own pay: select" on public.pay_profiles for select to authenticated using (user_id = auth.uid());
create policy "own pay: insert" on public.pay_profiles for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from public.plans p where p.id = plan_id and p.user_id = auth.uid()));
create policy "own pay: update" on public.pay_profiles for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own pay: delete" on public.pay_profiles for delete to authenticated using (user_id = auth.uid());

-- Rollback: drop table public.pay_profiles;
