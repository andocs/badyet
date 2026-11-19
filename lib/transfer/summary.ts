import { add, sub, sum, ZERO, type Money } from "@/lib/domain/money";

export interface Wallet {
  id: string;
  name: string;
}
export interface TransferLine {
  id: string;
  name: string;
  amount: Money;
  walletId: string | null;
}
export interface WalletGroup {
  wallet: Wallet | null; // null = lines with no wallet yet
  lines: TransferLine[];
  total: Money;
  sentTotal: Money;
  sentCount: number;
}

// Groups lines by wallet (wallets in the given order, then "no wallet"), with totals and sent counts.
export function groupByWallet(lines: readonly TransferLine[], wallets: readonly Wallet[], sent: ReadonlySet<string>): WalletGroup[] {
  const build = (wallet: Wallet | null, mine: TransferLine[]): WalletGroup => ({
    wallet,
    lines: mine,
    total: sum(mine.map((l) => l.amount)),
    sentTotal: sum(mine.filter((l) => sent.has(l.id)).map((l) => l.amount)),
    sentCount: mine.filter((l) => sent.has(l.id)).length,
  });
  const known = new Set(wallets.map((w) => w.id));
  const groups = wallets.map((w) => build(w, lines.filter((l) => l.walletId === w.id))).filter((g) => g.lines.length > 0);
  const loose = lines.filter((l) => l.walletId === null || !known.has(l.walletId));
  return loose.length > 0 ? [...groups, build(null, loose)] : groups;
}

export function leftToSend(groups: readonly WalletGroup[]): Money {
  return groups.reduce((acc, g) => add(acc, sub(g.total, g.sentTotal)), ZERO);
}
