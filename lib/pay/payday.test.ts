import { describe, expect, it } from "vitest";
import type { YearMonth } from "@/lib/domain/dates";
import { bonusesLanding, payRecorded, PAY_MERCHANT, type BonusRuleLite } from "./payday";

const rules: BonusRuleLite[] = [
  { name: "13th month", recurrence: "yearly", pay_month: 12, once_on: null, payslip_cutoff: "first" },
  { name: "CIP", recurrence: "yearly", pay_month: 3, once_on: null, payslip_cutoff: "second" },
  { name: "Signing", recurrence: "once", pay_month: 1, once_on: "2026-12-01", payslip_cutoff: "first" },
];

describe("payday", () => {
  it("names the bonuses paid with this month's pay on this cutoff", () => {
    expect(bonusesLanding(rules, "2026-12" as YearMonth, "first")).toEqual(["13th month", "Signing"]);
    expect(bonusesLanding(rules, "2026-12" as YearMonth, "second")).toEqual([]);
    expect(bonusesLanding(rules, "2027-03" as YearMonth, "second")).toEqual(["CIP"]);
  });
  it("knows when this cutoff's pay is already in", () => {
    expect(payRecorded([{ kind: "income", status: "confirmed", merchant: PAY_MERCHANT }])).toBe(true);
    expect(payRecorded([{ kind: "income", status: "ignored", merchant: PAY_MERCHANT }])).toBe(false);
    expect(payRecorded([{ kind: "income", status: "confirmed", merchant: "InstaPay" }])).toBe(false);
  });
});
