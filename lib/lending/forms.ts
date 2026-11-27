import { formatPesos, money, parsePesos, type Money } from "@/lib/domain/money";
import type { IsoDate } from "@/lib/domain/dates";
import { relativeDay, shortDate, timeLabel } from "@/lib/now/format";
import { manilaDate } from "@/lib/now/summary";
import type { PaybackChoice } from "./load";
import { daysLate, outstandingOf, type Loan, type LoanSource } from "./model";
import type { PaybackInput } from "./write";

/** What the web and phone lending forms say, kept in one place. */
export const pesoText = (n: number): string => formatPesos(money(Math.abs(n)));

export const dueBadge = (l: Loan, today: IsoDate): { text: string; late: boolean } => {
  const late = daysLate(l, today);
  if (late === 0) return { text: "Due today", late: true };
  if (late > 0) return { text: `${late} day${late === 1 ? "" : "s"} late`, late: true };
  return { text: `Due ${shortDate(l.dueOn)}`, late: false };
};

export const loanLine = (l: Loan): string =>
  `${l.from.kind === "none" || !l.from.name ? "Lent" : `From ${l.from.name} · lent`} ${shortDate(l.lentOn)}`;

export function promptDetail(l: Loan): string {
  const owed = outstandingOf(l);
  const of = owed < l.amount ? ` of ${pesoText(l.amount)}` : "";
  const from = l.from.kind !== "none" && l.from.name ? ` from ${l.from.name}` : "";
  const sent = l.accountName ? `, sent from ${l.accountName}` : "";
  return `${pesoText(owed)}${of} lent on ${shortDate(l.lentOn)}${from}${sent}.`;
}

/** "Where did the money arrive?": recorded money in first (so it is not counted twice), then your accounts, then cash. */
export function receivedOptions(choices: readonly PaybackChoice[], accounts: readonly { id: string; name: string }[], owed: number, whole: boolean, today: IsoDate): { key: string; label: string }[] {
  const fits = choices.filter((c) => (whole ? c.amount === owed : c.amount < owed));
  return [
    ...fits.map((c) => ({ key: `txn:${c.id}`, label: `Already in the Inbox: ${pesoText(c.amount)} into ${c.accountName}, ${relativeDay(manilaDate(c.occurredAt), today).toLowerCase()} ${timeLabel(c.occurredAt)}` })),
    ...accounts.map((a) => ({ key: `acct:${a.id}`, label: `Add it: into ${a.name}` })),
    { key: "cash", label: "Cash that no account tracks" },
  ];
}

/** The save request for a payback from the picked "where it arrived" and, for a part payment, the typed amount. */
export function paybackInput(loanId: string, receivedKey: string, amountText: string, nextDue: string | null): PaybackInput {
  if (receivedKey.startsWith("txn:")) return { loanId, txnId: receivedKey.slice(4), nextDue };
  return { loanId, manual: { amount: amountText, accountId: receivedKey.startsWith("acct:") ? receivedKey.slice(5) : null }, nextDue };
}

/** The amount a part payment is for: the recorded item's when one is picked, else what was typed. null = not a number yet. */
export function paybackAmount(choices: readonly PaybackChoice[], receivedKey: string, amountText: string): Money | null {
  if (receivedKey.startsWith("txn:")) {
    const c = choices.find((x) => x.id === receivedKey.slice(4));
    return c ? money(c.amount) : null;
  }
  const n = parsePesos(amountText.trim());
  return n === undefined || n <= 0 ? null : n;
}

/** "What changes" when lending. */
export function lendEffect(from: { kind: string; name: string | null }, amount: number | null, borrower: string): string {
  const who = borrower.trim() || "they";
  const pay = who === "they" ? "pay" : "pays";
  const much = amount === null ? "the amount" : pesoText(amount);
  if (from.kind === "none" || !from.name) return `${much} is recorded as owed to you. It is not counted as spending.`;
  return `${from.name} goes down by ${much} until ${who} ${pay} you back. It is not counted as spending.`;
}

/** "What changes" when money comes back. */
export function paybackEffect(from: LoanSource, amount: number, owed: number, borrower: string, nextDue: string | null): string {
  const back = from.kind !== "none" && from.name ? `${from.name} goes back up by ${pesoText(amount)}. ` : "";
  const rest = amount >= owed ? "The loan is closed." : `${borrower} still owes ${pesoText(owed - amount)}${nextDue ? `, due ${shortDate(nextDue as IsoDate)}` : ""}.`;
  return `${back}This is not counted as income. ${rest}`;
}

export function historyRows(l: Loan): { key: string; text: string; amount: number | null; side: string | null }[] {
  let owed: number = l.amount;
  return [
    { key: "lent", text: `${shortDate(l.lentOn)} · Lent${l.from.kind !== "none" && l.from.name ? ` from ${l.from.name}` : ""}`, amount: -l.amount, side: null },
    ...l.events.map((e) => {
      if (e.kind === "payment") {
        owed -= e.amount ?? 0;
        return { key: e.id, text: `${shortDate(e.on)} · ${owed > 0 ? "Paid part" : "Paid"}${e.accountName ? `, into ${e.accountName}` : ""}`, amount: e.amount, side: null };
      }
      return { key: e.id, text: `${shortDate(e.on)} · Postponed${e.oldDue && e.newDue ? `: ${shortDate(e.oldDue)} → ${shortDate(e.newDue)}` : ""}${e.note ? ` (${e.note})` : ""}`, amount: null, side: `${pesoText(owed)} left` };
    }),
  ];
}

/** What to call a transaction that belongs to a loan: "Lent to Sam" or "Paid back by Sam". */
export function loanTags(loans: readonly Loan[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const l of loans) {
    if (l.txnId) out.set(l.txnId, `Lent to ${l.borrower}`);
    for (const e of l.events) if (e.txnId) out.set(e.txnId, `Paid back by ${l.borrower}`);
  }
  return out;
}
