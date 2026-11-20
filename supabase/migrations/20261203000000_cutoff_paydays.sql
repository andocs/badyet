-- Cutoffs follow your paydays (the 10th and the 25th): the 1st cutoff starts on `first_cutoff_start_day` (default 11)
-- and runs to the day before `second_cutoff_start_day` (default 25); the 2nd runs from there to the day before
-- `first_cutoff_start_day` of the next month. You told us your paydays are the 10th and 25th, so any settings already
-- saved are set to 11 and 25 here; change them on the Settings page if that is wrong.

alter table public.user_settings
  add column first_cutoff_start_day integer not null default 11 check (first_cutoff_start_day between 2 and 28);

alter table public.user_settings alter column second_cutoff_start_day set default 25;

update public.user_settings set first_cutoff_start_day = 11, second_cutoff_start_day = 25;

alter table public.user_settings
  add constraint user_settings_first_before_second check (first_cutoff_start_day < second_cutoff_start_day);

-- Rollback:
-- alter table public.user_settings drop constraint user_settings_first_before_second;
-- alter table public.user_settings alter column second_cutoff_start_day set default 16;
-- alter table public.user_settings drop column first_cutoff_start_day;
