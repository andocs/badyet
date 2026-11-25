-- rev-39: (1) office-day money can be settled to savings; (2) up to six "Other app" sources, each with a name you choose.

-- (1) New pool entry kind. Inline checks get the auto-name <table>_<column>_check.
alter table public.pool_entries drop constraint if exists pool_entries_kind_check;
alter table public.pool_entries add constraint pool_entries_kind_check
  check (kind in ('fund', 'use', 'to_wants', 'settle_to_pool', 'settle_to_wants', 'settle_to_savings', 'over_from_wants', 'over_from_excess'));

-- (2) Extra custom source slots (custom2 .. custom6) and a name for each source.
alter table public.capture_sources add column if not exists label text check (label is null or char_length(label) between 1 and 30);

alter table public.capture_sources drop constraint if exists capture_sources_source_check;
alter table public.capture_sources add constraint capture_sources_source_check
  check (source in ('gcash', 'maya', 'bpi', 'gotyme', 'maribank', 'grab', 'foodpanda', 'gwallet', 'custom', 'custom2', 'custom3', 'custom4', 'custom5', 'custom6'));
alter table public.capture_rules drop constraint if exists capture_rules_source_check;
alter table public.capture_rules add constraint capture_rules_source_check
  check (source in ('gcash', 'maya', 'bpi', 'gotyme', 'maribank', 'grab', 'foodpanda', 'gwallet', 'custom', 'custom2', 'custom3', 'custom4', 'custom5', 'custom6'));
alter table public.capture_patterns drop constraint if exists capture_patterns_source_check;
alter table public.capture_patterns add constraint capture_patterns_source_check
  check (source in ('gcash', 'maya', 'bpi', 'gotyme', 'maribank', 'grab', 'foodpanda', 'gwallet', 'custom', 'custom2', 'custom3', 'custom4', 'custom5', 'custom6'));
alter table public.held_captures drop constraint if exists held_captures_source_check;
alter table public.held_captures add constraint held_captures_source_check
  check (source in ('gcash', 'maya', 'bpi', 'gotyme', 'maribank', 'grab', 'foodpanda', 'gwallet', 'custom', 'custom2', 'custom3', 'custom4', 'custom5', 'custom6'));

-- Rollback (first delete rows that use the new values, or the old checks will refuse to come back):
-- delete from public.pool_entries where kind = 'settle_to_savings';
-- delete from public.capture_patterns where source in ('custom2','custom3','custom4','custom5','custom6');
-- delete from public.capture_rules where source in ('custom2','custom3','custom4','custom5','custom6');
-- delete from public.held_captures where source in ('custom2','custom3','custom4','custom5','custom6');
-- delete from public.capture_sources where source in ('custom2','custom3','custom4','custom5','custom6');
-- alter table public.capture_sources drop column if exists label;
-- then re-add the old checks: pool_entries_kind_check (without settle_to_savings) and the four source checks (without custom2..custom6).
