import type { YearMonth } from "@/lib/domain/dates";
import type { PayCutoff } from "@/lib/engine/types";

export { cutoffIndex, planFor, type CutoffRef, type PlanSpan } from "@/lib/engine/plans";
import { cutoffIndex, type CutoffRef, type PlanSpan } from "@/lib/engine/plans";

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const isCutoff = (v: unknown): v is PayCutoff => v === "first" || v === "second";

export type Checked<T> = { ok: true; value: T } | { ok: false; error: string };

/** Checks a plan's name and range, and that it does not overlap another plan (other than itself when editing). */
export function validatePlan(input: { id?: string | null; name: unknown; from: { month: unknown; cutoff: unknown }; to: { month: unknown; cutoff: unknown } }, others: readonly PlanSpan[]): Checked<Omit<PlanSpan, "id">> {
  const name = typeof input.name === "string" ? input.name.trim().replace(/\s+/g, " ") : "";
  if (name.length < 1 || name.length > 40) return { ok: false, error: "Give the plan a name (up to 40 characters)." };
  if (typeof input.from.month !== "string" || !MONTH.test(input.from.month) || !isCutoff(input.from.cutoff)) return { ok: false, error: "Pick the cutoff the plan starts on." };
  if (typeof input.to.month !== "string" || !MONTH.test(input.to.month) || !isCutoff(input.to.cutoff)) return { ok: false, error: "Pick the cutoff the plan ends on." };
  const from: CutoffRef = { month: input.from.month as YearMonth, cutoff: input.from.cutoff };
  const to: CutoffRef = { month: input.to.month as YearMonth, cutoff: input.to.cutoff };
  if (cutoffIndex(from) > cutoffIndex(to)) return { ok: false, error: "The plan has to end on or after the cutoff it starts on." };
  const clash = others.find((p) => p.id !== input.id && cutoffIndex(p.from) <= cutoffIndex(to) && cutoffIndex(from) <= cutoffIndex(p.to));
  if (clash) return { ok: false, error: `That overlaps "${clash.name}". Plans cannot share a cutoff.` };
  return { ok: true, value: { name, from, to } };
}

/** "Sep 2026 1st cutoff" */
export function cutoffRefLabel(r: CutoffRef): string {
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${MON[Number(r.month.slice(5, 7)) - 1]} ${r.month.slice(0, 4)} ${r.cutoff === "first" ? "1st" : "2nd"} cutoff`;
}

/** Plan rows from the database (dates are the first of the month). */
export function plansFromRows(rows: readonly { id: string; name: string; start_month: string; start_cutoff: string; end_month: string; end_cutoff: string }[]): PlanSpan[] {
  return rows
    .filter((r) => isCutoff(r.start_cutoff) && isCutoff(r.end_cutoff))
    .map((r) => ({ id: r.id, name: r.name, from: { month: r.start_month.slice(0, 7) as YearMonth, cutoff: r.start_cutoff as PayCutoff }, to: { month: r.end_month.slice(0, 7) as YearMonth, cutoff: r.end_cutoff as PayCutoff } }))
    .sort((a, b) => cutoffIndex(a.from) - cutoffIndex(b.from));
}
