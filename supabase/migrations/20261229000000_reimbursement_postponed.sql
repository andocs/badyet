-- rev-58: a postponed reimbursement is left out of its month and added to the next month's reimbursement day.
-- Needs 20261228000000_reimbursement_marks.sql first.
alter table public.reimbursement_marks add column if not exists postponed boolean not null default false;

-- Rollback:
-- alter table public.reimbursement_marks drop column if exists postponed;
