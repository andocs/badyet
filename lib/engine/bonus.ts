import type { YearMonth } from "@/lib/domain/dates";
import { monthParts } from "@/lib/domain/dates";
import { fromRatio, min, mulBp, sub, ZERO, type Money } from "@/lib/domain/money";
import { cipGross } from "@/lib/domain/windfall";
import type { PayProfile } from "@/lib/pay/compute";
import { CIP_COMPONENT_DENOMINATOR, CIP_MULTIPLIER_DENOMINATOR, computeEvents, type WindfallEvent } from "@/lib/windfall/compute";
import type { MonthSalary } from "./salary";
import type { Assumptions, BonusInstance, BonusRule, BonusSplit, PayCutoff, PaySettings } from "./types";

export interface BonusPayment {
  ruleId: string;
  name: string;
  kind: BonusRule["kind"];
  month: YearMonth;
  cutoff: PayCutoff;
  gross: Money;
  /** Tax-free on its own (de minimis), outside the yearly cap. */
  deMinimis: Money;
  /** Tax-free under the shared yearly cap. */
  exempt: Money;
  /** What reaches you (gross minus the tax it adds). */
  net: Money;
  tax: Money;
  received: boolean;
  splits: BonusSplit[];
}

/** The old engine's profile for a month, so windfall tax keeps using lib/windfall/compute.ts rules. */
export function profileFor(salary: MonthSalary, settings: PaySettings): PayProfile {
  const secondNontaxable = salary.allowances
    .filter((a) => a.allowance.payslipCutoff === "second" && !a.allowance.taxable)
    .reduce((t, a) => (t + a.amount) as Money, ZERO);
  return {
    annualBase: (salary.base * 12) as Money,
    allowanceSecond: secondNontaxable,
    sss: settings.sssOverride ?? ZERO,
    pagibig: settings.pagibigOverride ?? ZERO,
    savingsPlanBp: settings.savingsPlanBp,
    philhealthOverride: settings.philhealthOverride,
    taxOverrideFirst: null,
    taxOverrideSecond: null,
  };
}

function grossFor(
  rule: BonusRule,
  year: number,
  instance: BonusInstance | undefined,
  salaryOf: (m: YearMonth) => MonthSalary,
  assumptions: Assumptions,
  month: YearMonth,
): Money {
  if (rule.formula === "fixed") return rule.fixedAmount ?? ZERO;
  const base = salaryOf(month).base;
  if (rule.formula === "base_multiple") return mulBp(base, rule.baseMultipleBp ?? 10000);
  // CIP: a raise raises the payout. The eligible figure was typed for eligibleRefYear; later years scale with base pay.
  let eligible = rule.eligibleAmount ?? ZERO;
  const refYear = rule.eligibleRefYear ?? year;
  if (refYear !== year) {
    const ref = salaryOf(`${String(refYear).padStart(4, "0")}-${String(rule.payMonth).padStart(2, "0")}` as YearMonth).base;
    if (ref > 0) eligible = fromRatio(BigInt(eligible) * BigInt(base), BigInt(ref));
  }
  return cipGross(
    eligible,
    { numerator: rule.componentNum ?? 0, denominator: CIP_COMPONENT_DENOMINATOR },
    { numerator: instance?.multiplierNum ?? assumptions.cipMultiplierNum, denominator: CIP_MULTIPLIER_DENOMINATOR },
  );
}

interface Landing {
  rule: BonusRule;
  year: number;
  month: YearMonth;
  instance?: BonusInstance;
}

function landingsIn(rules: readonly BonusRule[], instances: readonly BonusInstance[], year: number): Landing[] {
  const out: Landing[] = [];
  for (const rule of rules) {
    const instance = instances.find((i) => i.ruleId === rule.id && i.year === year);
    if (rule.recurrence === "yearly") {
      out.push({ rule, year, month: `${String(year).padStart(4, "0")}-${String(rule.payMonth).padStart(2, "0")}` as YearMonth, instance });
    } else if (rule.onceOn && monthParts(rule.onceOn).year === year) {
      out.push({ rule, year, month: rule.onceOn, instance });
    }
  }
  return out.sort((a, b) => a.month.localeCompare(b.month) || (a.rule.payslipCutoff === b.rule.payslipCutoff ? a.rule.id.localeCompare(b.rule.id) : a.rule.payslipCutoff === "first" ? -1 : 1));
}

/**
 * Bonus payments landing in the given months. The ₱90,000 yearly tax-free cap is shared by the whole year's payments in pay-month
 * order (so a year is always worked out in full, even when only some of its months are asked for). Windfall tax uses the profile in force
 * in the payment's own month, so a raise raises the next 13th month, CIP and the tax on them.
 */
export function planBonuses(
  rules: readonly BonusRule[],
  instances: readonly BonusInstance[],
  salaryOf: (m: YearMonth) => MonthSalary,
  settings: PaySettings,
  assumptions: Assumptions,
  months: readonly YearMonth[],
): BonusPayment[] {
  const wanted = new Set(months);
  const years = [...new Set(months.map((m) => monthParts(m).year))].sort();
  const out: BonusPayment[] = [];
  for (const year of years) {
    const landings = landingsIn(rules.filter((r) => r.recurrence === "yearly" || r.onceOn), instances, year);
    const events: WindfallEvent[] = [];
    landings.forEach((l, i) => {
      const received = l.instance?.status === "received" && l.instance.grossActual != null;
      const gross = received ? (l.instance!.grossActual as Money) : grossFor(l.rule, year, l.instance, salaryOf, assumptions, l.month);
      const deMinimis = l.rule.kind === "thirteenth" ? ZERO : received ? (l.instance!.deMinimisActual ?? l.rule.deMinimis) : l.rule.deMinimis;
      events.push({
        id: `${String(i).padStart(3, "0")}:${l.rule.id}`,
        kind: l.rule.kind === "thirteenth" ? "thirteenth" : "bonus",
        cutoff: l.rule.payslipCutoff,
        payDate: `${l.month}-${l.rule.payslipCutoff === "first" ? "10" : "25"}`,
        gross,
        cipEligible: null,
        cipComponentNum: null,
        cipMultiplierNum: null,
        deMinimis,
      });
      if (!wanted.has(l.month)) return;
      const profile = profileFor(salaryOf(l.month), settings);
      const result = computeEvents(profile, events).at(-1)!;
      const net = received && l.instance!.netActual != null ? (l.instance!.netActual as Money) : result.net;
      out.push({
        ruleId: l.rule.id,
        name: l.rule.name,
        kind: l.rule.kind,
        month: l.month,
        cutoff: l.rule.payslipCutoff,
        gross: result.gross,
        deMinimis: result.deMinimis,
        exempt: result.exempt,
        net,
        tax: sub(result.gross, net),
        received: l.instance?.status === "received",
        splits: l.instance?.splits ?? l.rule.splits,
      });
    });
  }
  return out.sort((a, b) => a.month.localeCompare(b.month));
}

export interface PlacedSplit {
  split: BonusSplit;
  amount: Money;
}

/** Hand a payment's net to its splits in order; each is capped by what is left. Returns what is not placed. */
export function allocateSplits(net: Money, splits: readonly BonusSplit[]): { placed: PlacedSplit[]; unplaced: Money } {
  let left = net > 0 ? net : ZERO;
  const placed: PlacedSplit[] = [];
  for (const split of splits) {
    const wanted = split.mode === "percent" ? mulBp(net, split.pctBp ?? 0) : (split.amount ?? ZERO);
    const amount = min(wanted, left);
    placed.push({ split, amount });
    left = sub(left, amount);
  }
  return { placed, unplaced: left };
}

/** Net bonus money going straight into funds, by month and fund id. Gifts, purchases, debt and wants are spent on purpose and do not enter funds. */
export function fundCredits(payments: readonly BonusPayment[]): Map<YearMonth, Record<string, Money>> {
  const out = new Map<YearMonth, Record<string, Money>>();
  for (const p of payments) {
    for (const { split, amount } of allocateSplits(p.net, p.splits).placed) {
      if (split.targetKind !== "fund" || !split.targetId || amount === 0) continue;
      const row = out.get(p.month) ?? {};
      row[split.targetId] = ((row[split.targetId] ?? 0) + amount) as Money;
      out.set(p.month, row);
    }
  }
  return out;
}
