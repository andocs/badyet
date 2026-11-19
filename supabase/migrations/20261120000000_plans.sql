-- Plans: named budget versions with a date range. One active plan per user.
-- Past plans are made read-only in the app (and the app checks it server-side).

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  start_date date not null,
  end_date date not null,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  check (end_date >= start_date)
);

create unique index plans_one_active_per_user on public.plans (user_id) where is_active;
create index plans_user_start on public.plans (user_id, start_date desc);

alter table public.plans enable row level security;

create policy "own plans: select" on public.plans for select to authenticated using (user_id = auth.uid());
create policy "own plans: insert" on public.plans for insert to authenticated with check (user_id = auth.uid());
create policy "own plans: update" on public.plans for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own plans: delete" on public.plans for delete to authenticated using (user_id = auth.uid() and not is_active);

-- Switch the active plan atomically (one statement block = one transaction).
-- security invoker: RLS still applies, so it can only touch the caller's rows.
create function public.activate_plan(p_id uuid) returns void
language plpgsql security invoker set search_path = public as $$
begin
  if not exists (select 1 from public.plans where id = p_id and user_id = auth.uid()) then
    raise exception 'plan not found';
  end if;
  update public.plans set is_active = false where user_id = auth.uid() and is_active and id <> p_id;
  update public.plans set is_active = true where id = p_id and user_id = auth.uid();
end;
$$;

revoke all on function public.activate_plan(uuid) from public, anon;
grant execute on function public.activate_plan(uuid) to authenticated;

-- Rollback: drop function public.activate_plan(uuid); drop table public.plans;
