import { loadReimbursements, reimbursementOverrides } from "@/lib/budget/reimburse";
import { monthEditsOf } from "@/lib/pay/month-edits";
import type { SupabaseClient } from "@supabase/supabase-js";
import { addMonths, isoDate, type IsoDate, type YearMonth } from "@/lib/domain/dates";
import { money, sum, type Money } from "@/lib/domain/money";
import { cutoffOfficeDays, settleRows } from "@/lib/budget/rto";
import { balanceNow } from "@/lib/engine/balances";
import { movedToWants, rtoDayBudget, takenFromWants, type PoolEntrySpec } from "@/lib/engine/budget";
import { usualOfficeDays } from "@/lib/engine/months";
import { runProjection } from "@/lib/engine/projection";
import {
  allowanceOf,
  assumptionsOf,
  paySettingsOf,
  withPlanExtra,
  raiseAllocationOf,
  salaryEventOf,
  type AllowanceRow,
  type AssumptionsRow,
  type PaySettingsRow,
  type RaiseAllocationRow,
  type SalaryEventRow,
} from "@/lib/engine/rows";
import { todayManila } from "@/lib/plans/validate";
import { loadPlans } from "@/lib/budget/plans-load";
import { bonusesLanding, payRecorded, PAYDAY_PROMPT_DAYS, type BonusRuleLite } from "@/lib/pay/payday";
import { buildNowView, currentCutoff, manilaDate, type NowCategory, type NowLine, type NowTxn, type NowView } from "./summary";

export interface AccountCard {
  id: string;
  name: string;
  kind: string;
  last4: string | null;
  color: string | null;
  balance: Money;
  /** When the balance was last confirmed (the latest anchor). */
  confirmedOn: string | null;
}

export type NowData =
  | { kind: "setup"; reason: "no-salary" | "no-budget" }
  | {
      kind: "ready";
      today: IsoDate;
      view: NowView;
      accounts: AccountCard[];
      /** Sum of the accounts you own (cards you owe on are left out). */
      total: Money;
      /** Office days that ended over or under budget and are not settled yet. */
      settleOpen: number;
      /** The next payday's money: the payslip that lands then. */
      nextPay: { date: IsoDate; amount: Money; cutoff: "first" | "second" };
      /** "Has the pay arrived?": shown early in a cutoff until its pay is recorded. amount = this cutoff's take-home from the payslip. */
      payday: { amount: Money; cutoff: "first" | "second"; bonuses: string[]; accountId: string | null } | null;
      /** Categories the Planned vs spent panel shows; null = all. */
      nowCategories: string[] | null;
    };

interface SettingsRow { first_payday_day: number; second_payday_day: number; office_days: number[]; rto_amount: number }
interface CategoryRow { id: string; name: string; color: string | null; group_id: string }
interface GroupRow { id: string; name?: string; feeds_savings: boolean }
interface LineRow {
  id: string; category_id: string; name: string; rule: "fixed" | "pct" | "rest"; amount: number | null; pct_bp: number | null;
  amount_second: number | null; reimburse_amount: number | null; reimburse_cutoff: "first" | "second" | null; reimburse_day: number | null;
  cutoff: "first" | "second" | "both"; account_id: string | null; starts_on: string | null; ends_on: string | null; is_draft: boolean;
  counts_to_daily: boolean; kind: "normal" | "rto" | "rto_contingency";
}
interface AccountRow { id: string; name: string; kind: string; last4: string | null; color: string | null }
interface AnchorRow { account_id: string; as_of: string; amount: number }
interface TxnRow {
  id: string; account_id: string; occurred_at: string; amount: number; merchant: string | null; category_id: string | null;
  budget_line_id: string | null; kind: "expense" | "income" | "transfer"; status: "pending" | "confirmed" | "ignored";
}

const rows = <T,>(r: { data: unknown }): T[] => (r.data ?? []) as T[];
const nextDay = (d: IsoDate): string => new Date(Date.parse(d) + 86_400_000).toISOString().slice(0, 10);

export async function loadNow(supabase: SupabaseClient): Promise<NowData> {
  const today = isoDate(todayManila());
  const { data: s } = await supabase.from("user_settings").select("first_payday_day, second_payday_day, office_days, rto_amount").maybeSingle();
  const settings = (s as SettingsRow | null) ?? { first_payday_day: 10, second_payday_day: 25, office_days: [1, 2], rto_amount: 0 };
  const paydays = { first: settings.first_payday_day, second: settings.second_payday_day };
  const { period, budgetMonth } = currentCutoff(today, paydays);
  const from = `${period.start}T00:00:00+08:00`;
  const to = `${nextDay(period.end)}T00:00:00+08:00`;

  const [events, allowances, assumptions, pay, groups, cats, lineRows, alloc, accts, anchors, periodTxns, poolEntryRes, overrideRes] = await Promise.all([
    supabase.from("salary_events").select("id, effective_month, kind, pct_bp, new_base, allowance_id, one_off_amount, one_off_taxable, status"),
    supabase.from("allowances").select("id, payslip_cutoff, name, amount, frequency, pay_month, taxable, starts_on, ends_on"),
    supabase.from("plan_assumptions").select("cip_multiplier_num, assumed_raise_on, assumed_raise_bp, assumed_raise_month").maybeSingle(),
    supabase.from("pay_settings").select("sss_override, philhealth_override, pagibig_override, tax_override_first, tax_override_second, other_deduction, savings_plan_bp").maybeSingle(),
    supabase.from("category_groups").select("id, name, feeds_savings"),
    supabase.from("categories").select("id, name, color, group_id").is("archived_at", null),
    supabase.from("budget_lines_v2").select("id, category_id, name, rule, amount, pct_bp, amount_second, reimburse_amount, reimburse_cutoff, reimburse_day, cutoff, account_id, starts_on, ends_on, is_draft, counts_to_daily, kind").order("sort"),
    supabase.from("raise_allocations").select("salary_event_id, budget_line_id, mode, amount, pct_bp"),
    supabase.from("accounts").select("id, name, kind, last4, color").is("archived_at", null).order("sort"),
    supabase.from("balance_anchors").select("account_id, as_of, amount"),
    supabase.from("transactions").select("id, account_id, occurred_at, amount, merchant, category_id, budget_line_id, kind, status").gte("occurred_at", from).lt("occurred_at", to),
    supabase.from("pool_entries").select("kind, amount, occurred_on").gte("occurred_on", period.start).lte("occurred_on", period.end),
    supabase.from("office_day_overrides").select("day, in_office").gte("day", period.start).lte("day", period.end),
  ]);
  // The savings plan's amount and fund are asked for on their own, so a database without that update still loads.
  const planExtra = await supabase.from("pay_settings").select("savings_plan_amount, savings_plan_fund_id").maybeSingle();
  // The name of the other deduction comes from a newer migration too, so it is asked for separately.
  const labelExtra = await supabase.from("pay_settings").select("other_deduction_label").maybeSingle();
  // The list of other deductions is a newer migration still.
  const listExtra = await supabase.from("pay_settings").select("other_deductions").maybeSingle();
  // "This month only" payslip changes; a database without that update has none.
  const editRes = await supabase.from("payslip_month_edits").select("month, cutoff, source, label, amount");
  // Same for the rev-36 settings: without that update there is no remembered pay account and the panel shows everything.
  const nowExtra = await supabase.from("user_settings").select("pay_account_id, now_categories").maybeSingle();
  const extra = (nowExtra.error ? null : nowExtra.data) as { pay_account_id: string | null; now_categories: string[] | null } | null;
  const bonusRuleRes = await supabase.from("bonus_rules").select("name, recurrence, pay_month, once_on, payslip_cutoff");


  const salaryEvents = rows<SalaryEventRow>(events).map(salaryEventOf);
  if (!salaryEvents.some((e) => e.kind === "start")) return { kind: "setup", reason: "no-salary" };
  const lineData = rows<LineRow>(lineRows);
  if (lineData.length === 0) return { kind: "setup", reason: "no-budget" };

  const feeds = new Map(rows<GroupRow>(groups).map((g) => [g.id, g.feeds_savings]));
  const groupNames = new Map(rows<GroupRow>(groups).map((g) => [g.id, g.name ?? null]));
  const categories: NowCategory[] = rows<CategoryRow>(cats).map((c) => ({ id: c.id, name: c.name, color: c.color, feedsSavings: feeds.get(c.group_id) ?? false, groupName: groupNames.get(c.group_id) ?? null }));
  const catById = new Map(categories.map((c) => [c.id, c]));
  const { plans, planOf } = await loadPlans(supabase);
  const lines: NowLine[] = lineData.map((l) => ({
    id: l.id,
    planId: planOf.get(l.id) ?? null,
    name: l.name,
    rule: l.rule,
    amount: l.amount == null ? null : money(l.amount),
    pctBp: l.pct_bp,
    amountSecond: l.amount_second == null ? null : money(l.amount_second),
    reimburse: l.reimburse_amount != null && l.reimburse_cutoff ? { amount: money(l.reimburse_amount), cutoff: l.reimburse_cutoff, day: l.reimburse_day } : null,
    cutoff: l.cutoff,
    startsOn: l.starts_on ? (l.starts_on.slice(0, 7) as YearMonth) : null,
    endsOn: l.ends_on ? (l.ends_on.slice(0, 7) as YearMonth) : null,
    isDraft: l.is_draft,
    feedsSavings: catById.get(l.category_id)?.feedsSavings ?? false,
    countsToDaily: l.counts_to_daily,
    kind: l.kind,
    categoryId: l.category_id,
    accountId: l.account_id,
  }));

  // This cutoff's budget, and the next payday's payslip, from the same engine the forecast will use.
  const reimbursements = await loadReimbursements(supabase, { lines, plans, month: budgetMonth, current: period.which === 1 ? "first" : "second", paydays });
  const run = runProjection(
    {
      start: budgetMonth,
      months: 2,
      events: salaryEvents,
      allowances: rows<AllowanceRow>(allowances).map(allowanceOf),
      assumptions: assumptionsOf((assumptions.data as AssumptionsRow | null) ?? null),
      settings: { ...paySettingsOf(withPlanExtra(withPlanExtra(withPlanExtra((pay.data as PaySettingsRow | null) ?? null, planExtra), labelExtra), listExtra)), monthEdits: monthEditsOf(editRes.error ? [] : ((editRes.data ?? []) as Parameters<typeof monthEditsOf>[0])) },
      bonusRules: [],
      bonusInstances: [],
      lines,
      allocations: rows<RaiseAllocationRow>(alloc).map(raiseAllocationOf),
      funds: [],
      fundStart: {},
      plans,
      reimbursementOverrides: reimbursementOverrides(reimbursements, lines, plans),
    },
    { includeExpected: false },
  );
  const here = run[0]!;
  const nextPayCutoff = period.which === 1 ? "second" : "first";
  const nextPayMonth = period.which === 1 ? run[0]! : run[1]!;
  const nextPayDate = isoDate(
    period.which === 1
      ? `${budgetMonth}-${String(paydays.second).padStart(2, "0")}`
      : `${addMonths(budgetMonth, 1)}-${String(paydays.first).padStart(2, "0")}`,
  );

  const accountRows = rows<AccountRow>(accts);
  const nameOf = new Map(accountRows.map((a) => [a.id, a.name]));
  const txns: NowTxn[] = rows<TxnRow>(periodTxns).map((t) => ({
    id: t.id,
    occurredAt: t.occurred_at,
    amount: money(t.amount),
    merchant: t.merchant,
    categoryId: t.category_id,
    budgetLineId: t.budget_line_id,
    accountName: nameOf.get(t.account_id) ?? "Account",
    kind: t.kind,
    status: t.status,
  }));

  const poolEntries = rows<{ kind: PoolEntrySpec["kind"]; amount: number; occurred_on: string }>(poolEntryRes);
  const specs: PoolEntrySpec[] = poolEntries.map((e) => ({ kind: e.kind, amount: money(e.amount) }));
  // The office-day amount is never typed: it is the RTO lines' cutoff total divided by the usual office days in the cutoff.
  const dayBudget = rtoDayBudget(here.budget.rtoTotal[period.which === 1 ? "first" : "second"], usualOfficeDays(period, settings.office_days));
  const view = buildNowView({
    today,
    paydays,
    officeDays: settings.office_days,
    officeDayAmount: dayBudget,
    budget: here.budget,
    lines,
    categories,
    txns,
    movedToWants: movedToWants(specs),
    takenFromWants: takenFromWants(specs),
  });

  // Office days that ended over or under budget and have not been settled yet (the nudge on Now).
  const rtoCategories = new Set(lines.filter((l) => l.kind === "rto").map((l) => l.categoryId));
  const spendByDay = new Map<string, Money>();
  for (const t of txns) {
    if (t.kind !== "expense" || t.status !== "confirmed" || !t.categoryId || !rtoCategories.has(t.categoryId)) continue;
    const day = manilaDate(t.occurredAt);
    spendByDay.set(day, money((spendByDay.get(day) ?? 0) - t.amount));
  }
  const days = cutoffOfficeDays(period, settings.office_days, new Map(rows<{ day: string; in_office: boolean }>(overrideRes).map((o) => [o.day, o.in_office])));
  const settleOpen = settleRows({
    days,
    spendByDay,
    dayBudget,
    settledDays: new Set(poolEntries.filter((e) => ["settle_to_pool", "settle_to_wants", "settle_to_savings", "over_from_wants", "over_from_excess"].includes(e.kind)).map((e) => e.occurred_on)),
    today,
  }).filter((r) => !r.settled).length;

  // Balances: the latest anchor plus confirmed transactions since the earliest anchor (cheap and small for one user).
  const anchorRows = rows<AnchorRow>(anchors);
  const earliest = anchorRows.map((a) => a.as_of).sort()[0];
  const sinceTxns = earliest
    ? rows<TxnRow>(await supabase.from("transactions").select("id, account_id, occurred_at, amount, status, kind, merchant, category_id, budget_line_id").eq("status", "confirmed").gte("occurred_at", earliest))
    : [];
  const accounts: AccountCard[] = accountRows.map((a) => {
    const mine = anchorRows.filter((x) => x.account_id === a.id);
    const latest = [...mine].sort((x, y) => y.as_of.localeCompare(x.as_of))[0];
    return {
      id: a.id,
      name: a.name,
      kind: a.kind,
      last4: a.last4,
      color: a.color,
      balance: balanceNow(
        mine.map((x) => ({ asOf: x.as_of, amount: money(x.amount) })),
        sinceTxns.filter((t) => t.account_id === a.id).map((t) => ({ occurredAt: t.occurred_at, amount: money(t.amount), status: t.status })),
      ),
      confirmedOn: latest ? latest.as_of.slice(0, 10) : null,
    };
  });

  return {
    kind: "ready",
    today,
    view,
    accounts,
    total: sum(accounts.filter((a) => a.kind !== "credit").map((a) => a.balance)),
    settleOpen,
    nextPay: { date: nextPayDate, amount: nextPayMonth.pay[nextPayCutoff].takeHome, cutoff: nextPayCutoff },
    payday:
      view.dayNumber <= PAYDAY_PROMPT_DAYS && !payRecorded(txns)
        ? {
            amount: here.pay[view.cutoff].takeHome,
            cutoff: view.cutoff,
            bonuses: bonusesLanding(rows<BonusRuleLite>(bonusRuleRes), budgetMonth, view.cutoff),
            accountId: extra?.pay_account_id && accountRows.some((a) => a.id === extra.pay_account_id) ? extra.pay_account_id : null,
          }
        : null,
    nowCategories: extra?.now_categories ?? null,
  };
}
