import { describe, expect, it } from "vitest";
import { allocateFunds, startBalances } from "./funds";
import { p, ym } from "./fixtures";
import type { Fund } from "./types";

const ef: Fund = { id: "ef", name: "Emergency", priority: 1, rule: "steps", tranches: [p(100_000)], target: p(300_000) };
const travel: Fund = { id: "travel", name: "Travel", priority: 2, rule: "reset", target: p(50_000), resetMonth: 1 };
const wants: Fund = { id: "wants", name: "Wants", priority: 3, rule: "cap", target: p(20_000) };
const funds = [wants, travel, ef]; // order of the list does not matter, priority does
const row = (m: ReturnType<typeof allocateFunds>[number], id: string) => m.funds.find((f) => f.fundId === id)!;

describe("fund allocator", () => {
  it("fills funds in priority order, each taking min(demand, what is left), with reasons", () => {
    const [m] = allocateFunds(funds, { ef: p(90_000) }, [{ month: ym("2027-02"), pool: p(30_000) }]);
    expect(row(m!, "ef")).toMatchObject({ amount: p(10_000), balanceAfter: p(100_000), reasons: ["priority 1", "cap hit"] });
    expect(row(m!, "travel")).toMatchObject({ amount: p(20_000), reasons: ["priority 2", "pool ran out"] });
    expect(row(m!, "wants")).toMatchObject({ amount: 0, reasons: ["priority 3", "pool ran out"] });
    expect(m!.unplaced).toBe(0);
  });

  it("steps repeat the last tranche: the next month asks for the next step", () => {
    const f: Fund = { id: "ef", name: "EF", priority: 1, rule: "steps", tranches: [p(100_000), p(200_000)] };
    const months = allocateFunds([f], {}, [{ month: ym("2027-01"), pool: p(500_000) }, { month: ym("2027-02"), pool: p(500_000) }, { month: ym("2027-03"), pool: p(500_000) }]);
    expect(months.map((m) => row(m, "ef").balanceAfter)).toEqual([p(100_000), p(300_000), p(500_000)]);
    expect(months[0]!.unplaced).toBe(p(400_000)); // one step a month; the rest is not placed
  });

  it("a hard cap stops steps, and a fund with no cap takes the rest", () => {
    const [m] = allocateFunds([{ ...ef, target: p(100_000) }, { ...travel, target: null, resetMonth: null }], { ef: p(100_000) }, [{ month: ym("2027-02"), pool: p(7_000) }]);
    expect(row(m!, "ef")).toMatchObject({ amount: 0, reasons: ["priority 1", "cap hit"] });
    expect(row(m!, "travel")).toMatchObject({ amount: p(7_000), reasons: ["priority 2", "takes the rest"] });
  });

  it("honours an override: a new order, a pinned amount taken first, a skipped fund", () => {
    const [m] = allocateFunds(funds, { ef: p(90_000) }, [{ month: ym("2027-03"), pool: p(40_000) }], [
      { month: ym("2027-03"), order: ["wants"], pins: { travel: p(5_000) }, skips: ["ef"] },
    ]);
    expect(row(m!, "travel")).toMatchObject({ amount: p(5_000), reasons: ["pinned"] });
    expect(row(m!, "wants")).toMatchObject({ amount: p(20_000), reasons: ["priority 1", "cap hit"] });
    expect(row(m!, "ef")).toMatchObject({ amount: 0, reasons: ["skipped"] });
    expect(m!.unplaced).toBe(p(15_000));
  });

  it("an override only changes its own month", () => {
    const ov = [{ month: ym("2027-03"), skips: ["ef"] }];
    const months = allocateFunds(funds, {}, [{ month: ym("2027-03"), pool: p(10_000) }, { month: ym("2027-04"), pool: p(10_000) }], ov);
    expect(row(months[0]!, "ef").amount).toBe(0);
    expect(row(months[1]!, "ef").amount).toBe(p(10_000));
  });

  it("resets a 'reset' fund when its month starts", () => {
    const [m] = allocateFunds(funds, { travel: p(50_000), ef: p(100_000) }, [{ month: ym("2028-01"), pool: p(0) }]);
    expect(row(m!, "travel").balanceAfter).toBe(0);
    expect(row(m!, "ef").balanceAfter).toBe(p(100_000));
  });

  it("credits bonus money straight to the fund, capped by room; the overflow is unplaced and the pool is untouched", () => {
    const [m] = allocateFunds(funds, {}, [{ month: ym("2026-12"), pool: p(0), bonusCredits: { travel: p(70_000) } }]);
    expect(row(m!, "travel")).toMatchObject({ bonus: p(50_000), balanceAfter: p(50_000), amount: 0 });
    expect(m!.bonusUnplaced).toBe(p(20_000));
  });

  it("never gives out more than the pool, and balances never go negative", () => {
    const months = allocateFunds(funds, {}, [p(0), p(1), p(35_000), p(400_000)].map((pool, i) => ({ month: ym(`2027-0${i + 1}`), pool })));
    for (const m of months) {
      const taken = m.funds.reduce((t, f) => t + f.amount, 0);
      expect(taken + m.unplaced).toBe(m.pool);
      for (const f of m.funds) expect(f.balanceAfter).toBeGreaterThanOrEqual(0);
    }
  });

  it("skips archived funds", () => {
    const [m] = allocateFunds([{ ...wants, archived: true }, ef], {}, [{ month: ym("2027-02"), pool: p(10_000) }]);
    expect(m!.funds.map((f) => f.fundId)).toEqual(["ef"]);
  });
});

describe("start balances", () => {
  it("reads linked accounts, typed balances, and virtual shares of one account", () => {
    const f = (id: string, over: Partial<Fund>): Fund => ({ id, name: id, priority: 1, rule: "cap", ...over });
    const b = startBalances(
      [f("a", { linkedAccountId: "acct1", shareBp: 6000 }), f("b", { linkedAccountId: "acct1", shareBp: 4000 }), f("c", { linkedAccountId: "acct2" }), f("d", { startBalance: p(5_000) })],
      { acct1: p(100_000), acct2: p(8_000) },
    );
    expect(b).toEqual({ a: p(60_000), b: p(40_000), c: p(8_000), d: p(5_000) });
  });

  it("rejects shares that are missing or add up to more than the account", () => {
    const f = (id: string, shareBp?: number): Fund => ({ id, name: id, priority: 1, rule: "cap", linkedAccountId: "x", shareBp });
    expect(() => startBalances([f("a"), f("b", 5000)], { x: p(1) })).toThrow(RangeError);
    expect(() => startBalances([f("a", 6000), f("b", 5000)], { x: p(1) })).toThrow(RangeError);
  });
});
