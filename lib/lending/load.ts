import type { SupabaseClient } from "@supabase/supabase-js";
import { isoDate } from "@/lib/domain/dates";
import { money } from "@/lib/domain/money";
import { manilaDate } from "@/lib/now/summary";
import type { Loan, LoanEvent, LoanSource, Outside, SourceKind } from "./model";

export interface Lending {
  /** false when the database does not have the lending tables yet. */
  ready: boolean;
  loans: Loan[];
  outside: Outside[];
}

interface LoanDb {
  id: string; borrower: string; amount: number; lent_on: string; due_on: string; from_kind: SourceKind; from_ref: string | null;
  from_name: string | null; account_id: string | null; note: string | null; txn_id: string | null;
}
interface EventDb {
  id: string; loan_id: string; kind: "payment" | "postpone"; on_date: string; amount: number | null; old_due: string | null;
  new_due: string | null; note: string | null; txn_id: string | null;
}
const rows = <T,>(r: { data: unknown }): T[] => (r.data ?? []) as T[];

/** Every loan with its history, and the transfers to other people's accounts that were taken from somewhere. */
export async function loadLending(supabase: SupabaseClient): Promise<Lending> {
  const [loanRes, eventRes, outRes, acctRes] = await Promise.all([
    supabase.from("loans").select("id, borrower, amount, lent_on, due_on, from_kind, from_ref, from_name, account_id, note, txn_id").order("lent_on"),
    supabase.from("loan_events").select("id, loan_id, kind, on_date, amount, old_due, new_due, note, txn_id").order("created_at"),
    supabase.from("transactions").select("id, account_id, occurred_at, amount, other_owner, from_kind, from_ref, from_name").eq("status", "confirmed").not("from_kind", "is", null),
    supabase.from("accounts").select("id, name"),
  ]);
  if (loanRes.error || eventRes.error) return { ready: false, loans: [], outside: [] };
  const accountName = new Map(rows<{ id: string; name: string }>(acctRes).map((a) => [a.id, a.name]));
  const eventRows = rows<EventDb>(eventRes);
  const paidInto = new Map<string, string>();
  const paymentTxns = eventRows.flatMap((e) => (e.txn_id ? [e.txn_id] : []));
  if (paymentTxns.length > 0) {
    for (const t of rows<{ id: string; account_id: string }>(await supabase.from("transactions").select("id, account_id").in("id", paymentTxns))) paidInto.set(t.id, accountName.get(t.account_id) ?? "Account");
  }
  const loans: Loan[] = rows<LoanDb>(loanRes).map((l) => ({
    id: l.id,
    borrower: l.borrower,
    amount: money(l.amount),
    lentOn: isoDate(l.lent_on),
    dueOn: isoDate(l.due_on),
    from: { kind: l.from_kind, ref: l.from_ref, name: l.from_name },
    accountId: l.account_id,
    accountName: l.account_id ? (accountName.get(l.account_id) ?? null) : null,
    note: l.note,
    txnId: l.txn_id,
    events: eventRows.filter((e) => e.loan_id === l.id).map((e): LoanEvent => ({
      id: e.id,
      kind: e.kind,
      on: isoDate(e.on_date),
      amount: e.amount == null ? null : money(e.amount),
      oldDue: e.old_due ? isoDate(e.old_due) : null,
      newDue: e.new_due ? isoDate(e.new_due) : null,
      note: e.note,
      accountName: e.txn_id ? (paidInto.get(e.txn_id) ?? null) : null,
      txnId: e.txn_id,
    })),
  }));
  const outside: Outside[] = outRes.error
    ? []
    : rows<{ id: string; account_id: string; occurred_at: string; amount: number; other_owner: string | null; from_kind: SourceKind; from_ref: string | null; from_name: string | null }>(outRes).map((t) => ({
        id: t.id,
        owner: t.other_owner ?? "someone",
        amount: money(Math.abs(t.amount)),
        on: manilaDate(t.occurred_at),
        from: { kind: t.from_kind, ref: t.from_ref, name: t.from_name } as LoanSource,
        accountId: t.account_id,
      }));
  return { ready: true, loans, outside };
}

export interface PaybackChoice {
  id: string;
  amount: number;
  accountId: string;
  accountName: string;
  occurredAt: string;
  merchant: string | null;
}

/**
 * Transactions that are not tied to any loan yet, from the last 45 days: money in (to record a payback without counting it twice) or
 * money out (to turn something already recorded into a loan).
 */
export async function loadLinkable(supabase: SupabaseClient, direction: "in" | "out"): Promise<PaybackChoice[]> {
  const since = new Date(Date.now() - 45 * 86_400_000).toISOString();
  const q = supabase.from("transactions").select("id, amount, account_id, occurred_at, merchant").neq("status", "ignored").is("transfer_peer_id", null).gte("occurred_at", since).order("occurred_at", { ascending: false }).limit(40);
  const [txns, accts, loans, events] = await Promise.all([
    direction === "in" ? q.gt("amount", 0) : q.lt("amount", 0),
    supabase.from("accounts").select("id, name"),
    supabase.from("loans").select("txn_id"),
    supabase.from("loan_events").select("txn_id"),
  ]);
  const used = new Set([...rows<{ txn_id: string | null }>(loans), ...rows<{ txn_id: string | null }>(events)].map((r) => r.txn_id));
  const name = new Map(rows<{ id: string; name: string }>(accts).map((a) => [a.id, a.name]));
  return rows<{ id: string; amount: number; account_id: string; occurred_at: string; merchant: string | null }>(txns)
    .filter((t) => !used.has(t.id))
    .map((t) => ({ id: t.id, amount: t.amount, accountId: t.account_id, accountName: name.get(t.account_id) ?? "Account", occurredAt: t.occurred_at, merchant: t.merchant }));
}
