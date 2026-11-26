-- rev-47: where bonus money a full fund cannot take goes in an overridden month.
-- null = the next funds in priority (the default), 'none' = leave it unplaced, or a fund id to try first.
alter table public.month_overrides add column if not exists overflow_to text
  check (overflow_to is null or overflow_to = 'none' or overflow_to ~ '^[0-9a-fA-F-]{36}$');

-- Rollback:
-- alter table public.month_overrides drop column if exists overflow_to;
