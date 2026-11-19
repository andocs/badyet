import { describe, expect, it } from 'vitest';
import { isoDate } from './dates';
import { financedAmount, paymentAmounts, remainingPayments, schedule } from './instalments';
import { parsePesos, sum } from './money';
import type { Money } from './money';
import { netCutoff, netMonth, percentOfBasic } from './pay';
import type { PayItem, TaxRow } from './pay';
import { allocatedTotal, cipGross, eventRemaining, windfallNet } from './windfall';

const p = (text: string): Money => {
  const v = parsePesos(text);
  if (v === undefined) throw new Error(text);
  return v;
};

// Sheet constants (unverified against official tables; stored as dated rule rows in the app).
const TRAIN: TaxRow[] = [
  { lower: p('0'), upper: p('250000'), fixed: p('0'), rateBp: 0 },
  { lower: p('250000'), upper: p('400000'), fixed: p('0'), rateBp: 1500 },
  { lower: p('400000'), upper: p('800000'), fixed: p('22500'), rateBp: 2000 },
  { lower: p('800000'), upper: p('2000000'), fixed: p('102500'), rateBp: 2500 },
  { lower: p('2000000'), upper: p('8000000'), fixed: p('402500'), rateBp: 3000 },
  { lower: p('8000000'), upper: null, fixed: p('2202500'), rateBp: 3500 },
];

const basic = p('30557.50');
const philhealth = percentOfBasic(basic, 500);
const planEach = percentOfBasic(basic, 600);

const items: PayItem[] = [
  { name: 'Basic', kind: 'earning_taxable', amount: basic, scope: 'both' },
  { name: 'Allowances', kind: 'earning_nontaxable', amount: p('2400'), scope: 'second' },
  { name: 'SSS', kind: 'deduction', amount: p('1750'), scope: 'second' },
  { name: 'PhilHealth', kind: 'deduction', amount: philhealth, scope: 'second' },
  { name: 'Pag-IBIG', kind: 'deduction', amount: p('200'), scope: 'second' },
  { name: 'Savings Plan', kind: 'contribution', amount: planEach, scope: 'both' },
];

describe('pay (V-P1..V-P4)', () => {
  it('V-P1 first cutoff', () => {
    const a = netCutoff(items, 'first', TRAIN);
    expect(a.tax).toBe(p('3715.67'));
    expect(a.netBeforePlan).toBe(p('26841.83'));
  });

  it('V-P2 second cutoff', () => {
    const b = netCutoff(items, 'second', TRAIN);
    expect(philhealth).toBe(p('1527.88'));
    expect(b.tax).toBe(p('3020.09'));
    expect(b.netBeforePlan).toBe(p('26459.53'));
  });

  it('V-P3 month is the sum of cutoffs (53,301.36)', () => {
    expect(netMonth(items, TRAIN).netBeforePlan).toBe(p('53301.36'));
  });

  it('V-P4 Savings Plan 3,666.90; take-home 49,634.46', () => {
    const m = netMonth(items, TRAIN);
    expect(m.plan).toBe(p('3666.90'));
    expect(m.takeHome).toBe(p('49634.46'));
  });
});

describe('windfall (V-W1..V-W3)', () => {
  it('V-W1 CIP gross', () => {
    expect(
      cipGross(p('688380'), { numerator: 1_381_505, denominator: 10_000_000 }, { numerator: 125, denominator: 100 }),
    ).toBe(p('118875.05'));
  });

  it('V-W2 allocations leave 0.04', () => {
    const allocs = [
      { eventId: 'cip-2026', amount: p('80046'), done: true },
      { eventId: 'cip-2026', amount: p('20000'), done: false },
      { eventId: 'cip-2026', amount: p('15054'), done: false },
    ];
    expect(eventRemaining('cip-2026', p('115100.04'), allocs)).toBe(p('0.04'));
  });

  it('V-W3 other events and done flags never change remaining', () => {
    const allocs = [
      { eventId: 'sept', amount: p('25000'), done: true },
      { eventId: '13th', amount: p('0.01'), done: false },
    ];
    expect(eventRemaining('13th', p('48892.01'), allocs)).toBe(p('48892'));
    expect(allocatedTotal('sept', allocs)).toBe(p('25000'));
    expect(windfallNet(p('100'), p('40'))).toBe(p('60'));
  });
});

describe('instalments (V-I1..V-I3)', () => {
  it('V-I1 20,000 at 6% over 60 months', () => {
    const pays = paymentAmounts({ price: p('20000'), termCount: 60, rateBp: 600, firstDueOn: null });
    expect(pays).toHaveLength(60);
    expect(pays.slice(0, 59).every((x) => x === p('386.66'))).toBe(true);
    expect(pays[59]).toBe(p('386.42'));
    expect(sum(pays)).toBe(p('23199.36'));
  });

  it('V-I2 no rate, last payment absorbs', () => {
    const pays = paymentAmounts({ price: p('12000'), termCount: 7, rateBp: null, firstDueOn: null });
    expect(pays[0]).toBe(p('1714.28'));
    expect(pays[6]).toBe(p('1714.32'));
  });

  it('down payment reduces the financed amount', () => {
    const plan = { price: p('20000'), downPayment: p('5000'), termCount: 3, rateBp: null, firstDueOn: null };
    expect(financedAmount(plan)).toBe(p('15000'));
  });

  it('planned plans have no schedule; bad input throws', () => {
    expect(schedule({ price: p('100'), termCount: 2, rateBp: null, firstDueOn: null })).toEqual([]);
    expect(() => paymentAmounts({ price: p('100'), termCount: 0, rateBp: null, firstDueOn: null })).toThrow(RangeError);
    expect(() => paymentAmounts({ price: p('0'), termCount: 2, rateBp: null, firstDueOn: null })).toThrow(RangeError);
  });

  it('V-I3 remaining payments are counted by due date', () => {
    const s = schedule({ price: p('3000'), termCount: 2, rateBp: null, firstDueOn: isoDate('2026-11-09') });
    expect(s.map((x) => x.dueOn)).toEqual(['2026-11-09', '2026-12-09']);
    expect(remainingPayments(s, isoDate('2026-10-25'))).toHaveLength(2);
    expect(remainingPayments(s, isoDate('2026-10-25'), new Set([1]))).toHaveLength(1);
  });
});
