-- Duplicate rule (rev-29): when a phone alert and an email count as the same money movement. One row per user; no row means the
-- defaults (30 minutes, amount + direction, any source). The Rules page (rev-31) edits it. Holds no notification or email text.
-- Rollback: drop table dedupe_rules;

create table dedupe_rules (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  window_minutes int not null default 30 check (window_minutes between 1 and 240),
  match_source boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table dedupe_rules enable row level security;
create policy dedupe_rules_own on dedupe_rules for all using (user_id = auth.uid()) with check (user_id = auth.uid());
