import { describe, expect, it } from "vitest";
import { p } from "@/lib/engine/fixtures";
import { duplicatedBy, type RecordedTransfer } from "./reconcile";

const T = Date.parse("2026-11-25T02:00:00Z");
const rec = (id: string, amount: number, minutes = 0, to = "gcash"): RecordedTransfer => ({ outId: `${id}o`, inId: `${id}i`, fromId: "bpi", toId: to, amount: p(amount), at: T + minutes * 60_000 });
const det = (amount: number, minutes = 5, to = "gcash") => ({ fromId: "bpi", toId: to, amount: p(amount), at: T + minutes * 60_000 });

describe("a detected transfer that is one you already ticked", () => {
  it("matches a single recorded transfer between the same accounts", () => {
    expect(duplicatedBy(det(5_299), [rec("a", 5_299)])?.map((r) => r.outId)).toEqual(["ao"]);
  });
  it("matches when a few lines were ticked one by one and the bank sent one lump", () => {
    const lines = [rec("a", 2_400), rec("b", 2_000), rec("c", 899)];
    expect(duplicatedBy(det(5_299), lines)?.map((r) => r.outId)).toEqual(["ao", "bo", "co"]);
  });
  it("is a new transfer when the amount, accounts or day differ", () => {
    expect(duplicatedBy(det(5_300.5), [rec("a", 5_299)])).toBeNull();
    expect(duplicatedBy(det(5_299, 5, "maya"), [rec("a", 5_299)])).toBeNull();
    expect(duplicatedBy(det(5_299, 26 * 60), [rec("a", 5_299)])).toBeNull();
  });
  it("allows a peso of difference", () => {
    expect(duplicatedBy(det(5_298.5), [rec("a", 5_299)])).not.toBeNull();
  });
});
