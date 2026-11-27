import { describe, expect, it } from "vitest";
import { applyMoves } from "@/lib/budget/moves";
import type { GroupView, LineView } from "@/lib/budget/view";
import { isoDate, yearMonth } from "@/lib/domain/dates";
import { money, parsePesos } from "@/lib/domain/money";
import { bonusNotes, cutoffDraws, draws, dueChips, dueLoans, fundLending, lendingMoves, outstandingOf, type Loan, type LoanEvent, type Outside } from "./model";
import { sourceKey, sourceOfKey } from "./sources";

const p = (n: number) => money(parsePesos(String(n))!);
const d = isoDate;
const paydays = { first: 10, second: 25 };

const loan = (over: Partial<Loan> = {}): Loan => ({
  id: "l1", borrower: "Sam", amount: p(2000), lentOn: d("2027-03-11"), dueOn: d("2027-03-25"), from: { kind: "wants", ref: null, name: "Wants" },
  accountId: "gcash", accountName: "GCash", note: null, txnId: null, events: [], ...over,
});
const paid = (amount: number, on: string): LoanEvent => ({ id: `e-${on}`, kind: "payment", on: d(on), amount: p(amount), oldDue: null, newDue: null, note: null, accountName: null, txnId: null });

describe("what is owed and when to ask", () => {
  it("takes part payments off what is owed", () => {
    expect(outstandingOf(loan({ events: [paid(500, "2027-03-20")] }))).toBe(p(1500));
  });

  it("asks from the expected day until it is paid", () => {
    expect(dueLoans([loan()], d("2027-03-24"))).toHaveLength(0);
    expect(dueLoans([loan()], d("2027-03-25"))).toHaveLength(1);
    expect(dueLoans([loan()], d("2027-04-02"))).toHaveLength(1);
    expect(dueLoans([loan({ events: [paid(2000, "2027-03-25")] })], d("2027-04-02"))).toHaveLength(0);
  });

  it("offers the next payday, a later date and the end of the month", () => {
    expect(dueChips(d("2027-03-11"), paydays).map((c) => c.date)).toEqual(["2027-03-25", "2027-03-25", "2027-03-31"]);
    expect(dueChips(d("2027-03-31"), paydays, 1).map((c) => c.date)).toEqual(["2027-04-10", "2027-04-07", "2027-04-30"]);
  });
});

describe("where the money shows", () => {
  const list = draws([loan({ events: [paid(500, "2027-03-26")] })], []);

  it("leaves Wants when lent and comes back in the cutoff it is paid", () => {
    expect(cutoffDraws(list, { start: d("2027-03-10"), end: d("2027-03-24") })).toEqual([{ lineId: null, amount: -p(2000) }]);
    expect(cutoffDraws(list, { start: d("2027-03-25"), end: d("2027-04-09") })).toEqual([{ lineId: null, amount: p(500) }]);
  });

  it("shows both on the Budget page of that month, in their own cutoffs", () => {
    const moves = lendingMoves(list, paydays, yearMonth("2027-03"));
    expect(moves.map((m) => [m.cutoff, m.text, m.amount])).toEqual([
      ["first", "lent to Sam", p(2000)],
      ["second", "paid back by Sam", p(500)],
    ]);
  });

  it("takes it off the budget line it was lent from", () => {
    const line = { id: "food", name: "Food", amount: p(6000), perCutoff: { first: p(3000), second: p(3000) }, kind: "normal" } as LineView;
    const group: GroupView = { id: "g", name: "Essentials", feedsSavings: false, lines: [line], total: p(6000), share: 0, spentTotal: money(0) };
    const moved = applyMoves([group], lendingMoves(draws([loan({ from: { kind: "line", ref: "food", name: "Food" } })], []), paydays, yearMonth("2027-03")));
    expect(moved.groups[0]!.lines[0]!.amount).toBe(p(4000));
    expect(moved.groups[0]!.total).toBe(p(4000));
    expect(moved.notes.food).toEqual([{ text: "lent to Sam", amount: -p(2000), counted: true }]);
  });

  it("lists money taken from a bonus under that bonus", () => {
    const notes = bonusNotes(draws([loan({ from: { kind: "bonus", ref: "rule|2027", name: "13th month 2027" } })], []));
    expect(notes["rule|2027"]).toEqual([{ text: "lent to Sam", amount: -p(2000) }]);
  });

  it("has nothing to show for a loan with no source", () => {
    expect(draws([loan({ from: { kind: "none", ref: null, name: null } })], [])).toEqual([]);
  });
});

describe("savings funds", () => {
  const funds = [{ id: "travel", linkedAccountId: null }, { id: "ef", linkedAccountId: "bank" }];
  const start = { travel: p(10_000), ef: p(50_000) };
  const fromFund = (ref: string, accountId: string) => loan({ from: { kind: "fund", ref, name: ref }, accountId, dueOn: d("2027-05-10") });

  it("takes lent money off a fund and expects it back in the due month", () => {
    const r = fundLending(funds, start, [fromFund("travel", "gcash")], [], d("2027-03-11"));
    expect(r.balances.travel).toBe(p(8000));
    expect(r.held).toEqual([{ fundId: "travel", amount: p(2000), backMonth: "2027-05" }]);
  });

  it("does not take it twice from a fund linked to the account it left", () => {
    const r = fundLending(funds, start, [fromFund("ef", "bank")], [], d("2027-03-11"));
    expect(r.balances.ef).toBe(p(50_000));
    expect(r.held[0]!.amount).toBe(p(2000));
  });

  it("expects overdue money no earlier than next month", () => {
    const r = fundLending(funds, start, [fromFund("travel", "gcash")], [], d("2027-06-02"));
    expect(r.held[0]!.backMonth).toBe("2027-07");
  });

  it("keeps money sent and not coming back out for good", () => {
    const sent: Outside = { id: "o", owner: "Alex", amount: p(1000), on: d("2027-03-11"), from: { kind: "fund", ref: "travel", name: "Travel" }, accountId: "gcash" };
    const r = fundLending(funds, start, [], [sent], d("2027-03-11"));
    expect(r.balances.travel).toBe(p(9000));
    expect(r.held).toEqual([]);
  });
});

describe("source keys", () => {
  it("round-trips, including a bonus's card key", () => {
    for (const s of [{ kind: "wants", ref: null }, { kind: "bonus", ref: "abc|2027" }, { kind: "none", ref: null }] as const) expect(sourceOfKey(sourceKey(s))).toEqual(s);
  });
});
