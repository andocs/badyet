import { describe, expect, it } from 'vitest';
import { allowance2, p, settings, startEvent, ym } from '@/lib/engine/fixtures';
import { buildMonthPay, defaultTemplate } from '@/lib/engine/payslip';
import { salaryAt } from '@/lib/salary/view';
import type { PayslipEdit } from '@/lib/engine/types';
import { changedKeys, monthChanges, type BuilderLayout } from './month-edits';

const input = { events: [startEvent], allowances: [allowance2], assumptions: { on: false, assumedRaiseOn: false, assumedRaiseBp: 0, assumedRaiseMonth: 7, cipMultiplierNum: 100 }, settings, templates: [], bonusRules: [], bonusInstances: [] } as never;
const pay = (month: string, edits: PayslipEdit[]) => buildMonthPay(salaryAt(input, ym(month)), { ...settings, monthEdits: edits }, []);
const line = (m: ReturnType<typeof pay>, cutoff: 'first' | 'second', source: string) => m[cutoff].lines.find((l) => l.source === source)!;
const edit = (source: string, amount: number | null, over: Partial<PayslipEdit> = {}): PayslipEdit => ({ month: ym('2027-03'), cutoff: 'second', source, label: source, amount: amount === null ? null : p(amount), ...over });

describe('this month only, on the payslip', () => {
  it('changes the income tax of that month and cutoff only, and take-home follows', () => {
    const plain = pay('2027-03', []);
    const m = pay('2027-03', [edit('income_tax', 1_000)]);
    expect(line(m, 'second', 'income_tax')).toMatchObject({ amount: p(1_000), edited: true });
    expect(line(m, 'first', 'income_tax')).toEqual(line(plain, 'first', 'income_tax'));
    expect(m.second.takeHome).toBe(plain.second.takeHome + line(plain, 'second', 'income_tax').amount - p(1_000));
    expect(pay('2027-04', [edit('income_tax', 1_000)])).toEqual(pay('2027-04', []));
  });
  it('wins over a tax amount set for every month, and null goes back to the calculated amount', () => {
    const m = buildMonthPay(salaryAt(input, ym('2027-03')), { ...settings, taxOverrideSecond: p(9_000), monthEdits: [edit('income_tax', 500)] }, []);
    expect(line(m, 'second', 'income_tax').amount).toBe(p(500));
    const typed = { ...defaultTemplate('second'), effectiveMonth: ym('2027-01'), lines: defaultTemplate('second').lines.map((l) => (l.source === 'philhealth' ? { ...l, amountOverride: p(1) } : l)) };
    const back = buildMonthPay(salaryAt(input, ym('2027-03')), { ...settings, monthEdits: [edit('philhealth', null)] }, [], [typed]);
    expect(line(back, 'second', 'philhealth').amount).toBe(line(pay('2027-03', []), 'second', 'philhealth').amount);
  });
  it('works the tax from a contribution changed for that month', () => {
    const plain = pay('2027-03', []);
    const m = pay('2027-03', [edit('pagibig', 5_000)]);
    expect(m.taxableSecond).toBe(plain.taxableSecond - (p(5_000) - line(plain, 'second', 'pagibig').amount));
    expect(line(m, 'second', 'income_tax').amount).toBeLessThan(line(plain, 'second', 'income_tax').amount);
  });
});

describe('monthChanges', () => {
  const layout = (): BuilderLayout => ({ first: [...defaultTemplate('first').lines], second: [...defaultTemplate('second').lines] });
  const change = (to: number | null, source = 'income_tax') => {
    const now = layout();
    return { ...now, second: now.second.map((l) => (l.source === source ? { ...l, amountOverride: to } : l)) };
  };
  it('saves only the amounts that changed', () => {
    expect(monthChanges(layout(), change(123))).toEqual({ ok: true, value: [{ cutoff: 'second', source: 'income_tax', label: 'Income tax', amount: 123 }] });
    expect([...changedKeys(layout(), change(123))]).toEqual(['second|income_tax']);
  });
  it('refuses when nothing changed, or when the layout itself changed', () => {
    expect(monthChanges(layout(), layout())).toMatchObject({ ok: false });
    const moved = { ...layout(), second: layout().second.slice(1) };
    expect(monthChanges(layout(), moved)).toMatchObject({ ok: false });
  });
});
