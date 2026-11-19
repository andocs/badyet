import { describe, expect, it } from "vitest";
import { money } from "@/lib/domain/money";
import { bucketTotal, summarize, type Line } from "./summary";

const p = (pesos: number) => money(pesos * 100);
const lines: Line[] = [
  { id: "1", cutoff: "first", bucket: "essentials", name: "Food", amount: p(2_000) },
  { id: "2", cutoff: "first", bucket: "essentials", name: "Rent", amount: p(3_000) },
  { id: "3", cutoff: "first", bucket: "wants", name: "Fun", amount: p(1_000) },
  { id: "4", cutoff: "first", bucket: "savings", name: "Emergency", amount: p(-500) }, // a reimbursement-style negative
  { id: "5", cutoff: "second", bucket: "essentials", name: "Food", amount: p(2_000) },
];

describe("summarize", () => {
  it("totals buckets per cutoff", () => {
    expect(bucketTotal(lines, "first", "essentials")).toBe(p(5_000));
    expect(bucketTotal(lines, "first", "wants")).toBe(p(1_000));
    expect(bucketTotal(lines, "second", "savings")).toBe(0);
  });
  it("computes left to budget per cutoff and for the month", () => {
    const s = summarize(lines, p(10_000), p(4_000));
    expect(s.first.total).toBe(p(5_000 + 1_000 - 500));
    expect(s.first.left).toBe(p(10_000 - 5_500));
    expect(s.second.left).toBe(p(2_000));
    expect(s.month.net).toBe(p(14_000));
    expect(s.month.total).toBe(p(7_500));
    expect(s.month.left).toBe(p(6_500));
  });
  it("goes negative when over budget", () => {
    const s = summarize(lines, p(3_000), p(4_000));
    expect(s.first.left).toBe(p(3_000 - 5_500));
    expect(s.first.left < 0).toBe(true);
  });
});
