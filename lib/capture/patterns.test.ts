import { describe, expect, it } from 'vitest';
import { canParse, parseNotification } from './parsers';
import { patternsFromRows, validatePattern, type CapturePattern } from './patterns';

const note = (text: string) => ({ title: null, text, bigText: null });
const mine = (source: CapturePattern['source'], template: string, direction: 'in' | 'out' = 'in'): CapturePattern => ({ id: 'p1', source, template, direction });

describe('your own patterns', () => {
  it('read an app that has no built-in reader', () => {
    const p = [mine('custom', 'Salary of {amount} from {name} credited', 'in')];
    expect(canParse('custom')).toBe(false);
    expect(canParse('custom', p)).toBe(true);
    expect(parseNotification('custom', note('Salary of PHP 25,000.00 from ACME Corp credited'), p)).toMatchObject({ source: 'custom', direction: 'in', amount: 2_500_000, counterparty: 'ACME Corp' });
  });
  it('win over the built-in reader for the same source', () => {
    const text = 'You have received 900.00 of GCash from BPI / VYBE by BPI with account ending in 8167.';
    const p = [mine('gcash', 'got {amount}', 'out')];
    expect(parseNotification('gcash', note(text), [])).toMatchObject({ direction: 'in', amount: 90_000 });
    expect(parseNotification('gcash', note('got 5.00 today'), p)).toMatchObject({ direction: 'out', amount: 500 });
    expect(parseNotification('gcash', note(text), p)).toMatchObject({ direction: 'in', amount: 90_000 });
  });
  it('take the digits and reference you asked for', () => {
    const p = [mine('custom', 'acct {last4} debited {amount} ref {ref}', 'out')];
    expect(parseNotification('custom', note('Acct XX8167 debited 12.50 Ref Z9'), p)).toMatchObject({ accountHint: '8167', ref: 'Z9', amount: 1_250 });
  });
  it('ignore other sources and messages that do not fit', () => {
    const p = [mine('maya', 'got {amount}')];
    expect(parseNotification('custom', note('got 5.00'), p)).toBeNull();
    expect(parseNotification('maya', note('hello'), p)).toBeNull();
  });
  it('validate what you typed', () => {
    expect(validatePattern({ source: 'custom', template: '  paid   {amount}  to {name} ', direction: 'out' })).toEqual({ ok: true, value: { source: 'custom', template: 'paid {amount} to {name}', direction: 'out' } });
    expect(validatePattern({ source: 'nope', template: 'paid {amount}', direction: 'out' })).toMatchObject({ ok: false });
    expect(validatePattern({ source: 'custom', template: 'paid {amount}', direction: 'sideways' })).toMatchObject({ ok: false });
    expect(validatePattern({ source: 'custom', template: 'paid', direction: 'in' })).toMatchObject({ ok: false });
  });
  it('drop saved rows that no longer compile', () => {
    expect(patternsFromRows([{ id: '1', source: 'custom', template: 'x', direction: 'in' }, { id: '2', source: 'custom', template: 'paid {amount}', direction: 'in' }])).toHaveLength(1);
  });
});
