import { addMonths, type YearMonth } from "@/lib/domain/dates";
import { money, sum, type Money } from "@/lib/domain/money";
import { movedToWants, takenFromWants } from "@/lib/engine/budget";
import { runProjection, type ProjectionInput, type ProjectionMonth } from "@/lib/engine/projection";
import type { BudgetData } from "./load";
import { buildGroups, monthFlag, type GroupView, type MonthFlag } from "./view";

/** ₱2,500 left in a month is "tight". */
export const TIGHT = 250_000;

export interface BudgetScreen {
  hasStart: boolean;
  fut: boolean;
  /** The month shown. */
  month: YearMonth;
  year: number;
  /** This cutoff's run (confirmed raises only), or null with no salary on file. */
  nowRun: ProjectionMonth | null;
  /** All twelve months of the year in Future years view. */
  yearRun: ProjectionMonth[] | null;
  shown: ProjectionMonth | null;
  /** Pool money moved to or from Wants this cutoff. */
  wantsAdj: Money;
  groups: GroupView[];
  /** Left of take-home after every line, both cutoffs. */
  rest: Money;
  takeHome: Money;
  fixed: Money;
  flag: MonthFlag;
  /** Names of the raises that top lines up, for the note under the board. */
  topUpRaises: string[];
}

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const monthLabel = (m: string): string => `${MON[Number(m.slice(5)) - 1]} ${m.slice(0, 4)}`;

/**
 * What the Budget screen shows: this cutoff, or a future month with the rules re-run against projected take-home.
 * Same assembly the web page does, kept here so the phone gets the same numbers.
 */
export function buildBudgetScreen(data: BudgetData, opts: { fut: boolean; month?: string | null }): BudgetScreen {
  const thisMonth = data.salary.thisMonth;
  const hasStart = data.salary.input.events.some((e) => e.kind === "start");
  const fut = opts.fut;
  const month: YearMonth = fut && /^\d{4}-(0[1-9]|1[0-2])$/.test(opts.month ?? "") ? (opts.month as YearMonth) : fut ? addMonths(thisMonth, 12) : data.period.month;
  const year = Number(month.slice(0, 4));

  const input = (start: YearMonth, months: number): ProjectionInput => ({
    start, months, ...data.salary.input, bonusRules: [], bonusInstances: [], lines: data.lines, allocations: data.allocations, funds: [], fundStart: {},
  });
  const nowRun = hasStart ? runProjection(input(data.period.month, 1), { includeExpected: false })[0]! : null;
  const yearRun = fut && hasStart ? runProjection(input(`${year}-01` as YearMonth, 12), { includeExpected: true }) : null;
  const shown: ProjectionMonth | null = fut ? (yearRun?.find((m) => m.month === month) ?? null) : nowRun;

  const periodEntries = data.pools.flatMap((p) => p.entries.filter((e) => e.occurredOn >= data.period.start && e.occurredOn <= data.period.end));
  const wantsAdj = money(movedToWants(periodEntries) - takenFromWants(periodEntries));
  const accounts = new Map(data.accounts.map((a) => [a.id, a.name]));
  const cutoffKey = data.period.which === 1 ? "first" : "second";
  const spentByLine = new Map<string, { amount: Money; word: "spent" | "sent" }>();
  if (!fut && nowRun) {
    for (const l of data.lines) {
      const planned = nowRun.budget.lines.find((x) => x.lineId === l.id)?.[cutoffKey] ?? 0;
      if (l.accountId) {
        if (data.sentLineIds.has(l.id) && planned > 0) spentByLine.set(l.id, { amount: money(planned), word: "sent" });
      } else if ((data.spentByCategory.get(l.categoryId) ?? 0) > 0) spentByLine.set(l.id, { amount: data.spentByCategory.get(l.categoryId)!, word: "spent" });
    }
  }
  const groups = shown
    ? buildGroups({ groups: data.groups, categories: data.categories, lines: data.lines, accounts, budget: shown.budget, takeHome: shown.pay.takeHome, spentByLine })
    : [];

  const b = shown?.budget;
  const takeHome = shown ? shown.pay.takeHome : money(0);
  const rest = b ? money(b.rest.first + b.rest.second) : money(0);
  const fixed = b ? sum(b.lines.filter((l) => data.lines.find((x) => x.id === l.lineId)?.rule === "fixed").map((l) => l.total)) : money(0);
  const eventLabel = new Map(data.salary.input.events.map((e) => [e.id, `${monthLabel(e.effectiveMonth)} raise`]));
  const topUpRaises = [...new Set(groups.flatMap((g) => g.lines.flatMap((l) => l.topUps.map((t) => eventLabel.get(t.eventId) ?? "a raise"))))];

  return { hasStart, fut, month, year, nowRun, yearRun, shown, wantsAdj, groups, rest, takeHome, fixed, flag: b ? monthFlag(b, money(TIGHT)) : null, topUpRaises };
}
