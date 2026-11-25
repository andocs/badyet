import { describe, expect, it } from 'vitest';
import { transactionTime } from './email-time';

// 25 Nov 2026 10:02 AM in Manila is 02:02 UTC.
const T = Date.parse('2026-11-25T02:02:00Z');
const ARRIVED = Date.parse('2026-11-25T03:40:00Z'); // the bank's email reached Gmail an hour and a half later

describe('transactionTime', () => {
  it('reads a written-out date and a 12-hour time as Philippine time', () => {
    expect(transactionTime('Transfer Date: November 25, 2026 10:02 AM')).toBe(T);
    expect(transactionTime('Posted Nov 25th 2026 at 10:02')).toBe(T);
  });
  it('reads day-first, numeric and ISO forms', () => {
    expect(transactionTime('25 November 2026 10:02')).toBe(T);
    expect(transactionTime('Date and time\t11/25/2026 10:02:00 AM')).toBe(T);
    expect(transactionTime('25/11/2026 10:02')).toBe(T);
    expect(transactionTime('2026-11-25 10:02:00')).toBe(T);
  });
  it('handles noon, midnight and the afternoon', () => {
    expect(transactionTime('Nov 25, 2026 12:05 AM')).toBe(Date.parse('2026-11-24T16:05:00Z'));
    expect(transactionTime('Nov 25, 2026 12:05 PM')).toBe(Date.parse('2026-11-25T04:05:00Z'));
    expect(transactionTime('Nov 25, 2026 3:30 PM')).toBe(Date.parse('2026-11-25T07:30:00Z'));
  });
  it('prefers a labelled transaction time over another time in the email', () => {
    const body = 'Your statement is ready as of Nov 26, 2026 9:00 AM.\nTransaction Date/Time\tNovember 25, 2026 10:02 AM';
    expect(transactionTime(body)).toBe(T);
  });
  it('ignores a time that cannot be the transaction: after the email arrived, or days before it', () => {
    expect(transactionTime('Due Dec 25, 2026 10:00 AM', ARRIVED)).toBeNull();
    expect(transactionTime('Nov 10, 2026 10:00 AM', ARRIVED)).toBeNull();
    expect(transactionTime('Nov 25, 2026 10:02 AM', ARRIVED)).toBe(T);
  });
  it('is null when there is no time at all', () => {
    expect(transactionTime('Your transfer was successful. Reference 12345.')).toBeNull();
    expect(transactionTime('Date: Nov 25, 2026')).toBeNull();
  });
});

describe('parseEmail uses the time inside the email', () => {
  it('gives a parsed email the time the transaction happened, not when the email arrived', async () => {
    const { parseEmail } = await import('./email');
    const patterns = [{ id: 'p', source: 'custom' as const, template: 'You sent {amount} to {name}', direction: 'out' as const }];
    const email = { subject: 'Transfer done', text: 'You sent PHP 250.00 to JUAN D\nTransaction Date: November 25, 2026 10:02 AM', postTime: ARRIVED };
    expect(parseEmail('custom', email, patterns)).toMatchObject({ direction: 'out', amount: 25_000, occurredAt: T });
    // No time in the email: nothing is added, so the arrival time is used as before.
    expect(parseEmail('custom', { ...email, text: 'You sent PHP 250.00 to JUAN D' }, patterns)?.occurredAt).toBeUndefined();
  });
});
