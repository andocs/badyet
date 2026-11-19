import { money } from "@/lib/domain/money";
import type { TaxRow } from "@/lib/domain/pay";

// Philippine TRAIN annual income tax brackets, as used by the old app.
// UNVERIFIED: labelled effective 1 Jan 2023 and not re-checked against current BIR tables
// (see PROJECT_STATE open question Q1/Q2). Amounts are in centavos.
const p = (pesos: number) => money(pesos * 100);

export const TAX_ROWS: readonly TaxRow[] = [
  { lower: p(0), upper: p(250_000), fixed: p(0), rateBp: 0 },
  { lower: p(250_000), upper: p(400_000), fixed: p(0), rateBp: 1500 },
  { lower: p(400_000), upper: p(800_000), fixed: p(22_500), rateBp: 2000 },
  { lower: p(800_000), upper: p(2_000_000), fixed: p(102_500), rateBp: 2500 },
  { lower: p(2_000_000), upper: p(8_000_000), fixed: p(402_500), rateBp: 3000 },
  { lower: p(8_000_000), upper: null, fixed: p(2_202_500), rateBp: 3500 },
];

// PhilHealth as the old app modelled it: 5% of the semi-monthly basic. UNVERIFIED (no cap applied).
export const PHILHEALTH_BP = 500;
