import { describe, expect, it } from "vitest";
import { transfersFromRows } from "./load";

const row = (id: string, account_id: string, amount: number, peer: string | null, over: Partial<{ budget_line_id: string | null; status: string }> = {}) => ({
  id, account_id, amount, transfer_peer_id: peer, budget_line_id: null, status: "confirmed", ...over,
});

describe("transfersFromRows", () => {
  it("makes one transfer from each money-out leg and its other side", () => {
    const t = transfersFromRows([row("o1", "bpi", -500_000, "i1", { budget_line_id: "line" }), row("i1", "gcash", 500_000, "o1", { budget_line_id: "line" })]);
    expect(t).toEqual([{ id: "o1", fromId: "bpi", toId: "gcash", amount: 500_000, lineId: "line", pending: false }]);
  });
  it("is pending when either side still waits in the Inbox, and skips a leg whose other side is missing", () => {
    const t = transfersFromRows([row("o1", "bpi", -100, "i1"), row("i1", "maya", 100, "o1", { status: "pending" }), row("o2", "bpi", -200, "gone")]);
    expect(t.map((x) => [x.id, x.pending])).toEqual([["o1", true]]);
  });
});
