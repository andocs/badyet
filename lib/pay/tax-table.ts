import { money } from "@/lib/domain/money";
import type { TaxRow } from "@/lib/domain/pay";

// Philippine TRAIN annual income tax brackets, as used by the old app.
// The schedule in force from 1 Jan 2023. Checked in Nov 2026 against several published 2026 guides
// (they all show these brackets); not checked against a BIR issuance. Amounts are in centavos.
const p = (pesos: number) => money(pesos * 100);

export const TAX_ROWS: readonly TaxRow[] = [
  { lower: p(0), upper: p(250_000), fixed: p(0), rateBp: 0 },
  { lower: p(250_000), upper: p(400_000), fixed: p(0), rateBp: 1500 },
  { lower: p(400_000), upper: p(800_000), fixed: p(22_500), rateBp: 2000 },
  { lower: p(800_000), upper: p(2_000_000), fixed: p(102_500), rateBp: 2500 },
  { lower: p(2_000_000), upper: p(8_000_000), fixed: p(402_500), rateBp: 3000 },
  { lower: p(8_000_000), upper: null, fixed: p(2_202_500), rateBp: 3500 },
];

// PhilHealth lives in ./philhealth.ts (2.5% employee share with a 10,000 floor and 100,000 ceiling).
