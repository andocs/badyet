import { describe, expect, it } from "vitest";
import { p, ym } from "@/lib/engine/fixtures";
import { evaluateBudget } from "@/lib/engine/budget";
import type { BudgetLine, PayCutoff } from "@/lib/engine/types";
import { reimbursementOverrides, reimbursementStatuses, type Deposit, type ReimbursementMark } from "./reimburse";

const line = (id: string, cutoff: PayCutoff, amount: number, over: Partial<BudgetLine> = {}): BudgetLine => ({
  id, name: id, rule: "fixed", amount: p(5_000), cutoff: "both", feedsSavings: false, countsToDaily: false, kind: "normal", reimburse: { amount: p(amount), cutoff }, ...over,
});
const lines = [line("net", "first", 2_000), line("phone", "second", 1_000)];
const run = (current: PayCutoff, deposits: Deposit[] = [], marks: ReimbursementMark[] = [], ls = lines) =>
  reimbursementStatuses({ lines: ls, plans: [], month: ym("2026-11"), current, deposits, marks }).map((s) => [s.lineId, s.state, s.how]);

describe("reimbursementStatuses", () => {
  it("waits once its cutoff has started, and expects one whose cutoff is ahead", () => {
    expect(run("first")).toEqual([["net", "waiting", null], ["phone", "expected", null]]);
    expect(run("second")).toEqual([["net", "waiting", null], ["phone", "waiting", null]]);
  });
  it("is received when a confirmed deposit matches to the peso, even one that came early", () => {
    expect(run("first", [{ id: "d1", amount: p(2_000.5) }, { id: "d2", amount: p(1_000) }])).toEqual([["net", "received", "deposit"], ["phone", "received", "deposit"]]);
    expect(run("second", [{ id: "d1", amount: p(2_100) }])[0]).toEqual(["net", "waiting", null]);
  });
  it("lets one deposit pay back one line only", () => {
    const twins = [line("a", "first", 500), line("b", "first", 500)];
    expect(run("first", [{ id: "d1", amount: p(500) }], [], twins)).toEqual([["a", "received", "deposit"], ["b", "waiting", null]]);
  });
  it("follows your own mark over what it spotted", () => {
    expect(run("second", [{ id: "d1", amount: p(2_000) }], [{ lineId: "net", cutoff: "first", received: false }, { lineId: "phone", cutoff: "second", received: true }])).toEqual([["net", "waiting", null], ["phone", "received", "marked"]]);
  });
  it("leaves out lines that are off this month", () => {
    expect(run("first", [], [], [line("old", "first", 1, { endsOn: ym("2026-10") }), line("draft", "first", 1, { isDraft: true })])).toEqual([]);
  });
});

describe("a waiting reimbursement in the budget", () => {
  const budget = (statuses: ReturnType<typeof reimbursementStatuses>, month = "2026-11") => evaluateBudget({ month: ym(month), takeHome: { first: p(30_000), second: p(30_000) }, lines: [...lines, { ...line("rest", "first", 0), rule: "rest", cutoff: "both", reimburse: null }], reimbursementOverrides: reimbursementOverrides(statuses, lines, [])[month] });
  it("is not part of what you have until it arrives", () => {
    const waiting = budget(reimbursementStatuses({ lines, plans: [], month: ym("2026-11"), current: "first", deposits: [], marks: [] }));
    expect(waiting.reimbursed).toEqual({ first: 0, second: p(1_000) });
    expect(budget([]).rest.first - waiting.rest.first).toBe(p(2_000));
    expect(waiting.rest.second).toBe(budget([]).rest.second);
  });
});

describe("a postponed reimbursement", () => {
  const status = (month: string, marks: ReimbursementMark[], deposits: Deposit[] = [], ls = lines) =>
    reimbursementStatuses({ lines: ls, plans: [], month: ym(month), current: "second", deposits, marks });
  const postponed = (month: string): ReimbursementMark => ({ lineId: "net", month: ym(month), cutoff: "first", received: false, postponed: true });
  const net = (s: ReturnType<typeof status>) => s.find((x) => x.lineId === "net")!;

  it("is left out this month and added to next month's reimbursement day, on top of that month's own", () => {
    const now = status("2026-11", [postponed("2026-11")]);
    expect(net(now)).toMatchObject({ state: "postponed", amount: p(2_000), carried: 0 });
    const over = reimbursementOverrides(now, lines, []);
    expect(over["2026-11"]!.net).toEqual({ cutoff: "first", amount: 0 });
    expect(over["2026-12"]!.net).toEqual({ cutoff: "first", amount: p(4_000) });
    expect(over["2027-01"]).toBeUndefined();
  });
  it("is due with that month's own once it comes round, and one deposit of both pays it", () => {
    expect(net(status("2026-12", [postponed("2026-11")]))).toMatchObject({ state: "waiting", amount: p(4_000), carried: p(2_000) });
    expect(net(status("2026-12", [postponed("2026-11")], [{ id: "d", amount: p(4_000) }]))).toMatchObject({ state: "received", how: "deposit" });
  });
  it("keeps adding up while it is postponed again, and stops once a month was not", () => {
    expect(net(status("2027-01", [postponed("2026-11"), postponed("2026-12")]))).toMatchObject({ amount: p(6_000), carried: p(4_000) });
    expect(net(status("2027-01", [postponed("2026-11")]))).toMatchObject({ amount: p(2_000), carried: 0 });
  });
  it("is still owed after the line has ended", () => {
    const ended = [line("net", "first", 2_000, { endsOn: ym("2026-11") })];
    expect(reimbursementOverrides(status("2026-11", [postponed("2026-11")], [], ended), ended, [])["2026-12"]!.net!.amount).toBe(p(2_000));
    expect(net(status("2026-12", [postponed("2026-11")], [], ended))).toMatchObject({ amount: p(2_000), carried: p(2_000) });
  });
});
