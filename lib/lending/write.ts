import type { SupabaseClient } from "@supabase/supabase-js";
import { ensureLendingCategory, ensureTransferCategory, isBuiltInCategory } from "@/lib/capture/transfer-category";
import { isoDate, type IsoDate } from "@/lib/domain/dates";
import { formatPesos, money, parsePesos } from "@/lib/domain/money";
import { manilaDate } from "@/lib/now/summary";
import type { LoanSource, SourceKind } from "./model";

/** Every write for lending, shared by the web actions and the phone. Row-level security keeps each query to the signed-in user's rows. */
export type Result = { ok: true } | { error: string };

export interface Env {
  /** Today in Philippine time. */
  today: IsoDate;
  /** A new row id (the phone and the web make these differently). */
  newId: () => string;
}

export interface SourceInput {
  kind: SourceKind;
  ref: string | null;
}

export interface LendInput {
  borrower: string;
  /** YYYY-MM-DD. */
  dueOn: string;
  from: SourceInput;
  note?: string;
  /** Money out that is already recorded (an Inbox item). */
  txnId?: string | null;
  /** Otherwise: the amount as typed, the account it left from (null = cash that no account tracks) and the day. */
  manual?: { amount: string; accountId: string | null; date: string };
}

export interface PaybackInput {
  loanId: string;
  /** Money in that is already recorded: its amount is the amount received. */
  txnId?: string | null;
  /** Otherwise: the amount as typed, and the account it arrived in (null = cash that no account tracks). */
  manual?: { amount: string; accountId: string | null };
  /** When something is still owed after this: when you expect the rest. */
  nextDue?: string | null;
}

export type OtherWhat = "loan" | "spending" | "none";

/** A transfer to someone else's account: whose it is, and what the money is. */
export interface OthersInput {
  owner: string;
  what: OtherWhat;
  /** Loan: when you expect it back. */
  dueOn?: string;
  /** Spending: the category it counts against. */
  categoryId?: string | null;
  /** Loan or not spending: what it comes out of. */
  from?: SourceInput;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX = 100_000_000_000;
const clean = (s: string | undefined, max: number) => (s ?? "").trim().replace(/\s+/g, " ").slice(0, max);

function dateOf(text: string | null | undefined): IsoDate | null {
  try {
    return text ? isoDate(text) : null;
  } catch {
    return null;
  }
}

function pesos(text: string): number | null {
  const n = parsePesos(text.trim());
  return n === undefined || n <= 0 || n > MAX ? null : n;
}

/** The time to give a transaction dated by day: now when it is today, else midday. */
const stamp = (date: IsoDate, today: IsoDate) => (date === today ? new Date().toISOString() : new Date(`${date}T12:00:00+08:00`).toISOString());

/** Checks a chosen source and looks up its name, which is saved with the loan. */
export async function resolveSource(supabase: SupabaseClient, input: SourceInput): Promise<LoanSource | null> {
  if (input.kind === "none") return { kind: "none", ref: null, name: null };
  if (input.kind === "wants") return { kind: "wants", ref: null, name: "Wants" };
  const ref = input.ref ?? "";
  if (input.kind === "line" || input.kind === "fund") {
    if (!UUID.test(ref)) return null;
    const r = await supabase.from(input.kind === "line" ? "budget_lines_v2" : "funds").select("name").eq("id", ref).maybeSingle();
    return r.data ? { kind: input.kind, ref, name: (r.data.name as string).slice(0, 80) } : null;
  }
  if (input.kind === "bonus") {
    const [ruleId, year] = ref.split("|");
    if (!ruleId || !UUID.test(ruleId) || !/^\d{4}$/.test(year ?? "")) return null;
    const r = await supabase.from("bonus_rules").select("name").eq("id", ruleId).maybeSingle();
    return r.data ? { kind: "bonus", ref, name: `${r.data.name as string} ${year}`.slice(0, 80) } : null;
  }
  return null;
}

/** true when a transaction already belongs to a loan, as the money lent or as a payback. */
export async function isLoanTxn(supabase: SupabaseClient, txnId: string): Promise<boolean> {
  const [a, b] = await Promise.all([
    supabase.from("loans").select("id").eq("txn_id", txnId).limit(1),
    supabase.from("loan_events").select("id").eq("txn_id", txnId).limit(1),
  ]);
  return (a.data?.length ?? 0) > 0 || (b.data?.length ?? 0) > 0;
}

interface TxnDb { id: string; account_id: string; occurred_at: string; amount: number; status: string; transfer_peer_id: string | null }

async function freeTxn(supabase: SupabaseClient, id: string, direction: "in" | "out"): Promise<TxnDb | { error: string }> {
  if (!UUID.test(id)) return { error: "That transaction was not found." };
  const r = await supabase.from("transactions").select("id, account_id, occurred_at, amount, status, transfer_peer_id").eq("id", id).maybeSingle();
  const t = r.data as TxnDb | null;
  if (!t || t.status === "ignored" || (direction === "out" ? t.amount >= 0 : t.amount <= 0)) return { error: "That transaction was not found." };
  if (t.transfer_peer_id) return { error: "That one is a move between your own accounts." };
  if (await isLoanTxn(supabase, id)) return { error: "That one is already part of a loan." };
  return t;
}

/** Files an existing transaction under Lending: a transfer, so it is neither spending nor income. */
async function fileAsLending(supabase: SupabaseClient, id: string, categoryId: string): Promise<boolean> {
  const r = await supabase
    .from("transactions")
    .update({ kind: "transfer", category_id: categoryId, status: "confirmed", confirmed_at: new Date().toISOString(), budget_line_id: null, from_kind: null, from_ref: null, from_name: null })
    .eq("id", id);
  return !r.error;
}

const FAILED = "Could not save that. Try again.";
const NEEDS_UPDATE = "Lending needs the latest database update (the rev-60 migration).";

export async function createLoan(supabase: SupabaseClient, input: LendInput, env: Env): Promise<Result> {
  const borrower = clean(input.borrower, 80);
  if (!borrower) return { error: "Say who you are lending to." };
  const dueOn = dateOf(input.dueOn);
  if (!dueOn) return { error: "Pick the day you expect to be paid back." };
  const from = await resolveSource(supabase, input.from);
  if (!from) return { error: "Pick where the money comes from." };
  const probe = await supabase.from("loans").select("id").limit(1);
  if (probe.error) return { error: NEEDS_UPDATE };

  let amount: number;
  let lentOn: IsoDate;
  let accountId: string | null;
  let source: TxnDb | null = null;
  if (input.txnId) {
    const t = await freeTxn(supabase, input.txnId, "out");
    if ("error" in t) return t;
    source = t;
    amount = -t.amount;
    lentOn = manilaDate(t.occurred_at);
    accountId = t.account_id;
  } else {
    const n = pesos(input.manual?.amount ?? "");
    if (n === null) return { error: "Enter an amount above zero, like 500 or 1,250.50." };
    const day = dateOf(input.manual?.date) ?? env.today;
    if (day > env.today) return { error: "The day you lent it cannot be in the future." };
    accountId = input.manual?.accountId ?? null;
    if (accountId) {
      const a = UUID.test(accountId) ? await supabase.from("accounts").select("id").eq("id", accountId).is("archived_at", null).maybeSingle() : null;
      if (!a?.data) return { error: "That account was not found." };
    }
    amount = n;
    lentOn = day;
  }
  if (dueOn < lentOn) return { error: "The expected date is before the day you lent it." };

  const category = await ensureLendingCategory(supabase);
  if (!category) return { error: FAILED };
  let txnId = source?.id ?? null;
  const added = !source && accountId !== null;
  if (added) {
    txnId = env.newId();
    const ins = await supabase.from("transactions").insert({ id: txnId, account_id: accountId, occurred_at: stamp(lentOn, env.today), amount: -amount, merchant: borrower, kind: "transfer", category_id: category, source: "manual", status: "confirmed", confirmed_at: new Date().toISOString() });
    if (ins.error) return { error: FAILED };
  }
  const loan = await supabase.from("loans").insert({ id: env.newId(), borrower, amount, lent_on: lentOn, due_on: dueOn, from_kind: from.kind, from_ref: from.ref, from_name: from.name, account_id: accountId, txn_id: txnId, txn_added: added, note: clean(input.note, 200) || null });
  if (loan.error) {
    if (added) await supabase.from("transactions").delete().eq("id", txnId!);
    return { error: FAILED };
  }
  if (source && !(await fileAsLending(supabase, source.id, category))) return { error: "The loan was saved, but the transaction was not updated." };
  return { ok: true };
}

interface LoanRow { id: string; borrower: string; amount: number; lent_on: string; due_on: string }

async function openLoan(supabase: SupabaseClient, id: string): Promise<(LoanRow & { owed: number }) | { error: string }> {
  if (!UUID.test(id)) return { error: "That loan was not found." };
  const [loan, events] = await Promise.all([
    supabase.from("loans").select("id, borrower, amount, lent_on, due_on").eq("id", id).maybeSingle(),
    supabase.from("loan_events").select("amount").eq("loan_id", id).eq("kind", "payment"),
  ]);
  if (!loan.data || events.error) return { error: "That loan was not found." };
  const row = loan.data as LoanRow;
  const owed = row.amount - ((events.data ?? []) as { amount: number }[]).reduce((s, e) => s + e.amount, 0);
  return owed > 0 ? { ...row, owed } : { error: "That loan is already paid." };
}

/** Records money paid back, in full or in part. A part needs the day you expect the rest. */
export async function recordPayback(supabase: SupabaseClient, input: PaybackInput, env: Env): Promise<Result> {
  const loan = await openLoan(supabase, input.loanId);
  if ("error" in loan) return loan;

  let amount: number;
  let on: IsoDate = env.today;
  let source: TxnDb | null = null;
  const accountId = input.manual?.accountId ?? null;
  if (input.txnId) {
    const t = await freeTxn(supabase, input.txnId, "in");
    if ("error" in t) return t;
    source = t;
    amount = t.amount;
    on = manilaDate(t.occurred_at);
  } else {
    const n = pesos(input.manual?.amount ?? "");
    if (n === null) return { error: "Enter the amount received, like 500 or 1,250.50." };
    amount = n;
    if (accountId) {
      const a = UUID.test(accountId) ? await supabase.from("accounts").select("id").eq("id", accountId).is("archived_at", null).maybeSingle() : null;
      if (!a?.data) return { error: "That account was not found." };
    }
  }
  if (amount > loan.owed) return { error: `That is more than the ${formatPesos(money(loan.owed))} still owed.` };
  const left = loan.owed - amount;
  const nextDue = left > 0 ? dateOf(input.nextDue) : null;
  if (left > 0 && (!nextDue || nextDue < env.today)) return { error: `Pick when the other ${formatPesos(money(left))} will come (today or later).` };

  const category = await ensureLendingCategory(supabase);
  if (!category) return { error: FAILED };
  let txnId = source?.id ?? null;
  const added = !source && accountId !== null;
  if (added) {
    txnId = env.newId();
    const ins = await supabase.from("transactions").insert({ id: txnId, account_id: accountId, occurred_at: new Date().toISOString(), amount, merchant: loan.borrower, kind: "transfer", category_id: category, source: "manual", status: "confirmed", confirmed_at: new Date().toISOString() });
    if (ins.error) return { error: FAILED };
  }
  const event = await supabase.from("loan_events").insert({ id: env.newId(), loan_id: loan.id, kind: "payment", on_date: on, amount, old_due: nextDue ? loan.due_on : null, new_due: nextDue, txn_id: txnId, txn_added: added });
  if (event.error) {
    if (added) await supabase.from("transactions").delete().eq("id", txnId!);
    return { error: FAILED };
  }
  if (source && !(await fileAsLending(supabase, source.id, category))) return { error: "The payback was saved, but the transaction was not updated." };
  if (nextDue) {
    const up = await supabase.from("loans").update({ due_on: nextDue }).eq("id", loan.id);
    if (up.error) return { error: "The payback was saved, but the new date was not." };
  }
  return { ok: true };
}

/** Moves the expected date. A new date after today is required. */
export async function postponeLoan(supabase: SupabaseClient, input: { loanId: string; newDue: string; note?: string }, env: Env): Promise<Result> {
  const loan = await openLoan(supabase, input.loanId);
  if ("error" in loan) return loan;
  const newDue = dateOf(input.newDue);
  if (!newDue || newDue <= env.today) return { error: "Pick a new date after today." };
  const event = await supabase.from("loan_events").insert({ id: env.newId(), loan_id: loan.id, kind: "postpone", on_date: env.today, old_due: loan.due_on, new_due: newDue, note: clean(input.note, 200) || null });
  if (event.error) return { error: FAILED };
  const up = await supabase.from("loans").update({ due_on: newDue }).eq("id", loan.id);
  return up.error ? { error: FAILED } : { ok: true };
}

/**
 * Removes a loan entered by mistake. Transactions the app added for it are deleted; ones that came from your bank go back to the
 * Inbox to be filed again.
 */
export async function removeLoan(supabase: SupabaseClient, loanId: string): Promise<Result> {
  if (!UUID.test(loanId)) return { error: "That loan was not found." };
  const [loan, events] = await Promise.all([
    supabase.from("loans").select("txn_id, txn_added").eq("id", loanId).maybeSingle(),
    supabase.from("loan_events").select("txn_id, txn_added").eq("loan_id", loanId),
  ]);
  if (!loan.data || events.error) return { error: "That loan was not found." };
  const linked = [loan.data, ...(events.data ?? [])] as { txn_id: string | null; txn_added: boolean }[];
  const del = await supabase.from("loans").delete().eq("id", loanId);
  if (del.error) return { error: FAILED };
  for (const l of linked) {
    if (!l.txn_id) continue;
    if (l.txn_added) await supabase.from("transactions").delete().eq("id", l.txn_id);
    else {
      const t = await supabase.from("transactions").select("amount").eq("id", l.txn_id).maybeSingle();
      if (t.data) await supabase.from("transactions").update({ status: "pending", confirmed_at: null, category_id: null, kind: Number(t.data.amount) < 0 ? "expense" : "income" }).eq("id", l.txn_id);
    }
  }
  return { ok: true };
}

/** Confirms money sent to someone else's account, as a loan, as spending, or as neither. */
export async function confirmOthers(supabase: SupabaseClient, input: { txnId: string; note?: string } & OthersInput, env: Env): Promise<Result> {
  const owner = clean(input.owner, 80);
  if (!owner) return { error: "Say whose account it is." };
  const t = await freeTxn(supabase, input.txnId, "out");
  if ("error" in t) return t;
  const note = clean(input.note, 200) || null;
  const base = { other_owner: owner, note, status: "confirmed", confirmed_at: new Date().toISOString() };

  if (input.what === "loan") {
    const made = await createLoan(supabase, { borrower: owner, dueOn: input.dueOn ?? "", from: input.from ?? { kind: "none", ref: null }, note: note ?? undefined, txnId: t.id }, env);
    if ("error" in made) return made;
    const up = await supabase.from("transactions").update({ other_owner: owner, note }).eq("id", t.id);
    return up.error ? { error: "The loan was saved, but the note on the account was not." } : { ok: true };
  }
  if (input.what === "spending") {
    const id = input.categoryId ?? "";
    const cat = UUID.test(id) ? await supabase.from("categories").select("name").eq("id", id).is("archived_at", null).maybeSingle() : null;
    if (!cat?.data || isBuiltInCategory(cat.data.name as string)) return { error: "Pick the category it counts against." };
    const up = await supabase.from("transactions").update({ ...base, kind: "expense", category_id: id, from_kind: null, from_ref: null, from_name: null }).eq("id", t.id);
    return up.error ? { error: NEEDS_UPDATE } : { ok: true };
  }
  if (input.what !== "none") return { error: "Say what the money is." };
  const from = await resolveSource(supabase, input.from ?? { kind: "none", ref: null });
  if (!from) return { error: "Pick where the money comes from." };
  const category = await ensureTransferCategory(supabase);
  const taken = from.kind === "none" ? { from_kind: null, from_ref: null, from_name: null } : { from_kind: from.kind, from_ref: from.ref, from_name: from.name };
  const up = await supabase.from("transactions").update({ ...base, ...taken, kind: "transfer", category_id: category }).eq("id", t.id);
  return up.error ? { error: NEEDS_UPDATE } : { ok: true };
}
