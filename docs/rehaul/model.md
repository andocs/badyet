# Bad(yet) rehaul: data model sketch

Sketch only. No migrations, no code. Conventions stay as today: Postgres on Supabase, RLS on `user_id = auth.uid()` (default `auth.uid()`), money as integer centavos (`bigint`), percentages in basis points (`int`, 10000 = 100%), dates in Asia/Manila, a "month" is a `date` on the first of the month.

Written for: the owner and whoever builds the migrations.

## Principles

1. **Rules and events, not plans.** Salary events, bonus rules and budget line rules are the inputs. Everything else (take-home, future budgets, fund balances, forecast) is computed by pure functions in `lib/` and never stored. A cache can be added later without changing the schema.
2. **Actuals are transactions.** A balance is the last confirmed anchor plus confirmed transactions since.
3. **No `plan_id`.** The dated plan disappears. There is one live set of assumptions. (Round 2: scenarios are dropped from the UI. `plan_assumptions` below can grow into scenarios later without touching the other tables.)
4. **Overrides are data, not forks.** One row per overridden month.

## Tables

### settings

`user_settings` (exists, extended): `user_id pk`, `first_payday_day int` (10), `second_payday_day int` (25), `timezone text default 'Asia/Manila'`, `notif_capture_enabled bool`, `hide_amounts bool`, `updated_at`.
Today's `second_cutoff_start_day`/`first_cutoff_start_day` are replaced by paydays (the cutoff start day is payday + 1); a view keeps the old columns for the existing code until it is retired.

### accounts and balances

`accounts` (replaces `wallets`): `id`, `name`, `kind` (`ewallet|debit|savings|credit|cash`), `institution`, `last4`, `color` (the card colour), `receive_qr_path null` (a saved receive-QR image in private storage, signed URL on view), `credit_limit`, `statement_day`, `due_day`, `sort`, `archived_at`. Never a full number, expiry, CVV or PIN. The QR is the account's own receive code, never a card.

`balance_anchors`: `id`, `account_id`, `as_of timestamptz`, `amount bigint`, `source` (`wizard|reconcile|import`). The latest anchor is "last confirmed balance".

Balance now = latest anchor amount + sum of `confirmed` transactions with `occurred_at > as_of`. The old `wallets.balance` and `balance_as_of` migrate into the first anchor.

### transactions

`transactions`: `id`, `account_id`, `occurred_at timestamptz`, `amount bigint` (negative = money out), `merchant text`, `kind` (`expense|income|transfer`), `category_id null`, `budget_line_id null` (set when a planned line is ticked), `transfer_peer_id null` (other leg), `source` (`notification|manual|transfer|import|bonus`), `status` (`pending|confirmed|ignored`), `confirmed_at null`, `note`, `dedupe_hash text unique per user` (hash of account+amount+time+merchant; no raw notification text stored), `created_at`.
Indexes: `(account_id, occurred_at)`, `(status)`, `(category_id, occurred_at)`.
Cutoff and month are derived from `occurred_at` and the paydays; never stored.

`merchant_rules`: `id`, `pattern text` (case-insensitive contains), `category_id`, `account_id null`, `priority int`, `created_at`. Applied when a pending row is created; "Always put Grab under Commute" inserts one.

### categories and budget lines

`category_groups`: `id`, `name`, `sort`, `feeds_savings bool` (true for the group whose lines flow to the savings pool; Savings by default), `archived_at`.

`categories`: `id`, `group_id`, `name`, `color`, `sort`, `archived_at`. Archived categories keep their transactions.

`budget_lines` (replaces the old table; no `plan_id`): `id`, `category_id`, `name`, `rule` (`fixed|pct|rest`; inflation was removed in round 7), `amount bigint null` (fixed, infl), `pct_bp int null` (pct), `cutoff` (`first|second|both`), `account_id null` (destination), `starts_on date null`, `ends_on date null`, `is_draft bool`, `sort`, `source` (`manual|installment|subscription`), `source_id null`, `counts_to_daily bool` (the ticker; Wants lines default true), `kind` (`normal|rto|rto_contingency`; any number of `rto` lines, one `rto_contingency`).

Computation per month: `pct` = pct × projected take-home; `rest` = take-home minus every other line (floored at 0); a line is on only between `starts_on` and `ends_on`. Flags: `fixed+infl lines > take-home` is "over"; `rest < threshold` is "tight".

### salary

`salary_events`: `id`, `effective_month date`, `kind` (`start|merit|promotion|allowance|adjustment`), `pct_bp null` (merit), `new_base bigint null` (start, promotion, merit by amount), `allowance_id null` (an allowance change points at the row below), `one_off_amount bigint null` (adjustment, one month), `one_off_taxable bool`, `title null`, `grade null`, `status` (`confirmed|expected`), `note`. The raise and bonus wizards write these rows.

`allowances` (new, round 2): `id`, `payslip_cutoff` (`first|second`, where it lands), `name`, `amount bigint`, `frequency` (`monthly|yearly`), `pay_month int null` (the month a yearly one lands), `taxable bool`, `starts_on date`, `ends_on date null`. Taxable ones join taxable income in the engine; the rest are paid untaxed (de minimis limits stay the engine's concern). A monthly allowance raises each cutoff; a yearly one is a one-time credit in its month and is shown on that month's payslip.

`raise_allocations` (round 12): `id`, `salary_event_id`, `budget_line_id`, `mode` (`amount|percent`), `amount bigint null`, `pct_bp int null`. The budget evaluator adds each allocation to its line from the event's effective month; deleting or rescheduling the event moves or removes them, and the "without expected raises" view drops allocations whose event is `expected`.

`pay_settings` (replaces `pay_profiles`; no `plan_id`): `user_id pk`, `sss_override`, `philhealth_override`, `pagibig_override` (set from the raise wizard's Contributions step or first run; null = standard rates), `tax_override_first`, `tax_override_second`, `other_deduction`, `second_cutoff_allowance`, `savings_plan_bp` kept only until migrated into budget lines.

`tax_table_versions`: `id`, `effective_from date`, `kind` (`income_tax|sss|philhealth|pagibig`), `params jsonb`. One row per kind today; the place to add a future change ("tax tables hold from today" shows as a single open-ended row).

Take-home per month is computed by the existing engine (`lib/pay/compute.ts`) from the base and allowances in force that month, using the table versions in force. The Salary and tax page shows the working per month (earnings, SSS, PhilHealth, Pag-IBIG, taxable income, bracket by bracket, withholding) as a payslip. The engine returns that breakdown (a `PayBreakdown` with each step) rather than just the net, so the screen and the forecast read the same numbers.

### assumptions

`plan_assumptions` (one row per user; replaces `scenarios` in round 2): `user_id pk`, `cip_multiplier_num int` (hundredths, as today; the Low/Base/High switch on a bonus is a per-instance override), `assumed_raise_on bool`, `assumed_raise_bp`, `assumed_raise_month int` (3).

Assumed raises apply only to months after the year of the last salary event, and are flagged `assumed` in computed rows so charts can dash them. If scenarios return later, add `scenarios` and a nullable `scenario_id` on `salary_events`, `month_overrides` and `bonus_instances`; nothing else changes.

### bonuses

`bonus_rules`: `id`, `payslip_cutoff` (`first|second`), `recurrence` (`yearly|once`), `kind` (`thirteenth|cip|custom|oneoff`), `name`, `pay_month int` (the month it lands; for `once`, also `once_on date`), `formula` (`base_multiple|eligible_x_component_x_multiplier|fixed`), `base_multiple_bp null` (10000 = one month), `component_num null` (today's /10,000,000), `fixed_amount null`, `de_minimis bigint` (0 and locked for the 13th month), `sort`, `archived_at`.

`bonus_splits`: `id`, `rule_id`, `target_kind` (`fund|gift|purchase|debt|wants|account`), `target_id null`, `label null` (free text: a custom destination such as "Mom's birthday" has `target_kind = gift|purchase|wants` and only a label), `mode` (`amount|percent`, default `amount`), `amount bigint null`, `pct_bp int null`, `sort`. Most splits are flat amounts; percent is optional. Only `fund` targets enter the forecast's fund balances; `gift`, `purchase`, `debt` and `wants` are money spent on purpose, so the Bonuses page works as a small budget of its own. Defaults for the forecast; each year's instance can override.

`bonus_instances`: `id`, `rule_id`, `year int`, `multiplier_num null` (the Low/Base/High pick for CIP), `status` (`planned|received`), `gross_actual null`, `de_minimis_actual null`, `tax_actual null`, `net_actual null`, `received_transaction_id null`. Planned amounts are computed from the salary timeline (a raise raises the next 13th month and CIP); actuals fill in when received. The shared ₱90,000 cap is computed across a year's instances in pay-month order (existing `lib/windfall/compute.ts` logic).

`bonus_instance_splits`: `id`, `instance_id`, `target_kind`, `target_id null`, `label null`, `amount bigint`, `done bool`, `done_transaction_id null`. The ticked-off split.

### funds

`funds`: `id`, `name`, `color`, `priority int` (default order, 1 = first), `rule` (`steps|cap|reset|fixed`), `target bigint null` (cap, or the last tranche), `tranches bigint[] null` (steps), `max_per_month bigint null`, `fixed_amount bigint null`, `reset_month int null` (1 for yearly reset), `linked_account_id null`, `start_balance bigint null` (typed-in when not linked), `archived_at`.

If linked, current balance = account balance (open question 4 covers several funds sharing one account via a `share_bp` or fixed carve; not in this sketch). Forecast starts from the current balance.

Fill rules map to today's behaviour: `steps` = Emergency tranche, `reset` = Travel (reset each January), `cap` = fill to cap, `fixed` = fixed monthly.

### month overrides

`month_overrides`: `id`, `month date unique`, `order uuid[] null` (fund ids in this month's priority order), `note`, `created_at`.

`month_fund_overrides`: `id`, `override_id`, `fund_id`, `pin_amount bigint null`, `skip bool default false`. A fund is pinned (exact amount taken from the pool first) or skipped (gets nothing), never both.

Resolution for a month: take its row if present, else defaults. "Reset to default" deletes the row (and its child rows). "Apply this order to Jan to Mar" writes `order` into those months' rows.

### savings pool and forecast (computed)

Pool for month M = sum of the month's lines in groups with `feeds_savings` (including a `rest` line) + nothing else. Net bonuses assigned to funds go straight to those funds (capped by room; overflow is "unplaced") and are not part of the pool. Allocation: pinned amounts first, then funds in the resolved order, each taking `min(demand, remaining)`. Output per month and fund: amount, balance after, and a reason (`priority n`, `cap hit`, `pinned`, `skipped`, `pool ran out`, `takes the rest`) used by the month sheet.

### Daily spend and office days (round 7)

`user_settings` gains `office_days smallint[]` (ISO weekdays, default `{1,2}`) and `rto_amount bigint` (peso per office day). The amount is added on the usual days from the calendar and is computed, never typed: (sum of the cutoff amounts of lines flagged `rto`) ÷ (usual office days in the cutoff). `office_day_overrides` (`date`, `in_office bool`) holds the days the user marks (extra days, or a skipped usual day); each extra day writes a `pool_entries` row of kind `use` against the contingency pool. Settling an office day writes a `pool_entries` row (`settle_to_pool`, `settle_to_wants`, `over_from_wants`, `over_from_excess`) and, for Wants, a `wants_adjustments` amount on the cutoff.
Daily safe-to-spend for a date = (sum of cutoff lines with `counts_to_daily` − their confirmed spend, plus pool amounts moved to Wants) ÷ days left, plus `rto_amount` on a usual office day.

`pools`: `id`, `name`, `budget_line_id null` (the line that funds it each cutoff), `keep_up_to bigint null`, `balance` is computed. `pool_entries`: `id`, `pool_id`, `occurred_on`, `kind` (`fund|use|to_wants|settle_to_pool|over_from_excess`), `amount bigint`, `note`. A `use` can link to a confirmed transaction; `to_wants` raises that cutoff's daily pool.

### Payslip builder (round 7)

`payslip_templates`: `id`, `cutoff` (`first|second`), `effective_month date` (a new row from a month onward).
`payslip_lines`: `id`, `template_id`, `kind` (`earning|deduction`), `label`, `source` (`base_share|income_tax|sss|philhealth|pagibig|allowance|custom`), `share_bp int null` (base_share, default 5000 = half), `allowance_id null`, `amount_override bigint null`, `sort`.
Default: first cutoff = base half − income tax share; second cutoff = base half − the other income tax share − SSS − PhilHealth − Pag-IBIG + every allowance. `income_tax` appears on both templates with `share_bp` (5000 each by default). Bonus instances add their own lines (gross, tax over the cap) to the payslip of the month they land, on the cutoff set by the bonus rule (`payslip_cutoff`). The engine (`lib/pay/compute.ts`) still computes the monthly figures; the builder places them. `pay_settings` keeps tax overrides until migrated into template lines. Take-home per cutoff = sum of that template's lines, for every month of the projection.

## Migration map from today

| Today | Becomes | Notes |
|---|---|---|
| `plans` | dropped | Active plan's data becomes the live data; non-active plans are exported to a JSON snapshot, not migrated. |
| `pay_profiles.annual_base` | `salary_events` start row | `effective_month` = plan start; base = annual / 12. |
| `pay_profiles.allowance_second` | an `allowances` row (monthly) placed on the second-cutoff template |
| overrides, `other_deduction` | `pay_settings` | `savings_plan_bp` becomes a Savings-group `pct` line. |
| `budget_lines` (active plan) | `budget_lines` with `rule = fixed` | `bucket` → `category_groups`; each line gets a category named after it (editable). Cutoff `first|second` unchanged. Lines with `source` keep their link. |
| `installments`, `installment_payments` | `budget_lines` with `ends_on`; paid rows → confirmed transactions (optional) | End date = first due + (term − 1) months. |
| `subscriptions` | `budget_lines` (`active=false` → `ends_on` set) | |
| `wallets` | `accounts` + first `balance_anchors` row | |
| `transfer_marks` | confirmed transfer transactions (optional, open question 11) | `apply_transfer_marks()` retires once transactions drive balances. |
| `windfall_events` | `bonus_rules` + `bonus_instances` | `thirteenth|cip` become yearly rules; a `bonus` becomes a `once` rule (so the September bonus is one-off, not yearly); `pay_date` → month; per-event `de_minimis` → rule `de_minimis`. Past events become `received` instances, which is how last year's bonuses show. |
| `windfall_allocations` | `bonus_instance_splits` | `done` kept. Existing wants/debt allocations become `wants`/`debt` targets. |
| `savings_settings` | `funds` (three) | `ef_tranche`/`ef_hard_cap` → `steps` fund; `travel_cap` → `reset` fund; `wants_cap` → `cap` fund (`0` = archived); `priority` permutation → `priority` order; `start_*` → `start_balance`. |
| `savings_overrides` (goal leads this month) | `month_overrides.order` with that fund first | |
| `user_settings` | extended | See settings. |

Note from the scout: the current allocator zeroes **Wants** every January as well as Travel (`lib/domain/allocator.ts`, around line 125). The comment only mentions Travel. Confirm whether that is intended before migrating Wants to a plain cap fund.

## What stays

`lib/pay/compute.ts` (SSS, PhilHealth, Pag-IBIG, withholding tax), `lib/windfall/compute.ts` (de minimis per event, shared ₱90,000 cap, no de minimis on the 13th month) and the allocator's tranche logic keep their rules. New code wraps them: a month iterator, a salary-timeline resolver, a budget-rule evaluator, a fund allocator that honours overrides, and the transaction-to-balance fold.

## Row-level security and privacy

Every new table has `user_id uuid default auth.uid()` and the same single-owner policies as today. `transactions` stores no raw notification text. Last four digits are the only account identifier anywhere.
