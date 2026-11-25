import type { YearMonth } from "@/lib/domain/dates";
import type { PayCutoff } from "./types";

/** A cutoff in time: a month and which half of it. */
export interface CutoffRef {
  month: YearMonth;
  cutoff: PayCutoff;
}

/** A budget plan: its own full set of lines, in force from one cutoff to another (both included). */
export interface PlanSpan {
  id: string;
  name: string;
  from: CutoffRef;
  to: CutoffRef;
}

/** Cutoffs counted from year 0, so two cutoffs compare as numbers. */
export const cutoffIndex = (r: CutoffRef): number => Number(r.month.slice(0, 4)) * 24 + (Number(r.month.slice(5, 7)) - 1) * 2 + (r.cutoff === "second" ? 1 : 0);

/** The plan in force for a month's cutoff, or null for the normal budget. */
export function planFor(plans: readonly PlanSpan[], month: YearMonth, cutoff: PayCutoff): string | null {
  const at = cutoffIndex({ month, cutoff });
  return plans.find((p) => cutoffIndex(p.from) <= at && at <= cutoffIndex(p.to))?.id ?? null;
}
