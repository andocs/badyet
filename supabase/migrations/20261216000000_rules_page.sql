-- Rules page (rev-31). Capture rules grow from "this phrase, then ignore / category / confirm" into the rule the Rules page edits:
-- a name, an on/off switch, the channel it listens on, words to look for / also require / skip, extra apps and senders, what the
-- capture is (spending, income, transfer, payment) with its accounts, and automatic confirmation. Old rows keep working: they get
-- the defaults and their old phrase becomes the single "look for" word. Also two small lists the phone fills so the web can show
-- them: the apps the phone reported and the email senders seen in Gmail. Holds app ids, labels and addresses only, never message text.
-- Rollback: drop table device_apps; drop table seen_senders; restore capture_rules_action_check and capture_rules_check; alter table capture_rules drop the new columns.

alter table capture_rules
  add column name text check (name is null or char_length(name) <= 60),
  add column enabled boolean not null default true,
  add column channel text not null default 'both' check (channel in ('notifications', 'emails', 'both')),
  add column words text[] not null default '{}' check (cardinality(words) <= 10),
  add column must_words text[] not null default '{}' check (cardinality(must_words) <= 10),
  add column skip_words text[] not null default '{}' check (cardinality(skip_words) <= 10),
  add column sources text[] not null default '{}' check (cardinality(sources) <= 10),
  add column packages text[] not null default '{}' check (cardinality(packages) <= 10),
  add column senders text[] not null default '{}' check (cardinality(senders) <= 10),
  add column kind text not null default 'spending' check (kind in ('spending', 'income', 'transfer', 'payment')),
  add column from_account_id uuid references accounts (id) on delete set null,
  add column to_account_id uuid references accounts (id) on delete set null,
  add column auto_confirm boolean not null default false,
  add column position int not null default 0;

update capture_rules set words = array[match_text] where cardinality(words) = 0;

alter table capture_rules drop constraint if exists capture_rules_action_check;
alter table capture_rules add constraint capture_rules_action_check check (action in ('ignore', 'set_category', 'auto_confirm', 'record'));

-- The old rule needed a category for set_category; a "record" rule may leave it empty (income, transfer, payment, or ask me).
-- The existing check only mentions set_category, so it stays as is.

create table device_apps (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  package text not null check (char_length(package) between 3 and 200),
  label text check (label is null or char_length(label) <= 100),
  -- 'installed' = on the phone; 'notified' = it posted a notification recently.
  seen text not null default 'installed' check (seen in ('installed', 'notified')),
  updated_at timestamptz not null default now(),
  primary key (user_id, package)
);

create table seen_senders (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  address text not null check (char_length(address) between 3 and 200),
  emails int not null default 1,
  updated_at timestamptz not null default now(),
  primary key (user_id, address)
);

alter table device_apps enable row level security;
alter table seen_senders enable row level security;
create policy device_apps_own on device_apps for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy seen_senders_own on seen_senders for all using (user_id = auth.uid()) with check (user_id = auth.uid());
