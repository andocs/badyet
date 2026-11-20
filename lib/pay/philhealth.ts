import { divRound, max, min, mulBp, money, type Money } from "@/lib/domain/money";

// PhilHealth, employed members: the premium is 5% of basic monthly salary, split equally with the employer,
// so the employee pays 2.5%. Salary below 10,000 is treated as 10,000 and above 100,000 as 100,000, which
// keeps the employee share between 250 and 2,500 a month.
// Checked in Nov 2026 against several published 2026 guides (not against a PhilHealth circular).
export const PHILHEALTH_EMPLOYEE_BP = 250;
export const PHILHEALTH_FLOOR: Money = money(1_000_000); // 10,000 pesos, in centavos
export const PHILHEALTH_CEILING: Money = money(10_000_000); // 100,000 pesos, in centavos

// The whole month's employee share (the app takes it in the 2nd cutoff, as the old sheet did).
export function philhealthMonthly(annualBase: Money): Money {
  const monthlyBasic = divRound(annualBase, 12);
  return mulBp(min(max(monthlyBasic, PHILHEALTH_FLOOR), PHILHEALTH_CEILING), PHILHEALTH_EMPLOYEE_BP);
}
