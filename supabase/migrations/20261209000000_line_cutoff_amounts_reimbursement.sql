-- rev-16: a fixed line can take a different amount in each cutoff (T4), and a line can be reimbursed (T5).
-- amount_second: only used when cutoff = 'both' on a fixed line. Null means the same amount in both cutoffs (the old behaviour).
-- reimburse_*: money that comes back to this line each month: how much, the cutoff it is deposited in, and the day (shown only).
-- Rollback: alter table budget_lines_v2 drop column amount_second, drop column reimburse_amount, drop column reimburse_cutoff, drop column reimburse_day;

alter table budget_lines_v2
  add column if not exists amount_second bigint check (amount_second is null or amount_second between -10000000000 and 10000000000),
  add column if not exists reimburse_amount bigint check (reimburse_amount is null or reimburse_amount between 0 and 10000000000),
  add column if not exists reimburse_cutoff text check (reimburse_cutoff is null or reimburse_cutoff in ('first', 'second')),
  add column if not exists reimburse_day integer check (reimburse_day is null or reimburse_day between 1 and 31);

alter table budget_lines_v2 drop constraint if exists v2_reimburse_fields;
alter table budget_lines_v2 add constraint v2_reimburse_fields check ((reimburse_amount is null) = (reimburse_cutoff is null));
