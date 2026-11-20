-- v13 rehaul, slice 1b: copy today's data into the new tables. Runs once; old tables are left untouched (slice 7 retires them).
-- Only the ACTIVE plan of each user is migrated. Other plans are saved as JSON in legacy_plan_snapshots, not migrated.
-- Safe to re-run: a user who already has category groups is skipped, and accounts are only copied when missing.
-- Ids are reused where there is a one-to-one mapping (wallet id = account id, old budget line id = new budget line id,
-- windfall event id = bonus instance id), so links stay easy to trace.
-- Decisions to review (also in PROJECT_STATE.md):
--  * the payroll savings plan stays in pay_settings.savings_plan_bp; no percent line is created (it is a percent of basic,
--    not of take-home, so a percent line would give different numbers);
--  * Wants is migrated as a 'reset' fund (resets every January) because lib/domain/allocator.ts zeroes it every January today;
--  * installments and subscriptions keep their tables; their one-per-cutoff budget lines carry source installment|subscription.

create table public.legacy_plan_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  plan_id uuid not null,
  snapshot jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.legacy_plan_snapshots enable row level security;
create policy "own snapshots: select" on public.legacy_plan_snapshots for select to authenticated using (user_id = auth.uid());
create policy "own snapshots: delete" on public.legacy_plan_snapshots for delete to authenticated using (user_id = auth.uid());

insert into public.legacy_plan_snapshots (user_id, plan_id, snapshot)
select p.user_id, p.id, jsonb_build_object(
  'plan', to_jsonb(p),
  'pay_profile', (select to_jsonb(pp) from public.pay_profiles pp where pp.plan_id = p.id),
  'budget_lines', coalesce((select jsonb_agg(to_jsonb(b)) from public.budget_lines b where b.plan_id = p.id), '[]'::jsonb),
  'savings_settings', (select to_jsonb(s) from public.savings_settings s where s.plan_id = p.id),
  'savings_overrides', coalesce((select jsonb_agg(to_jsonb(o)) from public.savings_overrides o where o.plan_id = p.id), '[]'::jsonb),
  'windfall_events', coalesce((select jsonb_agg(to_jsonb(e)) from public.windfall_events e where e.plan_id = p.id), '[]'::jsonb))
from public.plans p
where not p.is_active
  and not exists (select 1 from public.legacy_plan_snapshots s where s.plan_id = p.id);

-- ---------- accounts (all wallets, every user) ----------
insert into public.accounts (id, user_id, name, kind, institution, last4, credit_limit, statement_day, due_day, created_at)
select w.id, w.user_id, w.name, w.kind, w.institution, w.last4, w.credit_limit, w.statement_day, w.due_day, w.created_at
from public.wallets w
where not exists (select 1 from public.accounts a where a.id = w.id);

insert into public.balance_anchors (user_id, account_id, as_of, amount, source)
select w.user_id, w.id,
  coalesce((w.balance_as_of::timestamp at time zone 'Asia/Manila'), w.created_at), w.balance, 'migration'
from public.wallets w
where not exists (select 1 from public.balance_anchors b where b.account_id = w.id);

-- ---------- who gets migrated ----------
drop table if exists mig_users;
create temp table mig_users as
select p.user_id, p.id as plan_id, p.start_date
from public.plans p
where p.is_active
  and not exists (select 1 from public.category_groups g where g.user_id = p.user_id);

-- ---------- settings ----------
update public.user_settings s
set first_payday_day = greatest(1, s.first_cutoff_start_day - 1), second_payday_day = s.second_cutoff_start_day
where s.user_id in (select user_id from mig_users);

insert into public.plan_assumptions (user_id) select user_id from mig_users on conflict do nothing;

-- ---------- groups, categories, budget lines ----------
insert into public.category_groups (user_id, name, sort, feeds_savings)
select u.user_id, g.name, g.sort, g.feeds
from mig_users u
cross join (values ('Essentials', 1, false), ('Wants', 2, false), ('Savings', 3, true)) as g (name, sort, feeds);

drop table if exists mig_cat;
create temp table mig_cat as
select bl.id as line_id, gen_random_uuid() as category_id, bl.user_id, bl.name, bl.bucket
from public.budget_lines bl
join mig_users u on u.plan_id = bl.plan_id;

insert into public.categories (id, user_id, group_id, name)
select m.category_id, m.user_id, g.id, m.name
from mig_cat m
join public.category_groups g on g.user_id = m.user_id and lower(g.name) = m.bucket;

insert into public.budget_lines_v2
  (id, user_id, category_id, name, rule, amount, cutoff, account_id, source, counts_to_daily, created_at)
select bl.id, bl.user_id, m.category_id, bl.name, 'fixed', bl.amount, bl.cutoff, bl.wallet_id,
  case bl.source when 'installments' then 'installment' when 'subscriptions' then 'subscription' else 'manual' end,
  bl.bucket = 'wants', bl.created_at
from public.budget_lines bl
join mig_cat m on m.line_id = bl.id;

-- ---------- salary ----------
insert into public.salary_events (user_id, effective_month, kind, new_base, status)
select u.user_id, date_trunc('month', u.start_date)::date, 'start', round(pp.annual_base / 12.0)::bigint, 'confirmed'
from mig_users u
join public.pay_profiles pp on pp.plan_id = u.plan_id;

insert into public.allowances (user_id, payslip_cutoff, name, amount, frequency, taxable, starts_on)
select u.user_id, 'second', 'Allowance', pp.allowance_second, 'monthly', false, u.start_date
from mig_users u
join public.pay_profiles pp on pp.plan_id = u.plan_id
where pp.allowance_second > 0;

insert into public.pay_settings
  (user_id, sss_override, philhealth_override, pagibig_override, tax_override_first, tax_override_second, other_deduction, savings_plan_bp)
select u.user_id, pp.sss, pp.philhealth_override, pp.pagibig, pp.tax_override_first, pp.tax_override_second,
  coalesce(pp.other_deduction, 0), pp.savings_plan_bp
from mig_users u
join public.pay_profiles pp on pp.plan_id = u.plan_id
on conflict do nothing;

-- ---------- funds and month overrides ----------
drop table if exists mig_funds;
create temp table mig_funds as
select u.user_id, f.key, gen_random_uuid() as id, s.start_ef, s.start_travel, s.start_wants, s.ef_tranche,
  s.ef_hard_cap, s.travel_cap, s.wants_cap, s.priority
from mig_users u
join public.savings_settings s on s.plan_id = u.plan_id
cross join (values ('EF'), ('TRAVEL'), ('WANTS')) as f (key);

-- EF: one repeating tranche (tranches = [size], the last tranche repeats up to target); Travel and Wants reset every January.
insert into public.funds (id, user_id, name, priority, rule, target, tranches, reset_month, start_balance, archived_at)
select m.id, m.user_id,
  case m.key when 'EF' then 'Emergency fund' when 'TRAVEL' then 'Travel' else 'Wants' end,
  array_position(string_to_array(m.priority, ','), m.key),
  case m.key when 'EF' then 'steps' else 'reset' end,
  case m.key when 'EF' then nullif(m.ef_hard_cap, 0) when 'TRAVEL' then m.travel_cap else m.wants_cap end,
  case m.key when 'EF' then array[m.ef_tranche] else null end,
  case m.key when 'EF' then null else 1 end,
  case m.key when 'EF' then m.start_ef when 'TRAVEL' then m.start_travel else m.start_wants end,
  case when m.key = 'WANTS' and m.wants_cap = 0 then now() else null end
from mig_funds m;

insert into public.month_overrides (user_id, month, fund_order)
select f.user_id, (o.month || '-01')::date, array[f.id]
from public.savings_overrides o
join mig_users u on u.plan_id = o.plan_id
join mig_funds f on f.user_id = u.user_id and f.key = o.goal
on conflict do nothing;

-- ---------- bonuses ----------
-- 13th month and CIP become one yearly rule each (the latest event gives its settings); a plain bonus becomes a one-off rule.
drop table if exists mig_rule;
create temp table mig_rule as
select e.id as event_id,
  case when e.kind = 'bonus' then e.id
       else first_value(e.id) over (partition by e.user_id, e.kind order by e.pay_date desc, e.id) end as rule_id
from public.windfall_events e
join mig_users u on u.plan_id = e.plan_id;

insert into public.bonus_rules
  (id, user_id, payslip_cutoff, recurrence, kind, name, pay_month, once_on, formula, base_multiple_bp, eligible_amount,
   component_num, fixed_amount, de_minimis)
select e.id, e.user_id, e.cutoff,
  case e.kind when 'bonus' then 'once' else 'yearly' end,
  case e.kind when 'bonus' then 'oneoff' else e.kind end,
  e.name, extract(month from e.pay_date)::int,
  case e.kind when 'bonus' then e.pay_date else null end,
  case when e.kind = 'cip' then 'eligible_x_component_x_multiplier'
       when e.kind = 'thirteenth' and e.gross is null then 'base_multiple'
       else 'fixed' end,
  case when e.kind = 'thirteenth' and e.gross is null then 10000 else null end,
  case when e.kind = 'cip' then e.cip_eligible else null end,
  case when e.kind = 'cip' then e.cip_component_num else null end,
  case when e.kind <> 'cip' and e.gross is not null then e.gross else null end,
  e.de_minimis
from public.windfall_events e
where e.id in (select rule_id from mig_rule);

insert into public.bonus_instances (id, user_id, rule_id, year, multiplier_num, status)
select e.id, e.user_id, r.rule_id, extract(year from e.pay_date)::int, e.cip_multiplier_num,
  case when e.pay_date < (now() at time zone 'Asia/Manila')::date then 'received' else 'planned' end
from public.windfall_events e
join mig_rule r on r.event_id = e.id
on conflict do nothing;

insert into public.bonus_instance_splits (user_id, instance_id, target_kind, label, amount, done)
select a.user_id, a.event_id,
  case when lower(a.name) like '%debt%' then 'debt' when lower(a.name) like '%want%' then 'wants' else 'purchase' end,
  a.name, a.amount, a.done
from public.windfall_allocations a
where a.event_id in (select id from public.bonus_instances);

drop table if exists mig_users, mig_cat, mig_funds, mig_rule;

-- Rollback (removes only what this file added; the old tables were never changed):
-- delete from public.bonus_instance_splits; delete from public.bonus_instances; delete from public.bonus_rules;
-- delete from public.month_fund_overrides; delete from public.month_overrides; delete from public.funds;
-- delete from public.pay_settings; delete from public.allowances; delete from public.salary_events;
-- delete from public.budget_lines_v2; delete from public.categories; delete from public.category_groups;
-- delete from public.plan_assumptions; delete from public.balance_anchors; delete from public.accounts;
-- drop table public.legacy_plan_snapshots;
-- (user_settings payday columns are dropped by the schema file's rollback.)
