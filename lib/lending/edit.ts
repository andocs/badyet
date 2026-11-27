import type { SupabaseClient } from "@supabase/supabase-js";
import { ensureLendingCategory } from "@/lib/capture/transfer-category";
import { isoDate, type IsoDate } from "@/lib/domain/dates";
import { formatPesos, money } from "@/lib/domain/money";
import { shortDate } from "@/lib/now/format";
import { createLoan, recordPayback, resolveSource, type Env, type Result, type SourceInput } from "./write";

/**
 * Editing a loan from the Inbox. The money's transaction and the loan are kept in step: change one item and the loan follows.
 */

/** How an edited item should be filed. "none" = it is no longer part of a loan. */
export type EditLending =
  | { as: "loan"; borrower: string; dueOn: string; from: SourceInput }
  | { as: "payback"; loanId: string; nextDue?: string | null }
  | { as: "none" };

interface LoanRow { id: string; borrower: string; amount: number; lent_on: string; due_on: string }
interface EventRow { id: string; loan_id: string; amount: number; old_due: string | null; new_due: string | null }

export type LoanLink =
  /** The money you lent. `paid` = what has come back so far; `firstPaid` = the day of the first payback. */
  | { role: "lent"; loan: LoanRow; paid: number; firstPaid: string | null }
  /** A payback. `otherPaid` = what the loan's other paybacks add up to. */
  | { role: "payback"; loan: LoanRow; event: EventRow; otherPaid: number };

const LOAN = "id, borrower, amount, lent_on, due_on";

export async function findLoanLink(supabase: SupabaseClient, txnId: string): Promise<LoanLink | null> {
  const lent = await supabase.from("loans").select(LOAN).eq("txn_id", txnId).maybeSingle();
  if (lent.data) {
    const loan = lent.data as LoanRow;
    const events = await supabase.from("loan_events").select("amount, on_date").eq("loan_id", loan.id).eq("kind", "payment");
    const list = (events.data ?? []) as { amount: number; on_date: string }[];
    return { role: "lent", loan, paid: list.reduce((s, e) => s + e.amount, 0), firstPaid: list.map((e) => e.on_date).sort()[0] ?? null };
  }
  const back = await supabase.from("loan_events").select("id, loan_id, amount, old_due, new_due").eq("txn_id", txnId).maybeSingle();
  if (!back.data) return null;
  const event = back.data as EventRow;
  const loan = await supabase.from("loans").select(LOAN).eq("id", event.loan_id).maybeSingle();
  if (!loan.data) return null;
  const events = await supabase.from("loan_events").select("id, amount").eq("loan_id", event.loan_id).eq("kind", "payment");
  const otherPaid = ((events.data ?? []) as { id: string; amount: number }[]).filter((e) => e.id !== event.id).reduce((s, e) => s + e.amount, 0);
  return { role: "payback", loan: loan.data as LoanRow, event, otherPaid };
}

/** Whether the change keeps this item part of the same loan in the same way. */
export function keepsLink(link: LoanLink, lending: EditLending | undefined): boolean {
  if (!lending) return true;
  if (lending.as === "loan") return link.role === "lent";
  return lending.as === "payback" && link.role === "payback" && lending.loanId === link.loan.id;
}

const peso = (n: number) => formatPesos(money(n));
const FAILED = "Could not change that. Try again.";

export interface ItemChange {
  amount: number;
  direction: "in" | "out";
  /** The day, in Philippine time. */
  date: IsoDate;
}

/** Checks an edit of an item that stays in its loan, and returns what to write to the loan or payback. Writes nothing. */
export async function checkLinkedEdit(supabase: SupabaseClient, link: LoanLink, change: ItemChange, lending: EditLending | undefined): Promise<{ table: "loans" | "loan_events"; id: string; values: Record<string, unknown> } | { error: string }> {
  if (link.role === "payback") {
    const room = link.loan.amount - link.otherPaid;
    if (change.amount > room) return { error: `That is more than the ${peso(room)} this payback can be.` };
    return { table: "loan_events", id: link.event.id, values: { amount: change.amount, on_date: change.date } };
  }
  if (change.amount < link.paid) return { error: `${peso(link.paid)} has already been paid back, so the loan cannot be smaller than that.` };
  if (link.firstPaid && change.date > link.firstPaid) return { error: `It was first paid back on ${shortDate(isoDate(link.firstPaid))}, so it cannot be lent after that.` };
  const values: Record<string, unknown> = { amount: change.amount, lent_on: change.date };
  let due = link.loan.due_on;
  if (lending?.as === "loan") {
    const borrower = lending.borrower.trim().replace(/\s+/g, " ").slice(0, 80);
    if (!borrower) return { error: "Say who you are lending to." };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(lending.dueOn)) return { error: "Pick the day you expect to be paid back." };
    const from = await resolveSource(supabase, lending.from);
    if (!from) return { error: "Pick where the money comes from." };
    due = lending.dueOn;
    Object.assign(values, { borrower, due_on: due, from_kind: from.kind, from_ref: from.ref, from_name: from.name });
  }
  if (due < change.date) return { error: "The expected date is before the day you lent it." };
  return { table: "loans", id: link.loan.id, values };
}

/** Takes an item out of its loan, so it can be filed as something else. The transaction itself is left for the edit to file. */
export async function unlinkLoanItem(supabase: SupabaseClient, link: LoanLink): Promise<Result> {
  if (link.role === "lent") {
    if (link.paid > 0) return { error: "This loan already has paybacks. Remove the loan on the Lending page first." };
    const r = await supabase.from("loans").delete().eq("id", link.loan.id);
    return r.error ? { error: FAILED } : { ok: true };
  }
  const r = await supabase.from("loan_events").delete().eq("id", link.event.id);
  if (r.error) return { error: FAILED };
  // A part payment moved the expected date; undo that unless the date has changed again since.
  if (link.event.old_due && link.event.new_due === link.loan.due_on) await supabase.from("loans").update({ due_on: link.event.old_due }).eq("id", link.loan.id);
  return { ok: true };
}

/** Files an item that is not part of a loan yet as a loan or a payback. */
export async function linkLoanItem(supabase: SupabaseClient, txnId: string, lending: Exclude<EditLending, { as: "none" }>, note: string, env: Env): Promise<Result> {
  if (!(await ensureLendingCategory(supabase))) return { error: FAILED };
  return lending.as === "loan"
    ? createLoan(supabase, { txnId, borrower: lending.borrower, dueOn: lending.dueOn, from: lending.from, note }, env)
    : recordPayback(supabase, { loanId: lending.loanId, txnId, nextDue: lending.nextDue }, env);
}
