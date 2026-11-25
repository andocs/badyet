import { describe, expect, it } from "vitest";
import { p } from "@/lib/engine/fixtures";
import { buildChecklist, restOf, type ChecklistLine, type ChecklistTransfer } from "./checklist";

const line = (id: string, walletId: string, amount: number, sort: number, reimbursed = false): ChecklistLine => ({ id, name: id, walletId, amount: p(amount), reimbursed, sort });
const xfer = (id: string, toId: string, amount: number, lineId: string | null = null, pending = false): ChecklistTransfer => ({ id, fromId: "bpi", toId, amount: p(amount), lineId, pending });

const lines = [
  line("transport", "gcash", 2_400, 1),
  line("food", "gcash", 2_000, 2),
  line("load", "gcash", 180, 3),
  line("family", "bpi", 3_000, 4), // the payroll account itself
  line("emergency", "maya", 5_000, 5),
  line("internet", "maya", 2_099, 6, true),
];
const get = (c: ReturnType<typeof buildChecklist>, wallet: string) => c.wallets.find((w) => w.walletId === wallet)!;

describe("pay checklist", () => {
  it("counts lines that stay in the payroll account as sent and the rest as to send", () => {
    const c = buildChecklist({ lines, transfers: [], payrollId: "bpi" });
    expect(get(c, "bpi").lines[0]).toMatchObject({ sent: true, how: "payroll" });
    expect(get(c, "gcash")).toMatchObject({ total: p(4_580), sent: 0, rest: p(4_580) });
    expect([c.sentCount, c.lineCount]).toEqual([1, 6]);
  });

  it("a tick for a line marks that line sent, and only that line", () => {
    const c = buildChecklist({ lines, transfers: [xfer("t1", "gcash", 2_000, "food")], payrollId: "bpi" });
    expect(get(c, "gcash").lines.map((l) => [l.id, l.sent, l.how])).toEqual([["transport", false, null], ["food", true, "ticked"], ["load", false, null]]);
  });

  it("a lump into the wallet covers its unsent lines in budget order", () => {
    // 4,400 = transport + food; the 180 load is not reached.
    const c = buildChecklist({ lines, transfers: [xfer("t1", "gcash", 4_400)], payrollId: "bpi" });
    expect(get(c, "gcash").lines.map((l) => [l.id, l.sent, l.how])).toEqual([["transport", true, "covered"], ["food", true, "covered"], ["load", false, null]]);
    expect(get(c, "gcash").rest).toBe(p(180));
  });

  it("a lump of the rest covers exactly the lines not ticked", () => {
    const c = buildChecklist({ lines, transfers: [xfer("t1", "gcash", 2_400, "transport"), xfer("t2", "gcash", 2_180)], payrollId: "bpi" });
    expect(get(c, "gcash").lines.every((l) => l.sent)).toBe(true);
    expect(get(c, "gcash").unmatched).toBe(0);
  });

  it("a transfer the app detected ticks the lines it adds up to, and money that reaches no line is left unmatched", () => {
    const c = buildChecklist({ lines, transfers: [xfer("t1", "maya", 5_300)], payrollId: "bpi" });
    expect(get(c, "maya").lines.map((l) => [l.id, l.sent])).toEqual([["emergency", true], ["internet", false]]);
    expect(get(c, "maya").unmatched).toBe(p(300));
  });

  it("money that does not reach the next line does not skip ahead to a smaller one", () => {
    const c = buildChecklist({ lines, transfers: [xfer("t1", "gcash", 2_000)], payrollId: "bpi" });
    // 2,000 is short of transport (2,400), so nothing is covered, even though it would pay for food.
    expect(get(c, "gcash").lines.some((l) => l.sent)).toBe(false);
    expect(get(c, "gcash").unmatched).toBe(p(2_000));
  });

  it("allows a peso of difference, and shows a detected transfer still waiting in the Inbox", () => {
    const c = buildChecklist({ lines, transfers: [xfer("t1", "maya", 4_999.5, null, true)], payrollId: "bpi" });
    expect(get(c, "maya").lines[0]).toMatchObject({ sent: true, how: "covered", pending: true });
  });

  it("ignores transfers that did not come from the payroll account", () => {
    const other: ChecklistTransfer = { id: "x", fromId: "maya", toId: "gcash", amount: p(2_400), lineId: null, pending: false };
    const c = buildChecklist({ lines, transfers: [other], payrollId: "bpi" });
    expect(get(c, "gcash").sent).toBe(0);
  });

  it("keeps what is needed to undo a tick or a lump", () => {
    const c = buildChecklist({ lines, transfers: [xfer("t1", "gcash", 2_400, "transport"), xfer("t2", "gcash", 2_180)], payrollId: "bpi" });
    expect(get(c, "gcash").lines[0]!.txnId).toBe("t1");
    expect(get(c, "gcash").lumps).toEqual([{ id: "t2", amount: p(2_180), pending: false }]);
  });

  it("works out what Send the rest moves", () => {
    const c = buildChecklist({ lines, transfers: [xfer("t1", "gcash", 2_400, "transport")], payrollId: "bpi" });
    expect(restOf(get(c, "gcash"))).toEqual({ amount: p(2_180), lineIds: ["food", "load"] });
  });
});
