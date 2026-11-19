-- Plans may have no end date (an ongoing "current" plan).
-- The old check (end_date >= start_date) already passes for NULL, so it can stay.
alter table public.plans alter column end_date drop not null;

-- Rollback (only if no plan has a null end date):
--   alter table public.plans alter column end_date set not null;
