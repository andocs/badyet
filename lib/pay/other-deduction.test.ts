import { describe, expect, it } from 'vitest';
import { otherDeductionDrafts, validateOtherDeductions } from './other-deduction';

const row = (over: Record<string, unknown>) => ({ label: 'HMO', cutoff: 'both', amount: '10', amountSecond: '', ...over });

describe('validateOtherDeductions', () => {
  it('takes a name, a cutoff and an amount for each', () => {
    expect(validateOtherDeductions({ items: [row({ label: '  HMO   plan ', cutoff: 'first', amount: '1,250.50' })] })).toEqual({
      ok: true,
      value: [{ label: 'HMO plan', cutoff: 'first', amount: 125_050, amountSecond: null }],
    });
  });
  it('lets the 2nd cutoff differ when the deduction is on both', () => {
    expect(validateOtherDeductions({ items: [row({ label: 'Loan', amount: '500', amountSecond: '800' })] })).toEqual({
      ok: true,
      value: [{ label: 'Loan', cutoff: 'both', amount: 50_000, amountSecond: 80_000 }],
    });
    // The 2nd amount means nothing when it is on one cutoff only.
    expect(validateOtherDeductions({ items: [row({ cutoff: 'second', amount: '500', amountSecond: '800' })] })).toMatchObject({ ok: true, value: [{ amountSecond: null }] });
  });
  it('skips empty rows and accepts an empty list', () => {
    expect(validateOtherDeductions({ items: [row({ label: '', amount: '' })] })).toEqual({ ok: true, value: [] });
    expect(validateOtherDeductions({ items: [] })).toEqual({ ok: true, value: [] });
  });
  it('refuses a long name, a missing or unreadable amount, or too many rows', () => {
    expect(validateOtherDeductions({ items: [row({ label: 'x'.repeat(31) })] })).toMatchObject({ ok: false });
    expect(validateOtherDeductions({ items: [row({ amount: '' })] })).toMatchObject({ ok: false });
    expect(validateOtherDeductions({ items: [row({ amount: 'lots' })] })).toMatchObject({ ok: false });
    expect(validateOtherDeductions({ items: Array.from({ length: 9 }, () => row({})) })).toMatchObject({ ok: false });
  });
});

describe('otherDeductionDrafts', () => {
  it('turns the old single deduction into one row on both cutoffs', () => {
    expect(otherDeductionDrafts({ otherDeduction: 120_000 as never, otherDeductionLabel: 'HMO', otherDeductions: [] })).toEqual([
      { label: 'HMO', cutoff: 'both', amount: '1200.00', amountSecond: '' },
    ]);
  });
});
