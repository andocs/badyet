import { describe, expect, it } from "vitest";
import { p } from "@/lib/engine/fixtures";
import { pagibigEmployee, sssEmployee, sssMonthlySalaryCredit } from "./contributions";

// Rows read off SSS Circular No. 2024-006 (effective January 2025): [pay, MSC, employee total].
const SSS_ROWS: [number, number, number][] = [
  [3_000, 5_000, 250],
  [5_249.99, 5_000, 250],
  [5_250, 5_500, 275],
  [10_000, 10_000, 500],
  [14_749.99, 14_500, 725],
  [14_750, 15_000, 750],
  [20_000, 20_000, 1_000],
  [20_250, 20_500, 1_025],
  [25_000, 25_000, 1_250],
  [29_750, 30_000, 1_500],
  [34_749.99, 34_500, 1_725],
  [34_750, 35_000, 1_750],
  [80_000, 35_000, 1_750],
];

describe("SSS employee share", () => {
  it.each(SSS_ROWS)("pay %s -> MSC %s, employee %s", (pay, msc, ee) => {
    expect(sssMonthlySalaryCredit(p(pay))).toBe(p(msc));
    expect(sssEmployee(p(pay))).toBe(p(ee));
  });
});

describe("Pag-IBIG employee share", () => {
  it("is 2% of pay up to a 10,000 fund salary, so 200 at most", () => {
    expect(pagibigEmployee(p(5_000))).toBe(p(100));
    expect(pagibigEmployee(p(10_000))).toBe(p(200));
    expect(pagibigEmployee(p(80_000))).toBe(p(200));
  });
  it("is 1% for pay of 1,500 or less", () => {
    expect(pagibigEmployee(p(1_500))).toBe(p(15));
  });
});
