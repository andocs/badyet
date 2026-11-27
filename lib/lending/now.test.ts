import { describe, expect, it } from "vitest";
import { decide } from "@/lib/capture/decide";
import { defaultConfig } from "@/lib/capture/sources";
import { validateRuleFull } from "@/lib/capture/validate";
import { isoDate } from "@/lib/domain/dates";
import { evaluateBudget } from "@/lib/engine/budget";
import { p, ym } from "@/lib/engine/fixtures";
import { buildNowView, WANTS_ENVELOPE_ID, type NowLine } from "@/lib/now/summary";

const line = (over: Partial<NowLine> & Pick<NowLine, "id" | "categoryId">): NowLine => ({
  name: over.id, rule: "fixed", amount: p(0), cutoff: "both", feedsSavings: false, countsToDaily: false, kind: "normal", accountId: null, ...over,
});
const lines: NowLine[] = [line({ id: "food", categoryId: "food", amount: p(7_000), countsToDaily: true }), line({ id: "rest", categoryId: "stash", rule: "rest", feedsSavings: true })];
const view = (draws: { lineId: string | null; amount: number }[]) =>
  buildNowView({
    today: isoDate("2027-03-17"), paydays: { first: 10, second: 25 }, officeDays: [], officeDayAmount: p(0),
    budget: evaluateBudget({ month: ym("2027-03"), takeHome: { first: p(20_000), second: p(30_000) }, lines }),
    lines, categories: [{ id: "food", name: "Food", color: null, feedsSavings: false }, { id: "stash", name: "Stash", color: null, feedsSavings: true }], txns: [], draws,
  });
const plan = (v: ReturnType<typeof view>, id: string) => v.envelopes.find((e) => e.categoryId === id)!.plan;

describe("lent money on Now", () => {
  const before = view([]);

  it("comes off Wants without touching the daily amount", () => {
    const after = view([{ lineId: null, amount: -p(2_000) }]);
    expect(plan(after, WANTS_ENVELOPE_ID)).toBe(plan(before, WANTS_ENVELOPE_ID) - p(2_000));
    expect(after.perDay).toBe(before.perDay);
  });

  it("comes off a daily line, so there is less to spend per day", () => {
    const after = view([{ lineId: "food", amount: -p(700) }]);
    expect(plan(after, "food")).toBe(plan(before, "food") - p(700));
    expect(after.pool).toBe(before.pool - p(700));
    expect(after.perDay).toBeLessThan(before.perDay);
  });

  it("is back once it is paid in the same cutoff", () => {
    const after = view([{ lineId: "food", amount: -p(700) }, { lineId: "food", amount: p(700) }]);
    expect(after.pool).toBe(before.pool);
  });
});

describe("a rule that sends money to someone else", () => {
  const rule = { id: "r", source: null, matchText: "alex", action: "record" as const, categoryId: null, kind: "transfer" as const, words: ["alex"], toOther: "Alex, BPI", autoConfirm: true };
  const config = { ...defaultConfig("gcash"), accountId: "gcash-account", autoConfirm: true };

  it("waits in the Inbox with whose account it is, even with automatic confirmation", () => {
    const r = decide({ source: "gcash", amount: 100_00, direction: "out", text: "sent to Alex" }, config, [rule]);
    expect(r).toMatchObject({ keep: true, status: "pending", accountId: "gcash-account", otherOwner: "Alex, BPI" });
  });

  it("needs a name when saved, and drops the destination account", () => {
    const base = { name: "", enabled: true, channel: "both", words: ["alex"], mustWords: [], skipWords: [], sources: [], packages: [], senders: [], action: "record", kind: "transfer", categoryId: null, fromAccountId: null, toAccountId: null, autoConfirm: false };
    expect(validateRuleFull({ ...base, toOther: "  " }).ok).toBe(false);
    const ok = validateRuleFull({ ...base, toAccountId: "11111111-1111-1111-1111-111111111111", toOther: "Alex" });
    expect(ok.ok && ok.value).toMatchObject({ toAccountId: null, toOther: "Alex" });
  });
});
