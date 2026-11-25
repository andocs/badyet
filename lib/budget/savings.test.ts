import { describe, expect, it } from "vitest";
import type { IsoDate } from "@/lib/domain/dates";
import { p } from "@/lib/engine/fixtures";
import { savingsByMonth } from "./savings";

const d = (s: string) => s as IsoDate;
const paydays = { first: 10, second: 25 };

describe("savingsByMonth", () => {
  it("adds up settle_to_savings by the month the cutoff started in", () => {
    const pools = [{ entries: [
      { kind: "settle_to_savings", amount: p(100), occurredOn: d("2027-03-12") },
      { kind: "settle_to_savings", amount: p(50), occurredOn: d("2027-03-26") },
      { kind: "settle_to_savings", amount: p(25), occurredOn: d("2027-04-03") }, // still the March 2nd cutoff (25 Mar to 9 Apr)
      { kind: "settle_to_wants", amount: p(999), occurredOn: d("2027-03-12") },
    ] }];
    expect(savingsByMonth(pools, paydays)).toEqual({ "2027-03": p(175) });
  });
  it("is empty when nothing was settled to savings", () => {
    expect(savingsByMonth([{ entries: [] }], paydays)).toEqual({});
  });
});
