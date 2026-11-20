-- Duplicate a plan together with its pay profile, budget lines (with wallets) and savings settings,
-- in one transaction. Month-specific things (transfer ticks, per-month savings overrides) and dated
-- bonuses are not copied: they belong to the period of the original plan.
-- security invoker: row-level security still applies, so only the caller's rows can be read or written.

create function public.duplicate_plan(p_id uuid) returns uuid
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
                                   philhealth_override, tax_override_first, tax_override_second)
  select new_id, annual_base, allowance_second, sss, pagibig, savings_plan_bp,
         philhealth_override, tax_override_first, tax_override_second
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

revoke all on function public.duplicate_plan(uuid) from public, anon;
grant execute on function public.duplicate_plan(uuid) to authenticated;

-- Rollback: drop function public.duplicate_plan(uuid);
