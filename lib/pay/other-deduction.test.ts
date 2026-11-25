import { describe, expect, it } from 'vitest';
import { validateOtherDeduction } from './other-deduction';

describe('validateOtherDeduction', () => {
  it('takes a name and a per-cutoff amount in pesos', () => {
    expect(validateOtherDeduction({ label: '  HMO   plan ', amount: '1,250.50' })).toEqual({ ok: true, value: { label: 'HMO plan', amount: 125_050 } });
  });
  it('turns it off with an empty amount, and uses the default name when none is given', () => {
    expect(validateOtherDeduction({ label: '', amount: '' })).toEqual({ ok: true, value: { label: null, amount: 0 } });
  });
  it('refuses a long name or an unreadable amount', () => {
    expect(validateOtherDeduction({ label: 'x'.repeat(31), amount: '10' })).toEqual({ ok: false, error: 'Keep the name under 30 characters.' });
    expect(validateOtherDeduction({ label: 'HMO', amount: 'lots' })).toMatchObject({ ok: false });
    expect(validateOtherDeduction({ label: 'HMO', amount: '-5' })).toMatchObject({ ok: false });
  });
});
