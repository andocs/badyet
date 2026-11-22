-- rev-26: the payroll savings plan (money your employer takes from your pay into savings) can be a fixed amount per cutoff, and can
-- name the fund it feeds, so the forecast counts it as saved. savings_plan_bp (percent of basic) already exists.
-- Rollback: alter table pay_settings drop column savings_plan_amount, drop column savings_plan_fund_id;

alter table pay_settings
  add column if not exists savings_plan_amount bigint check (savings_plan_amount is null or savings_plan_amount between 0 and 10000000000),
  add column if not exists savings_plan_fund_id uuid references funds (id) on delete set null;
