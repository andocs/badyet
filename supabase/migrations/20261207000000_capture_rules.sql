-- Capture settings (E5): how notifications and emails from each bank, wallet or shop become pending transactions.
-- Edited on the phone and on the web. A source with no row uses the app defaults (on, no default account, pending).
-- Nothing here holds notification text: only your choices.

create table capture_sources (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  source text not null check (source in ('gcash', 'maya', 'bpi', 'gotyme', 'maribank', 'grab', 'foodpanda', 'gwallet')),
  enabled boolean not null default true,
  -- Android app ids whose notifications count for this source, and email senders for the Gmail side.
  packages text[] not null default '{}' check (cardinality(packages) <= 10),
  senders text[] not null default '{}' check (cardinality(senders) <= 10),
  account_id uuid references accounts (id) on delete set null,
  category_id uuid references categories (id) on delete set null,
  -- Skip the Inbox: only applies when an account is known and, for spending, a category is known.
  auto_confirm boolean not null default false,
  -- Centavos. Amounts below this are ignored (for example, tiny cashback credits).
  min_amount bigint not null default 0 check (min_amount between 0 and 100000000000),
  updated_at timestamptz not null default now(),
  primary key (user_id, source)
);

create table capture_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- null = every source.
  source text check (source in ('gcash', 'maya', 'bpi', 'gotyme', 'maribank', 'grab', 'foodpanda', 'gwallet')),
  -- Case-insensitive "contains", checked against the notification title and text, or the email subject and body.
  match_text text not null check (char_length(match_text) between 1 and 80),
  action text not null check (action in ('ignore', 'set_category', 'auto_confirm')),
  category_id uuid references categories (id) on delete cascade,
  created_at timestamptz not null default now(),
  check (action <> 'set_category' or category_id is not null)
);

create index capture_rules_user_idx on capture_rules (user_id, created_at);

alter table capture_sources enable row level security;
alter table capture_rules enable row level security;

create policy "own capture_sources: select" on capture_sources for select using (user_id = auth.uid());
create policy "own capture_sources: delete" on capture_sources for delete using (user_id = auth.uid());
create policy "own capture_sources: insert" on capture_sources for insert with check (
  user_id = auth.uid()
  and (account_id is null or exists (select 1 from accounts a where a.id = account_id and a.user_id = auth.uid()))
  and (category_id is null or exists (select 1 from categories c where c.id = category_id and c.user_id = auth.uid()))
);
create policy "own capture_sources: update" on capture_sources for update using (user_id = auth.uid()) with check (
  user_id = auth.uid()
  and (account_id is null or exists (select 1 from accounts a where a.id = account_id and a.user_id = auth.uid()))
  and (category_id is null or exists (select 1 from categories c where c.id = category_id and c.user_id = auth.uid()))
);

create policy "own capture_rules: select" on capture_rules for select using (user_id = auth.uid());
create policy "own capture_rules: delete" on capture_rules for delete using (user_id = auth.uid());
create policy "own capture_rules: insert" on capture_rules for insert with check (
  user_id = auth.uid()
  and (category_id is null or exists (select 1 from categories c where c.id = category_id and c.user_id = auth.uid()))
);
create policy "own capture_rules: update" on capture_rules for update using (user_id = auth.uid()) with check (
  user_id = auth.uid()
  and (category_id is null or exists (select 1 from categories c where c.id = category_id and c.user_id = auth.uid()))
);

-- Rollback:
--   drop table capture_rules;
--   drop table capture_sources;
