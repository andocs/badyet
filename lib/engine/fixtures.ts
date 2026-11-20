import { yearMonth } from "@/lib/domain/dates";
import { money } from "@/lib/domain/money";
import type { Allowance, Assumptions, PaySettings, SalaryEvent } from "./types";

// Synthetic figures for tests (not real data).
export const p = (pesos: number) => money(Math.round(pesos * 100));
export const ym = yearMonth;

export const noAssumptions: Assumptions = { cipMultiplierNum: 125, assumedRaiseOn: false, assumedRaiseBp: 0, assumedRaiseMonth: 3 };

export const settings: PaySettings = {
  sssOverride: p(1_750),
  philhealthOverride: null,
  pagibigOverride: p(200),
  taxOverrideFirst: null,
  taxOverrideSecond: null,
  otherDeduction: money(0),
  savingsPlanBp: 0,
};

export const startEvent: SalaryEvent = { id: "start", effectiveMonth: ym("2026-01"), kind: "start", newBase: p(50_000), status: "confirmed" };

export const allowance2: Allowance = {
  id: "al2",
  payslipCutoff: "second",
  name: "Allowance",
  amount: p(2_000),
  frequency: "monthly",
  taxable: false,
  startsOn: ym("2026-01"),
};
