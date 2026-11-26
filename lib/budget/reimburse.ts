import type { SupabaseClient } from "@supabase/supabase-js";
import { addMonths, makeDate, type IsoDate, type YearMonth } from "@/lib/domain/dates";
import { money, type Money } from "@/lib/domain/money";
import { cutoffSettingsFromPaydays } from "@/lib/engine/months";
import type { BudgetLine, PayCutoff } from "@/lib/engine/types";
import { planFor, type PlanSpan } from "./plans";

/**
 * Reimbursements count only once the money has arrived. In this budget month, one whose cutoff has started is left out of what you have
 * until a matching deposit is confirmed or you mark it received. One whose cutoff is still ahead, and every later month, is expected
 * and counted, so the forecast keeps working. A postponed one is left out and added to the next month's reimbursement day.
 */
export type ReimbursementState = "received" | "waiting" | "expected" | "postponed";

export interface ReimbursementStatus {
  lineId: string;
  month: YearMonth;
  cutoff: PayCutoff;
  /** What is due this time: the line's own amount plus anything postponed to it. */
  amount: number;
  /** The part of `amount` postponed from earlier months. */
  carried: number;
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
  /** The month the mark is for; left out = the month being worked. */
  month?: YearMonth;
  cutoff: PayCutoff;
  received: boolean;
  postponed?: boolean;
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
  /** Your marks for this month, and earlier ones so postponed amounts carry over. */
  marks: readonly ReimbursementMark[];
}): ReimbursementStatus[] {
  const used = new Set<string>();
  const markOf = (lineId: string, cutoff: PayCutoff, month: YearMonth) => input.marks.find((m) => m.lineId === lineId && m.cutoff === cutoff && (m.month ?? input.month) === month);
  const due = input.lines
    .filter((l) => l.reimburse && l.reimburse.amount > 0 && !l.isDraft)
    .map((l) => {
      const cutoff = l.reimburse!.cutoff;
      // Months in a row, just before this one, that postponed it: their amounts are all due now.
      let times = 0;
      for (let month = addMonths(input.month, -1); markOf(l.id, cutoff, month)?.postponed; month = addMonths(month, -1)) times += 1;
      const own = dueIn(l, input.plans, input.month) ? l.reimburse!.amount : 0;
      const carried = times * l.reimburse!.amount;
      return { lineId: l.id, cutoff, amount: own + carried, carried };
    })
    .filter((x) => x.amount > 0)
    // The 1st cutoff's reimbursements claim deposits first.
    .sort((a, b) => a.cutoff.localeCompare(b.cutoff));
  return due.map(({ lineId, cutoff, amount, carried }) => {
    const base = { lineId, month: input.month, cutoff, amount, carried };
    const mark = markOf(lineId, cutoff, input.month);
    if (mark?.postponed) return { ...base, state: "postponed", how: null };
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

/** Whether a line pays its own reimbursement in a month: it is on, and belongs to the budget in force for that cutoff. */
const dueIn = (l: BudgetLine, plans: readonly PlanSpan[], month: YearMonth): boolean =>
  !l.isDraft && (!l.startsOn || l.startsOn <= month) && (!l.endsOn || l.endsOn >= month) && (l.planId ?? null) === planFor(plans, month, l.reimburse!.cutoff);

/** What counts as paid back, by month and line, where it differs from the line's own setting. The projection takes it as given. */
export type ReimbursementOverrides = Record<string, Record<string, { cutoff: PayCutoff; amount: Money }>>;

/**
 * This month: nothing while waiting or postponed, and the whole amount due (with anything carried) once received or while expected.
 * A postponed amount is added to next month's reimbursement day, on top of that month's own.
 */
export function reimbursementOverrides(statuses: readonly ReimbursementStatus[], lines: readonly BudgetLine[], plans: readonly PlanSpan[]): ReimbursementOverrides {
  const out: ReimbursementOverrides = {};
  const set = (month: string, lineId: string, cutoff: PayCutoff, amount: number) => ((out[month] ??= {})[lineId] = { cutoff, amount: money(amount) });
  for (const s of statuses) {
    set(s.month, s.lineId, s.cutoff, s.state === "received" || s.state === "expected" ? s.amount : 0);
    if (s.state !== "postponed") continue;
    const line = lines.find((l) => l.id === s.lineId);
    const next = addMonths(s.month, 1);
    const own = line?.reimburse && dueIn(line, plans, next) ? line.reimburse.amount : 0;
    set(next, s.lineId, s.cutoff, own + s.amount);
  }
  return out;
}

interface MarkRow { budget_line_id: string; month: string; cutoff: PayCutoff; received: boolean; postponed?: boolean }

/** Marks up to this month (the last two years). A database without the postponed update still gives the received marks. */
async function loadMarks(supabase: SupabaseClient, month: YearMonth): Promise<MarkRow[]> {
  const from = `${addMonths(month, -24)}-01`;
  const to = `${month}-01`;
  const full = await supabase.from("reimbursement_marks").select("budget_line_id, month, cutoff, received, postponed").gte("month", from).lte("month", to);
  if (!full.error) return (full.data ?? []) as MarkRow[];
  const old = await supabase.from("reimbursement_marks").select("budget_line_id, month, cutoff, received").gte("month", from).lte("month", to);
  return old.error ? [] : ((old.data ?? []) as MarkRow[]);
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
    loadMarks(supabase, input.month),
  ]);
  return reimbursementStatuses({
    ...input,
    deposits: ((incomes.data ?? []) as Deposit[]),
    marks: marks.map((m) => ({ lineId: m.budget_line_id, month: m.month.slice(0, 7) as YearMonth, cutoff: m.cutoff, received: m.received, postponed: m.postponed ?? false })),
  });
}

export type Result = { ok: true } | { error: string };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** "Mark received", "Postponed", or back to waiting. The web and the phone share this. */
export async function setReimbursementMark(supabase: SupabaseClient, input: unknown): Promise<Result> {
  const i = input as { lineId?: unknown; month?: unknown; cutoff?: unknown; received?: unknown; postponed?: unknown } | null;
  if (!i || typeof i.lineId !== "string" || !UUID.test(i.lineId) || typeof i.month !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(i.month) || (i.cutoff !== "first" && i.cutoff !== "second") || typeof i.received !== "boolean") {
    return { error: "That reimbursement was not found." };
  }
  const postponed = i.postponed === true;
  if (postponed && i.received) return { error: "It is either received or postponed." };
  const row = { budget_line_id: i.lineId, month: `${i.month}-01`, cutoff: i.cutoff, received: i.received };
  const onConflict = { onConflict: "user_id,budget_line_id,month,cutoff" };
  let { error } = await supabase.from("reimbursement_marks").upsert({ ...row, postponed }, onConflict);
  const noColumn = (code: string | undefined) => code === "42703" || code === "PGRST204";
  if (error && noColumn(error.code)) {
    if (postponed) return { error: "Apply the postponed reimbursement database update first, then try again." };
    ({ error } = await supabase.from("reimbursement_marks").upsert(row, onConflict));
  }
  if (!error) return { ok: true };
  return { error: error.code === "42P01" || error.code === "PGRST205" ? "Apply the reimbursement database update first, then try again." : "Could not save that. Try again." };
}
