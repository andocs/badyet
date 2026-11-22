-- SSS PenBoost: a voluntary pre-tax contribution, kept as a payslip line (amount typed on the line, like any other).
alter table public.payslip_lines drop constraint if exists payslip_lines_source_check;
alter table public.payslip_lines add constraint payslip_lines_source_check
  check (source in ('base_share', 'income_tax', 'sss', 'philhealth', 'pagibig', 'penboost', 'allowance', 'custom'));
