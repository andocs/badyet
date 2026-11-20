-- The savings fund migrated from savings_settings.wants_cap was called "Wants", which clashes with the Wants budget group.
-- Rename it so the two are not confused. Only touches the row the data migration created (rule 'reset', default name).
update public.funds set name = 'Wants savings' where name = 'Wants' and rule = 'reset';

-- Rollback: update public.funds set name = 'Wants' where name = 'Wants savings' and rule = 'reset';
