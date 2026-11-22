-- Your own notification patterns (rev-15): wording you write with {amount}, {name}, {last4}, {ref} and {any} placeholders; the app turns
-- it into a regular expression on the device. Also an "Other app" source ('custom') for apps with no built-in reader.
-- Holds only the wording you typed, never a notification.
-- Rollback: drop table capture_patterns; delete the 'custom' rows from capture_sources and capture_rules; restore the old checks.

alter table capture_sources drop constraint if exists capture_sources_source_check;
alter table capture_sources add constraint capture_sources_source_check
  check (source in ('gcash', 'maya', 'bpi', 'gotyme', 'maribank', 'grab', 'foodpanda', 'gwallet', 'custom'));
alter table capture_rules drop constraint if exists capture_rules_source_check;
alter table capture_rules add constraint capture_rules_source_check
  check (source in ('gcash', 'maya', 'bpi', 'gotyme', 'maribank', 'grab', 'foodpanda', 'gwallet', 'custom'));

create table capture_patterns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  source text not null check (source in ('gcash', 'maya', 'bpi', 'gotyme', 'maribank', 'grab', 'foodpanda', 'gwallet', 'custom')),
  template text not null check (char_length(template) between 3 and 200),
  direction text not null check (direction in ('in', 'out')),
  created_at timestamptz not null default now()
);

create index capture_patterns_user_idx on capture_patterns (user_id, created_at);

alter table capture_patterns enable row level security;

create policy "own capture_patterns: select" on capture_patterns for select using (user_id = auth.uid());
create policy "own capture_patterns: insert" on capture_patterns for insert with check (user_id = auth.uid());
create policy "own capture_patterns: delete" on capture_patterns for delete using (user_id = auth.uid());
