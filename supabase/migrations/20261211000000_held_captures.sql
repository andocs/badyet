-- rev-19: captures the phone understood but could not place in an account (the Inbox asks which account), so the web can show and answer
-- them too. Holds only what the parser read (amount, who, the digits it showed, the reference), never the notification text.
-- The phone adds a row when it holds a capture and removes it when the capture is placed; the web removes it when you answer there.
-- Rollback: drop table held_captures;

create table held_captures (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- Same as the capture's dedupe hash: the row it becomes carries it too, so a capture can only be added once.
  hash text not null check (char_length(hash) between 8 and 128),
  source text not null check (source in ('gcash', 'maya', 'bpi', 'gotyme', 'maribank', 'grab', 'foodpanda', 'gwallet', 'custom')),
  direction text not null check (direction in ('in', 'out')),
  amount bigint not null check (amount > 0 and amount <= 100000000000),
  counterparty text check (counterparty is null or char_length(counterparty) <= 80),
  counterparty_last4 text check (counterparty_last4 is null or char_length(counterparty_last4) <= 8),
  account_hint text check (account_hint is null or char_length(account_hint) <= 8),
  account_name text check (account_name is null or char_length(account_name) <= 80),
  ref text check (ref is null or char_length(ref) <= 60),
  post_time timestamptz not null,
  origin text not null default 'notification' check (origin in ('notification', 'import')),
  created_at timestamptz not null default now(),
  unique (user_id, hash)
);

create index held_captures_user_idx on held_captures (user_id, post_time desc);

alter table held_captures enable row level security;

create policy "own held_captures: select" on held_captures for select using (user_id = auth.uid());
create policy "own held_captures: insert" on held_captures for insert with check (user_id = auth.uid());
create policy "own held_captures: delete" on held_captures for delete using (user_id = auth.uid());
