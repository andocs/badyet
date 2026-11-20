import { describe, expect, it } from "vitest";
import { balanceNow } from "./balances";
import { p } from "./fixtures";

const anchors = [
  { asOf: "2027-03-01T00:00:00+08:00", amount: p(10_000) },
  { asOf: "2027-03-10T00:00:00+08:00", amount: p(12_000) },
];

describe("balanceNow", () => {
  it("is the latest anchor plus confirmed transactions after it", () => {
    const txns = [
      { occurredAt: "2027-03-05T10:00:00+08:00", amount: p(-500), status: "confirmed" as const }, // before the latest anchor: already in it
      { occurredAt: "2027-03-11T10:00:00+08:00", amount: p(-250), status: "confirmed" as const },
      { occurredAt: "2027-03-12T10:00:00+08:00", amount: p(1_000), status: "confirmed" as const },
      { occurredAt: "2027-03-12T11:00:00+08:00", amount: p(-999), status: "pending" as const },
      { occurredAt: "2027-03-12T12:00:00+08:00", amount: p(-777), status: "ignored" as const },
    ];
    expect(balanceNow(anchors, txns)).toBe(p(12_750));
  });

  it("starts from zero without an anchor, and is the anchor alone without transactions", () => {
    expect(balanceNow([], [{ occurredAt: "2027-03-12T10:00:00+08:00", amount: p(-100), status: "confirmed" }])).toBe(p(-100));
    expect(balanceNow(anchors, [])).toBe(p(12_000));
  });
});
