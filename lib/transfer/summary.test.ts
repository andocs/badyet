import { describe, expect, it } from "vitest";
import { money } from "@/lib/domain/money";
import { groupByWallet, leftToSend, type TransferLine, type Wallet } from "./summary";

const p = (n: number) => money(n * 100);
const wallets: Wallet[] = [{ id: "g", name: "Gcash" }, { id: "b", name: "BPI" }, { id: "v", name: "Vybe" }];
const lines: TransferLine[] = [
  { id: "1", name: "Transpo", amount: p(2_400), walletId: "g" },
  { id: "2", name: "Food", amount: p(2_000), walletId: "g" },
  { id: "3", name: "Rent", amount: p(3_000), walletId: "b" },
  { id: "4", name: "Mystery", amount: p(500), walletId: null },
  { id: "5", name: "Orphan", amount: p(100), walletId: "deleted-wallet" },
];

describe("groupByWallet", () => {
  it("groups in wallet order, skips empty wallets, puts unassigned last", () => {
    const g = groupByWallet(lines, wallets, new Set());
    expect(g.map((x) => x.wallet?.name ?? "No wallet")).toEqual(["Gcash", "BPI", "No wallet"]);
    expect(g[0].total).toBe(p(4_400));
    expect(g[2].lines.map((l) => l.name)).toEqual(["Mystery", "Orphan"]);
  });
  it("counts what is sent", () => {
    const g = groupByWallet(lines, wallets, new Set(["1", "3"]));
    expect(g[0].sentCount).toBe(1);
    expect(g[0].sentTotal).toBe(p(2_400));
    expect(g[1].sentTotal).toBe(p(3_000));
  });
  it("computes what is left to send", () => {
    const sent = new Set(["1", "3"]);
    const g = groupByWallet(lines, wallets, sent);
    expect(leftToSend(g)).toBe(p(2_000 + 500 + 100));
  });
});
