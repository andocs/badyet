-- An HMO (or other) deduction taken from every cutoff after tax: it lowers what you can budget and what lands in your
-- account, but does not change the tax. Centavos per cutoff, 0 when there is none.

alter table public.pay_profiles
  add column other_deduction bigint not null default 0 check (other_deduction >= 0 and other_deduction <= 10000000000);

-- Duplicating a plan must carry the deduction over, so the function is replaced with the new column added.
create or replace function public.duplicate_plan(p_id uuid) returns uuid
language plpgsql security invoker set search_path = public as $$
declare
  src public.plans%rowtype;
  new_id uuid;
begin
  select * into src from public.plans where id = p_id and user_id = auth.uid();
  if not found then
    raise exception 'plan not found';
  end if;

  insert into public.plans (name, start_date, end_date)
  values (left(src.name || ' (copy)', 60), src.start_date, src.end_date)
  returning id into new_id;

  insert into public.pay_profiles (plan_id, annual_base, allowance_second, sss, pagibig, savings_plan_bp,
                                   philhealth_override, tax_override_first, tax_override_second, other_deduction)
  select new_id, annual_base, allowance_second, sss, pagibig, savings_plan_bp,
         philhealth_override, tax_override_first, tax_override_second, other_deduction
  from public.pay_profiles where plan_id = p_id;

  insert into public.budget_lines (plan_id, cutoff, bucket, name, amount, wallet_id, source)
  select new_id, cutoff, bucket, name, amount, wallet_id, source
  from public.budget_lines where plan_id = p_id;

  insert into public.savings_settings (plan_id, start_month, start_ef, start_travel, start_wants,
                                       ef_tranche, ef_hard_cap, travel_cap, wants_cap, priority)
  select new_id, start_month, start_ef, start_travel, start_wants,
         ef_tranche, ef_hard_cap, travel_cap, wants_cap, priority
  from public.savings_settings where plan_id = p_id;

  return new_id;
end;
$$;

-- Rollback: put the previous duplicate_plan back (20261128000000_duplicate_plan.sql), then:
-- alter table public.pay_profiles drop column other_deduction;
