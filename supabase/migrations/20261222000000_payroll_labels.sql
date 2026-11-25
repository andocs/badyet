-- rev-40: a name for the "other deduction" on your payslip (for example "HMO plan"). The amount column already exists.
alter table public.pay_settings add column if not exists other_deduction_label text
  check (other_deduction_label is null or char_length(other_deduction_label) between 1 and 30);

-- Rollback:
-- alter table public.pay_settings drop column if exists other_deduction_label;
