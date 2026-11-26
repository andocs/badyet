import { money, mulBp, type Money } from "@/lib/domain/money";

/**
 * SSS employee share, from the schedule in SSS Circular No. 2024-006 (effective January 2025, still the current one on sss.gov.ph).
 * The monthly salary credit (MSC) steps in 500-peso brackets: pay below 5,250 is MSC 5,000, 5,250 to 5,749.99 is 5,500, and so on,
 * up to MSC 35,000 for pay of 34,750 and over. The employee pays 5% of the MSC (250 to 1,750): 5% of the first 20,000 is the
 * regular SS share and 5% of the part above 20,000 goes to the member's own MPF account.
 */
export const SSS_MIN_MSC = 500_000; // centavos
export const SSS_MAX_MSC = 3_500_000;
export const SSS_EMPLOYEE_BP = 500;

/** The monthly salary credit for a month's compensation (centavos). */
export function sssMonthlySalaryCredit(monthlyPay: Money): Money {
  // Each bracket is centred on its MSC: compensation from MSC - 250 up to MSC + 249.99 belongs to it.
  const stepped = Math.floor((monthlyPay + 25_000) / 50_000) * 50_000;
  return money(Math.min(SSS_MAX_MSC, Math.max(SSS_MIN_MSC, stepped)));
}

/** The salary credit up to which contributions are regular SS; the part above it is the MPF. */
export const SSS_REGULAR_MAX_MSC = 2_000_000;

/** The employee's regular SS share a month: 5% of the salary credit up to 20,000, so 1,000 at most. This is the payslip's SSS line. */
export function sssRegular(monthlyPay: Money): Money {
  return mulBp(money(Math.min(sssMonthlySalaryCredit(monthlyPay), SSS_REGULAR_MAX_MSC)), SSS_EMPLOYEE_BP);
}

/** The employee's MPF share a month: 5% of the salary credit above 20,000, so 750 at most. This is the SSS PenBoost line. */
export function sssMpf(monthlyPay: Money): Money {
  return money(sssEmployee(monthlyPay) - sssRegular(monthlyPay));
}

/** What the employee pays SSS a month in all (regular SS plus the MPF part), from the monthly pay. */
export function sssEmployee(monthlyPay: Money): Money {
  return mulBp(sssMonthlySalaryCredit(monthlyPay), SSS_EMPLOYEE_BP);
}

/**
 * Pag-IBIG employee share: 2% of the monthly fund salary, which is capped at 10,000 since February 2024 (Circular No. 460), so 200
 * at most. Members earning 1,500 or less pay 1%.
 */
export const PAGIBIG_MAX_FUND_SALARY = 1_000_000;

export function pagibigEmployee(monthlyPay: Money): Money {
  const fundSalary = Math.min(monthlyPay, PAGIBIG_MAX_FUND_SALARY);
  return mulBp(money(fundSalary), monthlyPay <= 150_000 ? 100 : 200);
}
