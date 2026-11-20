-- Per-user app settings. For now: the day of the month the 2nd cutoff starts.
-- The 1st cutoff runs from day 1 up to the day before it. Default 16 (so 1st = 1 to 15).

create table public.user_settings (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  second_cutoff_start_day integer not null default 16 check (second_cutoff_start_day between 2 and 28),
  updated_at timestamptz not null default now()
);

alter table public.user_settings enable row level security;
create policy "own settings: all" on public.user_settings for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Rollback: drop table public.user_settings;
