import type { SupabaseClient } from "@supabase/supabase-js";
import { makeDate, type IsoDate, type YearMonth } from "@/lib/domain/dates";
import { cutoffSettingsFromPaydays } from "@/lib/engine/months";
import type { BudgetLine, PayCutoff } from "@/lib/engine/types";
import { planFor, type PlanSpan } from "./plans";

/**
 * Reimbursements count only once the money has arrived. In this budget month, one whose cutoff has started is left out of what you have
 * until a matching deposit is confirmed or you mark it received. One whose cutoff is still ahead, and every later month, is expected
 * and counted, so the forecast keeps working.
 */
export type ReimbursementState = "received" | "waiting" | "expected";

export interface ReimbursementStatus {
  lineId: string;
  month: YearMonth;
  cutoff: PayCutoff;
  amount: number;
  state: ReimbursementState;
  /** How it came to be received: a deposit the app matched, or your own mark. */
  how: "deposit" | "marked" | null;
}

/** A confirmed income. */
export interface Deposit {
  id: string;
  /** Centavos. */
  amount: number;
}

export interface ReimbursementMark {
  lineId: string;
  cutoff: PayCutoff;
  received: boolean;
}

/** A deposit this close to the amount (one peso) is taken to be the reimbursement. */
const TOLERANCE = 100;

export function reimbursementStatuses(input: {
  lines: readonly BudgetLine[];
  plans: readonly PlanSpan[];
  /** This budget month and the cutoff you are in. */
  month: YearMonth;
  current: PayCutoff;
  /** Confirmed income since this budget month's first cutoff began, oldest first. */
  deposits: readonly Deposit[];
  /** Your marks for this month. */
  marks: readonly ReimbursementMark[];
}): ReimbursementStatus[] {
  const used = new Set<string>();
  const due = input.lines
    .filter((l) => l.reimburse && l.reimburse.amount > 0 && !l.isDraft)
    .filter((l) => (!l.startsOn || l.startsOn <= input.month) && (!l.endsOn || l.endsOn >= input.month))
    .filter((l) => (l.planId ?? null) === planFor(input.plans, input.month, l.reimburse!.cutoff))
    // The 1st cutoff's reimbursements claim deposits first.
    .sort((a, b) => a.reimburse!.cutoff.localeCompare(b.reimburse!.cutoff));
  return due.map((l) => {
    const cutoff = l.reimburse!.cutoff;
    const amount = l.reimburse!.amount;
    const base = { lineId: l.id, month: input.month, cutoff, amount };
    const mark = input.marks.find((m) => m.lineId === l.id && m.cutoff === cutoff);
    if (mark) return { ...base, state: mark.received ? "received" : "waiting", how: mark.received ? "marked" : null };
    // Each deposit pays back one line only.
    const deposit = input.deposits.find((d) => !used.has(d.id) && Math.abs(d.amount - amount) <= TOLERANCE);
    if (deposit) {
      used.add(deposit.id);
      return { ...base, state: "received", how: "deposit" };
    }
    const ahead = cutoff === "second" && input.current === "first";
    return { ...base, state: ahead ? "expected" : "waiting", how: null };
  });
}

/** The lines whose reimbursement is left out, by month, as the projection takes them. */
export function awaitedByMonth(statuses: readonly ReimbursementStatus[]): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const s of statuses) if (s.state === "waiting") (out[s.month] ??= []).push(s.lineId);
  return out;
}

export async function loadReimbursements(
  supabase: SupabaseClient,
  input: { lines: readonly BudgetLine[]; plans: readonly PlanSpan[]; month: YearMonth; current: PayCutoff; paydays: { first: number; second: number } },
): Promise<ReimbursementStatus[]> {
  if (!input.lines.some((l) => l.reimburse && l.reimburse.amount > 0)) return [];
  const start: IsoDate = makeDate(input.month, cutoffSettingsFromPaydays(input.paydays.first, input.paydays.second).firstStartDay);
  const [incomes, marks] = await Promise.all([
    supabase.from("transactions").select("id, amount").eq("kind", "income").eq("status", "confirmed").gte("occurred_at", `${start}T00:00:00+08:00`).order("occurred_at"),
    // A database without the marks update has none.
    supabase.from("reimbursement_marks").select("budget_line_id, cutoff, received").eq("month", `${input.month}-01`),
  ]);
  return reimbursementStatuses({
    ...input,
    deposits: ((incomes.data ?? []) as Deposit[]),
    marks: marks.error ? [] : ((marks.data ?? []) as { budget_line_id: string; cutoff: PayCutoff; received: boolean }[]).map((m) => ({ lineId: m.budget_line_id, cutoff: m.cutoff, received: m.received })),
  });
}

export type Result = { ok: true } | { error: string };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** "Mark received" (true) or "Not yet" (false). The web and the phone share this. */
export async function setReimbursementMark(supabase: SupabaseClient, input: unknown): Promise<Result> {
  const i = input as { lineId?: unknown; month?: unknown; cutoff?: unknown; received?: unknown } | null;
  if (!i || typeof i.lineId !== "string" || !UUID.test(i.lineId) || typeof i.month !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(i.month) || (i.cutoff !== "first" && i.cutoff !== "second") || typeof i.received !== "boolean") {
    return { error: "That reimbursement was not found." };
  }
  const { error } = await supabase
    .from("reimbursement_marks")
    .upsert({ budget_line_id: i.lineId, month: `${i.month}-01`, cutoff: i.cutoff, received: i.received }, { onConflict: "user_id,budget_line_id,month,cutoff" });
  if (!error) return { ok: true };
  return { error: error.code === "42P01" || error.code === "PGRST205" ? "Apply the reimbursement database update first, then try again." : "Could not save that. Try again." };
}
