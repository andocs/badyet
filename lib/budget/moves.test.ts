import { describe, expect, it } from "vitest";
import { p } from "@/lib/engine/fixtures";
import { isoDate, type YearMonth } from "@/lib/domain/dates";
import { applyMoves, budgetMoves } from "./moves";
import type { GroupView, LineView } from "./view";

const line = (id: string, kind: LineView["kind"], amount: number) => ({ id, name: id, kind, amount: p(amount), perCutoff: { first: p(amount / 2), second: p(amount / 2) } }) as unknown as LineView;
const group = (id: string, feedsSavings: boolean, lines: LineView[]) => ({ id, name: id, feedsSavings, lines, total: p(lines.reduce((t, l) => t + (l.amount ?? 0) / 100, 0)), share: 0, spentTotal: p(0) }) as GroupView;
const groups = () => [group("Essentials", false, [line("food", "rto", 2_000), line("cont", "rto_contingency", 500)]), group("Wants", false, []), group("Savings", true, [])];
const paydays = { first: 10, second: 25 };
const pool = (entries: [string, number, string][]) => [{ name: "RTO contingency", lineId: "cont", entries: entries.map(([kind, amount, on]) => ({ kind, amount: p(amount), occurredOn: isoDate(on) })) }];
const month = "2026-11" as YearMonth;
const total = (out: ReturnType<typeof applyMoves>) => out.groups.reduce((t, g) => t + g.total, 0);

describe("budgetMoves", () => {
  it("keeps only this budget month's moves, with the cutoff each was made in", () => {
    const m = budgetMoves(pool([["settle_to_wants", 300, "2026-11-12"], ["settle_to_savings", 200, "2026-11-27"], ["settle_to_wants", 99, "2026-10-12"], ["fund", 500, "2026-11-12"], ["use", 100, "2026-11-12"]]), paydays, month);
    expect(m.map((x) => [x.to.kind, x.cutoff, x.amount])).toEqual([["wants", "first", p(300)], ["savings", "second", p(200)]]);
  });
});

describe("applyMoves", () => {
  const moves = budgetMoves(pool([["settle_to_wants", 300, "2026-11-12"], ["settle_to_pool", 100, "2026-11-13"], ["settle_to_savings", 200, "2026-11-27"]]), paydays, month);

  it("takes the money off the RTO line and adds it where it went, so the budget's total is unchanged", () => {
    const before = groups();
    const out = applyMoves(before, moves);
    const [ess, wants, savings] = out.groups;
    expect(ess!.lines.map((l) => l.amount)).toEqual([p(1_400), p(600)]);
    expect([ess!.total, wants!.total, savings!.total]).toEqual([p(2_000), p(300), p(200)]);
    expect(total(out)).toBe(p(2_500));
    expect(out.notes.food).toEqual([
      { text: "to Wants", amount: -p(300), counted: true },
      { text: "to RTO contingency", amount: -p(100), counted: true },
      { text: "to savings", amount: -p(200), counted: true },
    ]);
    expect(out.notes.cont).toEqual([{ text: "from RTO", amount: p(100), counted: true }]);
    expect(out.rows.Wants).toMatchObject([{ label: "Moved from RTO", amount: p(300), cutoff: "first" }]);
    expect(out.rows.Savings).toMatchObject([{ label: "Moved from RTO", amount: p(200), cutoff: "second" }]);
    expect(before[0]!.lines[0]!.amount).toBe(p(2_000)); // the input is left alone
  });
  it("counts only that cutoff in a cutoff view", () => {
    const out = applyMoves(groups(), moves, "second");
    expect(out.groups.map((g) => g.total)).toEqual([p(2_300), 0, p(200)]);
  });
  it("takes an overspent day back from Wants", () => {
    const out = applyMoves(groups(), budgetMoves(pool([["over_from_wants", 150, "2026-11-12"]]), paydays, month));
    expect(out.groups[0]!.lines[0]!.amount).toBe(p(2_150));
    expect(out.rows.Wants).toMatchObject([{ label: "Moved to RTO", amount: -p(150) }]);
    expect(total(out)).toBe(p(2_500));
  });
  it("only notes a move out of a pool's saved balance, without changing any amount", () => {
    const out = applyMoves(groups(), budgetMoves(pool([["to_wants", 900, "2026-11-12"]]), paydays, month));
    expect(out.groups.map((g) => g.total)).toEqual([p(2_500), 0, 0]);
    expect(out.groups[0]!.lines[1]!.amount).toBe(p(500));
    expect(out.notes.cont).toEqual([{ text: "to Wants", amount: -p(900), counted: false }]);
    expect(out.rows.Wants).toMatchObject([{ label: "Moved from RTO contingency", amount: p(900), counted: false }]);
  });
});
