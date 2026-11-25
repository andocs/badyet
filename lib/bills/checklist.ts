import { money, sum, ZERO, type Money } from "@/lib/domain/money";

/** A budget line that goes to a wallet, with what it comes to in the cutoff being checked. */
export interface ChecklistLine {
  id: string;
  name: string;
  /** The wallet (account) the money goes to. */
  walletId: string;
  amount: Money;
  /** Paid out first and paid back later (your sheet's "Reimbursed"). */
  reimbursed: boolean;
  /** Order on the budget; lines of a wallet are covered in this order. */
  sort: number;
}

/** A transfer between two of your accounts in the cutoff, whether you ticked it in the app or the app detected it. */
export interface ChecklistTransfer {
  /** The money-out leg's id: what to cancel to undo it. */
  id: string;
  fromId: string;
  toId: string;
  /** Always positive. */
  amount: Money;
  /** The line it was ticked for; null for a lump ("Send the rest") or a transfer the app detected. */
  lineId: string | null;
  /** Waiting in the Inbox to be confirmed (a detected transfer you have not confirmed yet). */
  pending: boolean;
}

export type LineHow = "ticked" | "covered" | "payroll" | null;

export interface ChecklistLineOut extends ChecklistLine {
  sent: boolean;
  /** ticked: you ticked this line. covered: a transfer into the wallet (a lump, or one the app detected) pays for it. payroll: it is already in the payroll account. */
  how: LineHow;
  /** The money for it is in a transfer still waiting in the Inbox. */
  pending: boolean;
  /** The transfer you ticked it with, so it can be undone; null otherwise. */
  txnId: string | null;
}

export interface WalletOut {
  walletId: string;
  lines: ChecklistLineOut[];
  total: Money;
  /** Total of the lines that count as sent. */
  sent: Money;
  /** What is left to send: the lines not yet sent. */
  rest: Money;
  /** Money that went into the wallet from the payroll account but does not add up to the next line, so it is not matched to one. */
  unmatched: Money;
  /** Transfers into the wallet that no single line claimed (a lump you sent, or one the app detected), for undo. */
  lumps: { id: string; amount: Money; pending: boolean }[];
}

export interface Checklist {
  wallets: WalletOut[];
  total: Money;
  sent: Money;
  lineCount: number;
  sentCount: number;
}

/** Amounts within ₱1 count as equal (banks round and fees get added). */
const TOLERANCE = 100;

/**
 * The pay checklist for one cutoff. Each line goes to a wallet; the money moves from your payroll account. A line is sent when you
 * ticked it, or when transfers into its wallet from the payroll account that no line claimed (a lump you sent, or a transfer the
 * app detected from a notification or email) add up to it, covering the wallet's unsent lines in budget order. A line whose wallet
 * is the payroll account needs no transfer.
 */
export function buildChecklist(input: { lines: readonly ChecklistLine[]; transfers: readonly ChecklistTransfer[]; payrollId: string | null }): Checklist {
  const { payrollId } = input;
  const byWallet = new Map<string, ChecklistLine[]>();
  for (const l of [...input.lines].sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name))) byWallet.set(l.walletId, [...(byWallet.get(l.walletId) ?? []), l]);

  const wallets: WalletOut[] = [];
  for (const [walletId, lines] of byWallet) {
    const incoming = input.transfers.filter((t) => t.toId === walletId && t.fromId === payrollId);
    const ticked = new Set(incoming.filter((t) => t.lineId !== null).map((t) => t.lineId));
    const tickedPending = new Set(incoming.filter((t) => t.lineId !== null && t.pending).map((t) => t.lineId));
    // Unclaimed money into the wallet, kept in time order of arrival by the caller; it covers unsent lines in budget order.
    const unclaimed = incoming.filter((t) => t.lineId === null);
    let pool = sum(unclaimed.map((t) => t.amount));
    const pendingPool = sum(unclaimed.filter((t) => t.pending).map((t) => t.amount));
    let pendingLeft = pendingPool;

    const out: ChecklistLineOut[] = [];
    let covering = walletId !== payrollId;
    for (const l of lines) {
      if (walletId === payrollId) {
        out.push({ ...l, sent: true, how: "payroll", pending: false, txnId: null });
      } else if (ticked.has(l.id)) {
        out.push({ ...l, sent: true, how: "ticked", pending: tickedPending.has(l.id), txnId: incoming.find((t) => t.lineId === l.id)?.id ?? null });
      } else if (covering && pool + TOLERANCE >= l.amount && l.amount > 0) {
        pool = money(pool - l.amount);
        // It counts as waiting in the Inbox when the pending money is what pays for it.
        const usesPending = pendingLeft > 0;
        pendingLeft = money(Math.max(0, pendingLeft - l.amount));
        out.push({ ...l, sent: true, how: "covered", pending: usesPending, txnId: null });
      } else {
        covering = false; // strict order: money that does not reach the next line does not skip ahead
        out.push({ ...l, sent: false, how: null, pending: false, txnId: null });
      }
    }
    const total = sum(out.map((l) => l.amount));
    const sent = sum(out.filter((l) => l.sent).map((l) => l.amount));
    wallets.push({ walletId, lines: out, total, sent, rest: money(total - sent), unmatched: walletId === payrollId ? ZERO : money(Math.max(0, pool)), lumps: unclaimed.map((t) => ({ id: t.id, amount: t.amount, pending: t.pending })) });
  }
  const all = wallets.flatMap((w) => w.lines);
  return { wallets, total: sum(wallets.map((w) => w.total)), sent: sum(wallets.map((w) => w.sent)), lineCount: all.length, sentCount: all.filter((l) => l.sent).length };
}

/** What "Send the rest" on a wallet should move: the unsent lines' total, and the lines it covers. */
export function restOf(wallet: WalletOut): { amount: Money; lineIds: string[] } {
  const open = wallet.lines.filter((l) => !l.sent);
  return { amount: sum(open.map((l) => l.amount)), lineIds: open.map((l) => l.id) };
}
