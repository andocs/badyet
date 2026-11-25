import type { YearMonth } from "@/lib/domain/dates";
import { money, sum, ZERO, type Money } from "@/lib/domain/money";
import { allocateSplits, planBonuses, type BonusPayment } from "@/lib/engine/bonus";
import { monthRange } from "@/lib/engine/months";
import { salaryAt, type SalaryInput } from "@/lib/salary/view";
import { EXEMPTION_CAP } from "@/lib/windfall/compute";
import type { BonusRule } from "@/lib/engine/types";

export type DestKind = "fund" | "gift" | "purchase" | "debt" | "wants" | "account";

export interface SavedSplit {
  kind: DestKind;
  targetId: string | null;
  label: string | null;
  amount: Money;
  done: boolean;
}

export interface DestView {
  kind: DestKind;
  targetId: string | null;
  label: string | null;
  /** What to show: the fund's name, or the name you gave it. */
  name: string;
  amount: Money;
  done: boolean;
}

export interface BonusCard {
  /** ruleId|year, stable across edits. */
  key: string;
  ruleId: string;
  year: number;
  name: string;
  kind: BonusRule["kind"];
  recurrence: BonusRule["recurrence"];
  month: YearMonth;
  cutoff: "first" | "second";
  status: "planned" | "received";
  gross: Money;
  deMinimis: Money;
  /** Counts toward the shared yearly tax-free cap. */
  exempt: Money;
  /** Room left in the cap before this one landed. */
  roomBefore: Money;
  /** The part past the cap, taxed. */
  over: Money;
  tax: Money;
  net: Money;
  /** For a received bonus: what the plan said it would be. */
  plannedNet: Money | null;
  /** The CIP Low/Base/High pick, hundredths, if one was made. */
  multiplierNum: number | null;
  dests: DestView[];
  unplaced: Money;
}

export function destName(kind: DestKind, targetId: string | null, label: string | null, funds: ReadonlyMap<string, string>): string {
  if (kind === "fund") return (targetId ? funds.get(targetId) : undefined) ?? label ?? "Fund";
  return label ?? { gift: "Gift", purchase: "Big purchase", debt: "Debt", wants: "Wants", account: "Account", fund: "Fund" }[kind];
}

/**
 * A year's bonuses as cards: gross to net by the engine (the shared cap worked in pay-month order), and where each one goes. Where you have
 * saved destinations for a bonus they are used; otherwise the rule's default splits. A received bonus also shows what was planned.
 */
export function bonusCards(year: number, input: SalaryInput, saved: ReadonlyMap<string, readonly SavedSplit[]>, funds: ReadonlyMap<string, string>): BonusCard[] {
  const months = monthRange(`${year}-01` as YearMonth, 12);
  const salaryOf = (m: YearMonth) => salaryAt(input, m);
  const payments = planBonuses(input.bonusRules, input.bonusInstances, salaryOf, input.settings, input.assumptions, months, input.templates);
  const planned = planBonuses(
    input.bonusRules,
    input.bonusInstances.map((i) => ({ ...i, status: "planned" as const, grossActual: null, deMinimisActual: null, netActual: null })),
    salaryOf,
    input.settings,
    input.assumptions,
    months,
    input.templates,
  );

  let used = ZERO as Money;
  return payments.map((p: BonusPayment) => {
    const instance = input.bonusInstances.find((i) => i.ruleId === p.ruleId && i.year === year);
    const rule = input.bonusRules.find((r) => r.id === p.ruleId)!;
    const key = `${p.ruleId}|${year}`;
    const roomBefore = money(Math.max(0, EXEMPTION_CAP - used));
    used = money(used + p.exempt);

    const own = saved.get(key);
    const dests: DestView[] = own
      ? own.map((s) => ({ kind: s.kind, targetId: s.targetId, label: s.label, name: destName(s.kind, s.targetId, s.label, funds), amount: s.amount, done: s.done }))
      : allocateSplits(p.net, p.splits).placed.map(({ split, amount }) => ({
          kind: split.targetKind,
          targetId: split.targetId ?? null,
          label: split.label ?? null,
          name: destName(split.targetKind, split.targetId ?? null, split.label ?? null, funds),
          amount,
          done: false,
        }));
    const plannedPayment = planned.find((x) => x.ruleId === p.ruleId && x.month === p.month);
    return {
      key,
      ruleId: p.ruleId,
      year,
      name: p.name,
      kind: p.kind,
      recurrence: rule.recurrence,
      month: p.month,
      cutoff: p.cutoff,
      status: p.received ? "received" : "planned",
      gross: p.gross,
      deMinimis: p.deMinimis,
      exempt: p.exempt,
      roomBefore,
      over: money(Math.max(0, p.gross - p.deMinimis - p.exempt)),
      tax: p.tax,
      net: p.net,
      plannedNet: p.received && plannedPayment ? plannedPayment.net : null,
      multiplierNum: instance?.multiplierNum ?? null,
      dests,
      unplaced: money(p.net - sum(dests.map((d) => d.amount))),
    };
  });
}

export interface YearSummary {
  gross: Money;
  tax: Money;
  net: Money;
  count: number;
  /** Net placed by destination (kind, target and name together). */
  byDest: { key: string; name: string; kind: DestKind; amount: Money }[];
  unplaced: Money;
}

export function yearSummary(cards: readonly BonusCard[]): YearSummary {
  const by = new Map<string, { key: string; name: string; kind: DestKind; amount: Money }>();
  for (const c of cards) {
    for (const d of c.dests) {
      const key = `${d.kind}|${d.targetId ?? d.name}`;
      const row = by.get(key) ?? { key, name: d.name, kind: d.kind, amount: ZERO };
      row.amount = money(row.amount + d.amount);
      by.set(key, row);
    }
  }
  return {
    gross: sum(cards.map((c) => c.gross)),
    tax: sum(cards.map((c) => c.tax)),
    net: sum(cards.map((c) => c.net)),
    count: cards.length,
    byDest: [...by.values()].sort((a, b) => b.amount - a.amount),
    unplaced: money(Math.max(0, sum(cards.map((c) => c.unplaced)))),
  };
}
