-- Each CIP or bonus can carry its own de minimis exemption (for example 12,000 on a 120,000 CIP). That part is never taxed
-- and does not count toward the 90,000 yearly cap; what is left of the bonus goes into the pool checked against the cap.
-- The 13th month has no de minimis, enforced here as well as in the app.

alter table public.windfall_events
  add column de_minimis bigint not null default 0 check (de_minimis >= 0 and de_minimis <= 100000000000),
  add constraint windfall_no_de_minimis_on_13th check (kind <> 'thirteenth' or de_minimis = 0);

-- Rollback:
-- alter table public.windfall_events drop constraint windfall_no_de_minimis_on_13th, drop column de_minimis;
