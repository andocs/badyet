import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { isoDate } from "@/lib/domain/dates";
import { editTransaction, type EditInput } from "@/lib/inbox/edit";
import { leftThisCutoff } from "./model";

type Row = Record<string, unknown>;

/** Just enough of the database client for editing: filters, one row or many, insert, update and delete. */
function fakeDb(tables: Record<string, Row[]>): SupabaseClient {
  const from = (name: string) => {
    const table = (tables[name] ??= []);
    const filters: ((r: Row) => boolean)[] = [];
    let action: "select" | "update" | "delete" | "insert" = "select";
    let values: Row = {};
    const run = () => {
      const hit = table.filter((r) => filters.every((f) => f(r)));
      if (action === "update") hit.forEach((r) => Object.assign(r, values));
      if (action === "delete") for (const r of hit) table.splice(table.indexOf(r), 1);
      if (action === "insert") {
        const row = { id: `new-${table.length}`, ...values };
        table.push(row);
        return [row];
      }
      return hit.map((r) => ({ ...r }));
    };
    const q = {
      select: () => q,
      limit: () => q,
      order: () => q,
      eq: (k: string, v: unknown) => (filters.push((r) => r[k] === v), q),
      is: (k: string, v: unknown) => (filters.push((r) => (r[k] ?? null) === v), q),
      in: (k: string, v: unknown[]) => (filters.push((r) => v.includes(r[k])), q),
      update: (v: Row) => ((action = "update"), (values = v), q),
      delete: () => ((action = "delete"), q),
      insert: (v: Row) => ((action = "insert"), (values = v), q),
      maybeSingle: async () => ({ data: run()[0] ?? null, error: null }),
      single: async () => ({ data: run()[0] ?? null, error: null }),
      then: (resolve: (r: { data: Row[]; error: null }) => unknown) => Promise.resolve({ data: run(), error: null }).then(resolve),
    };
    return q;
  };
  return { from } as unknown as SupabaseClient;
}

const TXN = "11111111-1111-4111-8111-111111111111";
const BACK = "44444444-4444-4444-8444-444444444444";
const GCASH = "22222222-2222-4222-8222-222222222222";
const MAYA = "33333333-3333-4333-8333-333333333333";
const LOAN = "55555555-5555-4555-8555-555555555555";
const FOOD = "66666666-6666-4666-8666-666666666666";
const env = { today: isoDate("2026-11-27"), newId: () => "77777777-7777-4777-8777-777777777777" };

const world = (paid = 0) => ({
  accounts: [{ id: GCASH, archived_at: null }, { id: MAYA, archived_at: null }],
  categories: [{ id: "lend", name: "Lending", archived_at: null }, { id: FOOD, name: "Food", archived_at: null }],
  transactions: [
    { id: TXN, kind: "transfer", status: "confirmed", transfer_peer_id: null, amount: -200_000, account_id: GCASH, category_id: "lend" },
    { id: BACK, kind: paid ? "transfer" : "income", status: "confirmed", transfer_peer_id: null, amount: paid || 50_000, account_id: GCASH, occurred_at: "2026-11-26T02:00:00Z" },
  ] as Row[],
  loans: [{ id: LOAN, borrower: "Sam", amount: 200_000, lent_on: "2026-11-20", due_on: "2026-12-10", txn_id: TXN, from_kind: "wants" }] as Row[],
  loan_events: (paid ? [{ id: "ev", loan_id: LOAN, kind: "payment", on_date: "2026-11-26", amount: paid, txn_id: BACK, old_due: "2026-11-30", new_due: "2026-12-10" }] : []) as Row[],
});
const edit = (over: Partial<EditInput> = {}): EditInput => ({ id: TXN, merchant: "Sam", amount: "2,000", direction: "out", accountId: GCASH, date: "2026-11-20", time: "10:00", note: "", ...over });
const asLoan = (over: Row = {}) => ({ as: "loan" as const, borrower: "Sam", dueOn: "2026-12-25", from: { kind: "wants" as const, ref: null }, ...over });

describe("editing a loan item", () => {
  it("keeps the loan in step with the item and its details", async () => {
    const w = world();
    const r = await editTransaction(fakeDb(w), edit({ amount: "2,500", accountId: MAYA, date: "2026-11-21", lending: asLoan({ borrower: "Sam R." }) }), env);
    expect(r).toEqual({ ok: true });
    expect(w.transactions[0]).toMatchObject({ amount: -250_000, account_id: MAYA, kind: "transfer" });
    expect(w.loans[0]).toMatchObject({ amount: 250_000, lent_on: "2026-11-21", account_id: MAYA, borrower: "Sam R.", due_on: "2026-12-25" });
  });

  it("follows the amount even when no lending details are sent", async () => {
    const w = world();
    expect(await editTransaction(fakeDb(w), edit({ amount: "1,800" }), env)).toEqual({ ok: true });
    expect(w.loans[0]).toMatchObject({ amount: 180_000, borrower: "Sam", due_on: "2026-12-10" });
  });

  it("changes nothing when the loan would be smaller than what was paid back", async () => {
    const w = world(150_000);
    const r = await editTransaction(fakeDb(w), edit({ amount: "1,000" }), env);
    expect(r).toMatchObject({ error: expect.stringContaining("already been paid back") });
    expect(w.transactions[0]!.amount).toBe(-200_000);
    expect(w.loans[0]!.amount).toBe(200_000);
  });

  it("keeps a payback in step, up to what the loan was for", async () => {
    const w = world(50_000);
    const back = { id: BACK, direction: "in" as const, date: "2026-11-26" };
    expect(await editTransaction(fakeDb(w), edit({ ...back, amount: "700" }), env)).toEqual({ ok: true });
    expect(w.loan_events[0]).toMatchObject({ amount: 70_000 });
    expect(await editTransaction(fakeDb(w), edit({ ...back, amount: "2,001" }), env)).toHaveProperty("error");
    expect(w.loan_events[0]!.amount).toBe(70_000);
  });

  it("removes the loan when the item stops being one, and files it as chosen", async () => {
    const w = world();
    expect(await editTransaction(fakeDb(w), edit({ categoryId: FOOD, lending: { as: "none" } }), env)).toEqual({ ok: true });
    expect(w.loans).toHaveLength(0);
    expect(w.transactions[0]).toMatchObject({ kind: "expense", category_id: FOOD, amount: -200_000 });
  });

  it("will not drop a loan that has paybacks", async () => {
    const w = world(50_000);
    expect(await editTransaction(fakeDb(w), edit({ categoryId: FOOD, lending: { as: "none" } }), env)).toMatchObject({ error: expect.stringContaining("paybacks") });
    expect(w.loans).toHaveLength(1);
    expect(w.transactions[0]!.category_id).toBe("lend");
  });

  it("removing a payback brings back the earlier expected date", async () => {
    const w = world(50_000);
    expect(await editTransaction(fakeDb(w), edit({ id: BACK, amount: "500", direction: "in", date: "2026-11-26", categoryId: null, lending: { as: "none" } }), env)).toEqual({ ok: true });
    expect(w.loan_events).toHaveLength(0);
    expect(w.loans[0]!.due_on).toBe("2026-11-30");
    expect(w.transactions[1]).toMatchObject({ kind: "income" });
  });
});

describe("filing a confirmed item for lending", () => {
  const spent = () => {
    const w = world();
    w.loans.length = 0;
    Object.assign(w.transactions[0]!, { kind: "expense", category_id: FOOD, occurred_at: "2026-11-20T02:00:00Z" });
    return w;
  };

  it("turns spending into a loan", async () => {
    const w = spent();
    expect(await editTransaction(fakeDb(w), edit({ lending: asLoan() }), env)).toEqual({ ok: true });
    expect(w.loans).toHaveLength(1);
    expect(w.loans[0]).toMatchObject({ txn_id: TXN, amount: 200_000, borrower: "Sam" });
    expect(w.transactions[0]).toMatchObject({ kind: "transfer", category_id: "lend" });
  });

  it("turns money in into a payback", async () => {
    const w = world();
    const r = await editTransaction(fakeDb(w), edit({ id: BACK, amount: "500", direction: "in", date: "2026-11-26", lending: { as: "payback", loanId: LOAN, nextDue: "2026-12-25" } }), env);
    expect(r).toEqual({ ok: true });
    expect(w.loan_events[0]).toMatchObject({ loan_id: LOAN, amount: 50_000, txn_id: BACK });
    expect(w.loans[0]!.due_on).toBe("2026-12-25");
  });

  it("only lends money that went out", async () => {
    const w = spent();
    expect(await editTransaction(fakeDb(w), edit({ direction: "in", lending: asLoan() }), env)).toHaveProperty("error");
    expect(w.loans).toHaveLength(0);
  });
});

describe("what is left to take from", () => {
  const changes = [{ lineId: null, amount: -2_000 }, { lineId: "rest", amount: -500 }, { lineId: "food", amount: -300 }];
  const left = leftThisCutoff(changes, new Set(["rest"]));

  it("counts office-day money and earlier loans in the Wants total", () => {
    expect(left.wants(6_000, 800)).toBe(6_000 + 800 - 2_500);
    expect(left.wants(1_000, 0)).toBe(0);
  });

  it("takes only a line's own loans off that line", () => {
    expect(left.line("food", 1_000)).toBe(700);
    expect(left.line("gym", 1_000)).toBe(1_000);
  });
});
