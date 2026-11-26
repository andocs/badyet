import { describe, expect, it } from "vitest";
import { p, ym } from "@/lib/engine/fixtures";
import { evaluateBudget } from "@/lib/engine/budget";
import type { BudgetLine, PayCutoff } from "@/lib/engine/types";
import { awaitedByMonth, reimbursementStatuses, type Deposit, type ReimbursementMark } from "./reimburse";

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
  const budget = (awaited: string[]) => evaluateBudget({ month: ym("2026-11"), takeHome: { first: p(30_000), second: p(30_000) }, lines: [...lines, { ...line("rest", "first", 0), rule: "rest", cutoff: "both", reimburse: null }], awaitedReimbursements: awaited });
  it("is not part of what you have until it arrives", () => {
    const waiting = budget(awaitedByMonth(reimbursementStatuses({ lines, plans: [], month: ym("2026-11"), current: "first", deposits: [], marks: [] }))["2026-11"]!);
    expect(waiting.reimbursed).toEqual({ first: 0, second: p(1_000) });
    expect(budget([]).rest.first - waiting.rest.first).toBe(p(2_000));
    expect(waiting.rest.second).toBe(budget([]).rest.second);
  });
});
