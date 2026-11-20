import type { SupabaseClient } from "@supabase/supabase-js";
import { isoDate, type IsoDate, type YearMonth } from "@/lib/domain/dates";
import { money, type Money } from "@/lib/domain/money";
import type { PoolEntrySpec } from "@/lib/engine/budget";
import { raiseAllocationOf, type RaiseAllocationRow } from "@/lib/engine/rows";
import type { RaiseAllocation } from "@/lib/engine/types";
import { currentCutoff, manilaDate } from "@/lib/now/summary";
import { todayManila } from "@/lib/plans/validate";
import { loadSalary, type SalaryData } from "@/lib/salary/load";
import type { CategoryRow, GroupRow, LineRow } from "./view";

export interface PoolData {
  id: string;
  name: string;
  lineId: string | null;
  keepUpTo: Money | null;
  createdOn: IsoDate;
  entries: (PoolEntrySpec & { id: string; occurredOn: IsoDate; note: string | null })[];
}

export interface BudgetData {
  salary: SalaryData;
  today: IsoDate;
  paydays: { first: number; second: number };
  /** The cutoff today falls in. */
  period: { start: IsoDate; end: IsoDate; which: 1 | 2; month: YearMonth };
  groups: GroupRow[];
  categories: CategoryRow[];
  lines: LineRow[];
  accounts: { id: string; name: string }[];
  allocations: RaiseAllocation[];
  officeDays: number[];
  officeDayAmount: Money;
  overrides: Map<string, boolean>;
  pools: PoolData[];
  /** Confirmed spending this cutoff: by category, by line (bills sent), and by day for the RTO categories. */
  spentByCategory: Map<string, Money>;
  sentLineIds: Set<string>;
  spendByDay: Map<string, Money>;
}

interface LineDb {
  id: string; category_id: string; name: string; rule: "fixed" | "pct" | "rest"; amount: number | null; pct_bp: number | null;
  cutoff: "first" | "second" | "both"; account_id: string | null; starts_on: string | null; ends_on: string | null; is_draft: boolean;
  sort: number; counts_to_daily: boolean; kind: "normal" | "rto" | "rto_contingency";
}
const rows = <T,>(r: { data: unknown }): T[] => (r.data ?? []) as T[];
const nextDay = (d: IsoDate): string => new Date(Date.parse(d) + 86_400_000).toISOString().slice(0, 10);

/** Everything the Budget screen needs. Row-level security keeps every query to the signed-in user's rows. */
export async function loadBudget(supabase: SupabaseClient): Promise<BudgetData> {
  const salary = await loadSalary(supabase);
  const today = isoDate(todayManila());
  const { data: s } = await supabase.from("user_settings").select("first_payday_day, second_payday_day, office_days, rto_amount").maybeSingle();
  const settings = (s as { first_payday_day: number; second_payday_day: number; office_days: number[]; rto_amount: number } | null) ?? { first_payday_day: 10, second_payday_day: 25, office_days: [1, 2], rto_amount: 0 };
  const paydays = { first: settings.first_payday_day, second: settings.second_payday_day };
  const { period, budgetMonth } = currentCutoff(today, paydays);
  const from = `${period.start}T00:00:00+08:00`;
  const to = `${nextDay(period.end)}T00:00:00+08:00`;

  const [groups, cats, lineRes, accts, alloc, poolRes, entryRes, overrideRes, txns] = await Promise.all([
    supabase.from("category_groups").select("id, name, feeds_savings, sort").is("archived_at", null).order("sort"),
    supabase.from("categories").select("id, name, color, group_id").is("archived_at", null).order("sort"),
    supabase.from("budget_lines_v2").select("id, category_id, name, rule, amount, pct_bp, cutoff, account_id, starts_on, ends_on, is_draft, sort, counts_to_daily, kind").order("sort"),
    supabase.from("accounts").select("id, name").is("archived_at", null).order("sort"),
    supabase.from("raise_allocations").select("salary_event_id, budget_line_id, mode, amount, pct_bp"),
    supabase.from("pools").select("id, name, budget_line_id, keep_up_to, created_on"),
    supabase.from("pool_entries").select("id, pool_id, occurred_on, kind, amount, note"),
    supabase.from("office_day_overrides").select("day, in_office").gte("day", period.start).lte("day", period.end),
    supabase.from("transactions").select("occurred_at, amount, category_id, budget_line_id, kind, status").gte("occurred_at", from).lt("occurred_at", to).eq("status", "confirmed"),
  ]);

  const lines: LineRow[] = rows<LineDb>(lineRes).map((l) => ({
    id: l.id,
    name: l.name,
    rule: l.rule,
    amount: l.amount == null ? null : money(l.amount),
    pctBp: l.pct_bp,
    cutoff: l.cutoff,
    startsOn: l.starts_on ? (l.starts_on.slice(0, 7) as YearMonth) : null,
    endsOn: l.ends_on ? (l.ends_on.slice(0, 7) as YearMonth) : null,
    isDraft: l.is_draft,
    feedsSavings: false, // filled in below from the group
    countsToDaily: l.counts_to_daily,
    kind: l.kind,
    categoryId: l.category_id,
    accountId: l.account_id,
    sort: l.sort,
  }));
  const groupRows: GroupRow[] = rows<{ id: string; name: string; feeds_savings: boolean }>(groups).map((g) => ({ id: g.id, name: g.name, feedsSavings: g.feeds_savings }));
  const categories: CategoryRow[] = rows<{ id: string; name: string; color: string | null; group_id: string }>(cats).map((c) => ({ id: c.id, name: c.name, color: c.color, groupId: c.group_id }));
  const feeds = new Map(groupRows.map((g) => [g.id, g.feedsSavings]));
  const groupOf = new Map(categories.map((c) => [c.id, c.groupId]));
  for (const l of lines) l.feedsSavings = feeds.get(groupOf.get(l.categoryId) ?? "") ?? false;

  const entries = rows<{ id: string; pool_id: string; occurred_on: string; kind: PoolEntrySpec["kind"]; amount: number; note: string | null }>(entryRes);
  const pools: PoolData[] = rows<{ id: string; name: string; budget_line_id: string | null; keep_up_to: number | null; created_on: string }>(poolRes).map((p) => ({
    id: p.id,
    name: p.name,
    lineId: p.budget_line_id,
    keepUpTo: p.keep_up_to == null ? null : money(p.keep_up_to),
    createdOn: isoDate(p.created_on),
    entries: entries.filter((e) => e.pool_id === p.id).map((e) => ({ id: e.id, kind: e.kind, amount: money(e.amount), occurredOn: isoDate(e.occurred_on), note: e.note })),
  }));

  // Spending this cutoff. RTO days are judged on spending in the RTO lines' categories.
  const rtoCategories = new Set(lines.filter((l) => l.kind === "rto").map((l) => l.categoryId));
  const spentByCategory = new Map<string, Money>();
  const sentLineIds = new Set<string>();
  const spendByDay = new Map<string, Money>();
  for (const t of rows<{ occurred_at: string; amount: number; category_id: string | null; budget_line_id: string | null; kind: string }>(txns)) {
    if (t.budget_line_id) sentLineIds.add(t.budget_line_id);
    if (t.kind !== "expense" || t.category_id === null) continue;
    spentByCategory.set(t.category_id, money((spentByCategory.get(t.category_id) ?? 0) - t.amount));
    if (rtoCategories.has(t.category_id)) {
      const day = manilaDate(t.occurred_at);
      spendByDay.set(day, money((spendByDay.get(day) ?? 0) - t.amount));
    }
  }

  return {
    salary,
    today,
    paydays,
    period: { start: period.start, end: period.end, which: period.which, month: budgetMonth },
    groups: groupRows,
    categories,
    lines,
    accounts: rows<{ id: string; name: string }>(accts),
    allocations: rows<RaiseAllocationRow>(alloc).map(raiseAllocationOf),
    officeDays: settings.office_days,
    officeDayAmount: money(settings.rto_amount),
    overrides: new Map(rows<{ day: string; in_office: boolean }>(overrideRes).map((o) => [o.day, o.in_office])),
    pools,
    spentByCategory,
    sentLineIds,
    spendByDay,
  };
}

