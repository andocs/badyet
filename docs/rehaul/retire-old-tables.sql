-- OPTIONAL clean-up for after you are happy with the rehaul. Not a migration: nothing runs it for you.
-- The new app no longer reads any of these old tables. Everything was copied into the new tables by
-- 20261206000100_rehaul_data_migration.sql, and plans that were not active were saved as JSON in legacy_plan_snapshots.
--
-- BEFORE running: check Accounts, Budget, Salary and tax, Bonuses and Funds show your real data, and export anything you want to keep
-- (Settings > Your data). Dropping tables cannot be undone except from a Supabase backup.

drop table if exists public.transfer_marks;
drop table if exists public.installment_payments;
drop table if exists public.installments;
drop table if exists public.subscriptions;
drop table if exists public.windfall_allocations;
drop table if exists public.windfall_events;
drop table if exists public.savings_overrides;
drop table if exists public.savings_settings;
drop table if exists public.budget_lines;
drop table if exists public.pay_profiles;
drop table if exists public.wallets;
drop table if exists public.plans cascade;
drop function if exists public.duplicate_plan(uuid);
drop function if exists public.apply_transfer_marks();
