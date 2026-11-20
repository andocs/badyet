-- Slice 5: a pool is funded by its budget line once per cutoff. Its balance is computed from the cutoffs since it was created plus its
-- entries, so the pool needs to know when it started. Existing pools (none yet) start today.
alter table public.pools add column created_on date not null default current_date;
alter table public.pool_entries add constraint pool_entries_amount_positive check (amount > 0);

-- Rollback:
-- alter table public.pool_entries drop constraint pool_entries_amount_positive;
-- alter table public.pools drop column created_on;
