-- rev-45: several "other payroll deductions", each on the 1st cutoff, the 2nd, or both (with its own amount in each).
-- Each item: {"label": text, "cutoff": "first"|"second"|"both", "amount": centavos, "amountSecond": centavos or null}.
alter table public.pay_settings add column if not exists other_deduction_label text
  check (other_deduction_label is null or char_length(other_deduction_label) between 1 and 30);
alter table public.pay_settings add column if not exists other_deductions jsonb not null default '[]'::jsonb
  check (jsonb_typeof(other_deductions) = 'array');

-- Carry the single deduction you already have over, then clear it so it is not counted twice.
update public.pay_settings
set other_deductions = jsonb_build_array(jsonb_build_object(
      'label', coalesce(other_deduction_label, 'Other deduction'), 'cutoff', 'both', 'amount', other_deduction, 'amountSecond', null)),
    other_deduction = 0
where other_deduction > 0 and other_deductions = '[]'::jsonb;

-- Rollback:
-- alter table public.pay_settings drop column if exists other_deductions;
