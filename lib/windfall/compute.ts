import type { Cutoff } from "@/lib/budget/validate";
import { netCutoff, type PayItem } from "@/lib/domain/pay";
import { divRound, min, money, sub, ZERO, type Money } from "@/lib/domain/money";
import { cipGross } from "@/lib/domain/windfall";
import { buildItems, type PayProfile } from "@/lib/pay/compute";
import { TAX_ROWS } from "@/lib/pay/tax-table";

export type WindfallKind = "thirteenth" | "cip" | "bonus";

// Yearly cap on the tax-free part of 13th month, CIP and other bonuses, in centavos (90,000 pesos).
// Matches published 2026 guides (checked Nov 2026; the old app marked it "CONFIRM"). Not checked against a BIR issuance.
export const EXEMPTION_CAP: Money = money(9_000_000);
export const CIP_COMPONENT_DENOMINATOR = 10_000_000; // 13.81505% is stored as 1,381,505
export const CIP_MULTIPLIER_DENOMINATOR = 100; // 1.25 is stored as 125

export interface WindfallEvent {
  id: string;
  kind: WindfallKind;
  cutoff: Cutoff;
  payDate: string; // YYYY-MM-DD
  gross: Money | null;
  cipEligible: Money | null;
  cipComponentNum: number | null;
  cipMultiplierNum: number | null;
}

export interface WindfallResult {
  id: string;
  gross: Money;
  /** The part treated as tax-free under the yearly cap. */
  exempt: Money;
  /** Estimated amount that reaches you: pay with the windfall minus regular pay, same cutoff. */
  net: Money;
}

export function grossOf(profile: PayProfile, e: WindfallEvent): Money {
  if (e.kind === "cip") {
    if (e.cipEligible === null || e.cipComponentNum === null || e.cipMultiplierNum === null) return ZERO;
    return cipGross(
      e.cipEligible,
      { numerator: e.cipComponentNum, denominator: CIP_COMPONENT_DENOMINATOR },
      { numerator: e.cipMultiplierNum, denominator: CIP_MULTIPLIER_DENOMINATOR },
    );
  }
  if (e.kind === "thirteenth") return e.gross ?? divRound(profile.annualBase, 12); // one month of basic pay
  return e.gross ?? ZERO;
}

// Net of each event, in the order given. The tax-free cap is shared by all events in the same
// calendar year, used up in pay-date order. Tax overrides on regular pay are ignored here.
export function computeEvents(profile: PayProfile, events: readonly WindfallEvent[]): WindfallResult[] {
  const { items: base } = buildItems(profile);
  const used = new Map<string, Money>();
  const byDate = [...events].sort((a, b) => a.payDate.localeCompare(b.payDate) || a.id.localeCompare(b.id));
  const results = new Map<string, WindfallResult>();

  for (const e of byDate) {
    const year = e.payDate.slice(0, 4);
    const gross = grossOf(profile, e);
    const room = sub(EXEMPTION_CAP, used.get(year) ?? ZERO);
    const exempt = min(gross, room > 0 ? room : ZERO);
    used.set(year, money((used.get(year) ?? ZERO) + exempt));

    const extra: PayItem[] = [
      { name: "Windfall (tax-free part)", kind: "earning_nontaxable", amount: exempt, scope: e.cutoff },
      { name: "Windfall (taxable part)", kind: "earning_taxable", amount: sub(gross, exempt), scope: e.cutoff },
    ];
    const regular = netCutoff(base, e.cutoff, TAX_ROWS).netBeforePlan;
    const withWindfall = netCutoff([...base, ...extra], e.cutoff, TAX_ROWS).netBeforePlan;
    results.set(e.id, { id: e.id, gross, exempt, net: sub(withWindfall, regular) });
  }
  return events.map((e) => results.get(e.id)!);
}

export function remaining(net: Money, allocated: Money): Money {
  return sub(net, allocated);
}
