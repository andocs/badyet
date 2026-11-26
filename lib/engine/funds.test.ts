import { describe, expect, it } from "vitest";
import { allocateFunds, monthOrder, startBalances } from "./funds";
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
    expect(row(m!, "ef")).toMatchObject({ amount: p(10_000), balanceAfter: p(100_000), reasons: ["priority 1", "cap hit", "waits for other funds"] });
    expect(row(m!, "travel")).toMatchObject({ amount: p(20_000), reasons: ["priority 2", "pool ran out"] });
    expect(row(m!, "wants")).toMatchObject({ amount: 0, reasons: ["priority 3", "pool ran out"] });
    expect(m!.unplaced).toBe(0);
  });

  it("a step fund with nothing else to fill goes on into its later steps", () => {
    const f: Fund = { id: "ef", name: "EF", priority: 1, rule: "steps", tranches: [p(100_000), p(200_000)] };
    const months = allocateFunds([f], {}, [{ month: ym("2027-01"), pool: p(500_000) }, { month: ym("2027-02"), pool: p(500_000) }, { month: ym("2027-03"), pool: p(500_000) }]);
    // With no other fund to fill first, the later steps take the rest the same month.
    expect(months.map((m) => row(m, "ef").balanceAfter)).toEqual([p(500_000), p(1_000_000), p(1_500_000)]);
    expect(months[0]!.unplaced).toBe(0);
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

  it("bonus savings are capped by room; what is left can be kept unplaced and the pool is untouched", () => {
    const [m] = allocateFunds([travel], {}, [{ month: ym("2026-12"), pool: p(0), bonusSavings: p(70_000) }]);
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

describe("payroll savings plan fund", () => {
  const months = [ym("2026-12"), ym("2027-01"), ym("2027-02")].map((month) => ({ month, pool: p(0), planCredits: { travel: p(4_000) } }));

  it("takes the plan's money in full even when the fund has a target, so a full fund never turns it away", () => {
    // Travel's target is 50,000 and it already holds 49,000; the plan puts in 4,000 a month regardless.
    const out = allocateFunds([travel], { travel: p(49_000) }, months, [], "travel");
    expect(out.map((m) => row(m, "travel").plan)).toEqual([p(4_000), p(4_000), p(4_000)]);
    expect(out[2]!.bonusUnplaced).toBe(0);
  });

  it("never resets, so the plan's money is not wiped each January", () => {
    const out = allocateFunds([travel], {}, months, [], "travel");
    expect(out.map((m) => row(m, "travel").balanceAfter)).toEqual([p(4_000), p(8_000), p(12_000)]);
    // The same fund, not linked to the plan, does reset in January.
    const unlinked = allocateFunds([travel], { travel: p(4_000) }, [{ month: ym("2026-12"), pool: p(0) }, { month: ym("2027-01"), pool: p(0) }]);
    expect(row(unlinked[1]!, "travel").balanceAfter).toBe(0);
  });

  it("money for a fund that no longer exists is left unplaced, not lost silently", () => {
    const [m] = allocateFunds([wants], {}, [{ month: ym("2026-12"), pool: p(0), planCredits: { gone: p(1_000) } }], [], "gone");
    expect(m!.bonusUnplaced).toBe(p(1_000));
  });
});

describe("bonus savings", () => {
  const funds = [
    { id: "a", name: "A", priority: 1, rule: "cap" as const, target: p(1_000) },
    { id: "b", name: "B", priority: 2, rule: "cap" as const, target: p(500) },
    { id: "c", name: "C", priority: 3, rule: "cap" as const, target: null },
  ];
  const month = "2027-02" as const;
  const run = (override?: { overflow?: string | null; skips?: string[]; order?: string[] }) =>
    allocateFunds(funds, {}, [{ month: month as never, pool: p(0), bonusSavings: p(2_000) }], override ? [{ month: month as never, ...override }] : [])[0]!;
  const got = (m: ReturnType<typeof run>) => Object.fromEntries(m.funds.map((f) => [f.fundId, f.bonus]));

  it("flows down the priority order, each fund up to its cap", () => {
    const m = run();
    expect(got(m)).toEqual({ a: p(1_000), b: p(500), c: p(500) });
    expect(m.bonusUnplaced).toBe(0);
    expect(m.funds.find((f) => f.fundId === "b")!.reasons).toContain("bonus savings");
  });
  it("follows the month's order and passes over skipped funds", () => {
    expect(got(run({ skips: ["b"] }))).toEqual({ a: p(1_000), b: 0, c: p(1_000) });
    expect(got(run({ order: ["c", "b", "a"] }))).toEqual({ a: 0, b: 0, c: p(2_000) });
  });
  it("can be sent to a chosen fund first, or kept out of every fund", () => {
    expect(got(run({ overflow: "b" }))).toEqual({ a: p(1_000), b: p(500), c: p(500) });
    expect(got(run({ overflow: "c" }))).toEqual({ a: 0, b: 0, c: p(2_000) });
    const none = run({ overflow: "none" });
    expect(got(none)).toEqual({ a: 0, b: 0, c: 0 });
    expect(none.bonusUnplaced).toBe(p(2_000));
  });
});

describe("January order", () => {
  const funds = [
    { id: "ef", name: "Emergency", priority: 1, rule: "steps" as const, tranches: [p(100_000)], target: p(500_000) },
    { id: "travel", name: "Travel", priority: 2, rule: "reset" as const, target: p(6_000), resetMonth: 1 },
    { id: "fun", name: "Fun", priority: 3, rule: "reset" as const, target: p(2_000), resetMonth: 1 },
    { id: "long", name: "Long term", priority: 4, rule: "cap" as const, target: null },
  ];
  it("puts the yearly-reset funds before the emergency fund in January only, keeping their own order", () => {
    expect(monthOrder(funds, "2027-01").map((f) => f.id)).toEqual(["travel", "fun", "ef", "long"]);
    expect(monthOrder(funds, "2027-02").map((f) => f.id)).toEqual(["ef", "travel", "fun", "long"]);
  });
  it("leaves the payroll savings plan's fund where it is, since it never resets", () => {
    expect(monthOrder(funds, "2027-01", "travel").map((f) => f.id)).toEqual(["fun", "ef", "travel", "long"]);
  });
  it("fills the reset funds first from January's pool and bonus savings", () => {
    const [jan] = allocateFunds(funds, {}, [{ month: "2027-01" as never, pool: p(7_000), bonusSavings: p(3_000) }]);
    const of = (id: string) => jan!.funds.find((f) => f.fundId === id)!;
    expect([of("travel").bonus, of("travel").amount]).toEqual([p(3_000), p(3_000)]);
    expect(of("fun").amount).toBe(p(2_000));
    expect(of("ef").amount).toBe(p(2_000));
  });
});

describe("a step fund's later steps wait for every other capped fund", () => {
  const funds = [
    { id: "ef", name: "Emergency", priority: 1, rule: "steps" as const, tranches: [p(100_000)], target: p(500_000) },
    { id: "travel", name: "Travel", priority: 2, rule: "reset" as const, target: p(60_000), resetMonth: 1 },
    { id: "fun", name: "Fun", priority: 3, rule: "reset" as const, target: p(50_000), resetMonth: 1 },
    { id: "long", name: "Long term", priority: 4, rule: "cap" as const, target: null },
  ];
  type Row = { pool?: number; bonus?: number };
  const run = (start: Record<string, number>, months: Row[], from = 2) =>
    allocateFunds(funds, Object.fromEntries(Object.entries(start).map(([k, v]) => [k, p(v)])), months.map((m, i) => ({ month: `2027-${String(from + i).padStart(2, "0")}` as never, pool: p(m.pool ?? 0), bonusSavings: p(m.bonus ?? 0) })));
  const got = (m: ReturnType<typeof run>[number], k: "amount" | "bonus" = "amount") => m.funds.map((f) => f[k]);

  it("of 100k with EF at 95k, gives EF 5k and the rest to the next funds", () => {
    expect(got(run({ ef: 95_000 }, [{ pool: 100_000 }])[0]!)).toEqual([p(5_000), p(60_000), p(35_000), 0]);
    expect(got(run({ ef: 95_000 }, [{ bonus: 100_000 }])[0]!, "bonus")).toEqual([p(5_000), p(60_000), p(35_000), 0]);
  });
  it("keeps the next step waiting month after month until the other capped funds are full", () => {
    const [feb, mar, apr] = run({ ef: 100_000 }, [{ pool: 40_000 }, { pool: 40_000 }, { pool: 40_000 }]);
    expect(got(feb!)).toEqual([0, p(40_000), 0, 0]);
    expect(got(mar!)).toEqual([0, p(20_000), p(20_000), 0]);
    expect(got(apr!)).toEqual([p(10_000), 0, p(30_000), 0]);
    expect(feb!.funds[0]!.reasons).toContain("waits for other funds");
    expect(apr!.funds[0]!.reasons).toContain("next step");
  });
  it("waits again after the yearly reset, even partway through a later step", () => {
    const [jan, feb] = run({ ef: 150_000, travel: 60_000, fun: 50_000 }, [{ pool: 40_000 }, { pool: 40_000 }], 1);
    expect(got(jan!)).toEqual([0, p(40_000), 0, 0]);
    expect(got(feb!)).toEqual([0, p(20_000), p(20_000), 0]);
  });
  it("puts the next step ahead of funds with no cap, which can never be full", () => {
    expect(got(run({ ef: 100_000, travel: 60_000, fun: 50_000 }, [{ pool: 30_000 }])[0]!)).toEqual([p(30_000), 0, 0, 0]);
    expect(got(run({ ef: 500_000, travel: 60_000, fun: 50_000 }, [{ pool: 30_000 }])[0]!)).toEqual([0, 0, 0, p(30_000)]);
    // While the next step is locked, the fund with no cap gets what the others cannot take.
    const limited = funds.map((f) => (f.id === "travel" ? { ...f, maxPerMonth: p(10_000) } : f));
    const m = allocateFunds(limited, { ef: p(100_000), fun: p(50_000) }, [{ month: "2027-02" as never, pool: p(30_000) }])[0]!;
    expect(got(m)).toEqual([0, p(10_000), 0, p(20_000)]);
  });
});

describe("the payroll savings plan fund is separate from general savings", () => {
  const funds = [
    { id: "ef", name: "Emergency", priority: 1, rule: "steps" as const, tranches: [p(100_000)], target: p(500_000) },
    { id: "plan", name: "Long term", priority: 2, rule: "fixed" as const, fixedAmount: p(5_000), target: p(900_000) },
    { id: "travel", name: "Travel", priority: 3, rule: "cap" as const, target: p(20_000) },
  ];
  const month = (over: Record<string, unknown> = {}) => ({ month: "2027-02" as never, pool: p(50_000), bonusSavings: p(10_000), planCredits: { plan: p(4_000) }, ...over });
  const of = (m: ReturnType<typeof allocateFunds>[number], id: string) => m.funds.find((f) => f.fundId === id)!;

  it("gets only the plan's money: nothing from the pool or from bonus savings", () => {
    const [m] = allocateFunds(funds, {}, [month()], [], "plan");
    expect(of(m!, "plan")).toMatchObject({ amount: 0, bonus: 0, plan: p(4_000), balanceAfter: p(4_000), reasons: ["Payroll savings plan only"] });
    expect(of(m!, "ef").amount + of(m!, "ef").bonus + of(m!, "travel").amount + of(m!, "travel").bonus + m!.unplaced + m!.bonusUnplaced).toBe(p(60_000));
  });
  it("never makes the emergency fund wait, even though it has a cap it has not reached", () => {
    const [m] = allocateFunds(funds, { ef: p(100_000), travel: p(20_000) }, [month({ bonusSavings: p(0) })], [], "plan");
    expect(of(m!, "ef").amount).toBe(p(50_000));
  });
  it("ignores an old order, pin or chosen-first that names it", () => {
    const [m] = allocateFunds(funds, {}, [month()], [{ month: "2027-02" as never, order: ["plan", "travel", "ef"], pins: { plan: p(9_000) }, overflow: "plan" }], "plan");
    expect([of(m!, "plan").amount, of(m!, "plan").bonus]).toEqual([0, 0]);
    expect(of(m!, "travel").bonus + of(m!, "travel").amount).toBe(p(20_000));
  });
});
