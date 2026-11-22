-- Temporary: a diagnostic log from the phone app, to find out why it sticks after idling (read on the web under Settings > Diagnostics).
-- Events and timings only: no amounts, no notification text, no request bodies or headers. Delete the table once the cause is fixed.
-- Rollback: drop table app_diagnostics;

create table app_diagnostics (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  at timestamptz not null,
  -- One value per start of the app's JavaScript (a restart, or a headless start from a notification, gets a new one).
  session text not null check (char_length(session) <= 16),
  event text not null check (char_length(event) <= 40),
  detail jsonb,
  created_at timestamptz not null default now()
);

create index app_diagnostics_user_at on app_diagnostics (user_id, at desc);

alter table app_diagnostics enable row level security;

create policy "own app_diagnostics: select" on app_diagnostics for select using (user_id = auth.uid());
create policy "own app_diagnostics: insert" on app_diagnostics for insert with check (user_id = auth.uid());
create policy "own app_diagnostics: delete" on app_diagnostics for delete using (user_id = auth.uid());
