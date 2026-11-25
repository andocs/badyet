import type { YearMonth } from "@/lib/domain/dates";
import { money, sum, ZERO, type Money } from "@/lib/domain/money";
import type { BudgetMonth } from "@/lib/engine/budget";
import type { BudgetLine } from "@/lib/engine/types";

/** A budget line as stored, with the names the screen needs. */
export interface LineRow extends BudgetLine {
  categoryId: string;
  accountId: string | null;
  /** The editor's own fields, kept apart from the engine's: the percent and amount exactly as typed. */
  sort: number;
}

export interface GroupRow {
  id: string;
  name: string;
  feedsSavings: boolean;
}
export interface CategoryRow {
  id: string;
  name: string;
  color: string | null;
  groupId: string;
}

export interface LineView {
  id: string;
  name: string;
  categoryId: string;
  categoryName: string;
  rule: BudgetLine["rule"];
  pctBp: number | null;
  /** The fixed amount as stored (centavos), or null. */
  fixed: Money | null;
  /** The 2nd cutoff's amount when it differs from `fixed` (a fixed line on both cutoffs). */
  fixedSecond: Money | null;
  /** Money that comes back to this line each month, when set. */
  reimburse: BudgetLine["reimburse"] | null;
  /** This month's amount in each cutoff, so a line with different values shows each. */
  perCutoff: { first: Money; second: Money } | null;
  cutoff: BudgetLine["cutoff"];
  accountId: string | null;
  accountName: string | null;
  startsOn: YearMonth | null;
  endsOn: YearMonth | null;
  isDraft: boolean;
  countsToDaily: boolean;
  kind: BudgetLine["kind"];
  /** This month's amount over both cutoffs, or null when the line is off this month (or a draft). */
  amount: Money | null;
  topUps: { eventId: string; amount: Money }[];
  /** What has gone out so far this cutoff, when it can be told. */
  spent: { amount: Money; word: "spent" | "sent" } | null;
}

export interface GroupView {
  id: string;
  name: string;
  feedsSavings: boolean;
  lines: LineView[];
  /** Sum of this month's amounts. */
  total: Money;
  /** Percent of take-home, 0 to 100. */
  share: number;
  spentTotal: Money;
}

/**
 * Lines grouped for the Budget screen. Amounts come from the engine's budget for the month; a line that is off this month (before its
 * start, after its end) or a draft stays listed with no amount so it can still be opened and edited.
 */
export function buildGroups(input: {
  groups: readonly GroupRow[];
  categories: readonly CategoryRow[];
  lines: readonly LineRow[];
  accounts: ReadonlyMap<string, string>;
  budget: BudgetMonth;
  takeHome: Money;
  spentByLine?: ReadonlyMap<string, { amount: Money; word: "spent" | "sent" }>;
}): GroupView[] {
  const cat = new Map(input.categories.map((c) => [c.id, c]));
  const amountOf = new Map(input.budget.lines.map((l) => [l.lineId, l]));
  return input.groups.map((g) => {
    const views: LineView[] = input.lines
      .filter((l) => cat.get(l.categoryId)?.groupId === g.id)
      .sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name))
      .map((l) => {
        const a = amountOf.get(l.id);
        return {
          id: l.id,
          name: l.name,
          categoryId: l.categoryId,
          categoryName: cat.get(l.categoryId)?.name ?? "",
          rule: l.rule,
          pctBp: l.pctBp ?? null,
          fixed: l.amount ?? null,
          fixedSecond: l.amountSecond ?? null,
          reimburse: l.reimburse ?? null,
          perCutoff: a ? { first: a.first, second: a.second } : null,
          cutoff: l.cutoff,
          accountId: l.accountId,
          accountName: l.accountId ? (input.accounts.get(l.accountId) ?? null) : null,
          startsOn: l.startsOn ?? null,
          endsOn: l.endsOn ?? null,
          isDraft: l.isDraft === true,
          countsToDaily: l.countsToDaily,
          kind: l.kind,
          amount: a ? a.total : null,
          topUps: (a?.topUps ?? []).map((t) => ({ eventId: t.salaryEventId, amount: money(t.first + t.second) })),
          spent: input.spentByLine?.get(l.id) ?? null,
        };
      });
    const total = sum(views.map((v) => v.amount ?? ZERO));
    return {
      id: g.id,
      name: g.name,
      feedsSavings: g.feedsSavings,
      lines: views,
      total,
      share: input.takeHome > 0 ? Math.max(0, Math.min(100, (total / input.takeHome) * 100)) : 0,
      spentTotal: sum(views.map((v) => v.spent?.amount ?? ZERO)),
    };
  });
}

export const ruleText = (l: Pick<LineView, "rule" | "pctBp">): string =>
  l.rule === "pct" ? `${(l.pctBp ?? 0) / 100}% of take-home` : l.rule === "rest" ? "Whatever is left" : "Fixed";

export const cutoffText = (c: BudgetLine["cutoff"]): string => (c === "first" ? "1st cutoff" : c === "second" ? "2nd cutoff" : "Both cutoffs");

export type MonthFlag = "over" | "tight" | null;

/** "over" when fixed and percent lines exceed take-home in either cutoff; "tight" when what is left is under the threshold. */
export function monthFlag(b: BudgetMonth, tightBelow: Money): MonthFlag {
  if (b.over.first || b.over.second) return "over";
  const rest = b.rest.first + b.rest.second;
  return rest < tightBelow ? "tight" : null;
}

/**
 * One cutoff's view of the month's groups: each line at its amount in that cutoff, lines with nothing in it left out, and each
 * group's total and share worked against that cutoff's take-home.
 */
export function groupsForCutoff(groups: readonly GroupView[], cutoff: "first" | "second", cutoffTakeHome: number): GroupView[] {
  return groups.map((g) => {
    const lines = g.lines
      .map((l) => ({ ...l, amount: l.amount === null ? null : l.perCutoff ? l.perCutoff[cutoff] : l.amount }))
      .filter((l) => l.amount === null || l.amount > 0);
    const total = sum(lines.map((l) => l.amount ?? ZERO));
    return { ...g, lines, total, share: cutoffTakeHome > 0 ? Math.max(0, Math.min(100, (total / cutoffTakeHome) * 100)) : 0 };
  });
}
