import { describe, expect, it } from 'vitest';
import { canParse, matchText, parseNotification, type RawNotification } from './parsers';

const n = (title: string, text: string, bigText: string | null = null): RawNotification => ({ title, text, bigText });

// Texts below come from the real notifications in docs/expo-samples.md (names and numbers redacted).
describe('GCash', () => {
  it('money in, with the sender cut off by the notification', () => {
    expect(parseNotification('gcash', n('You have received money in GCash!', 'You have received 1500.00 of GCash from China Bank Sa..'))).toMatchObject({
      source: 'gcash', direction: 'in', amount: 150_000, counterparty: 'China Bank Sa',
    });
  });
  it('money in with the full text: sender, their account digits and the reference', () => {
    const body = 'You have received 900.00 of GCash from BPI / VYBE by BPI with account ending in 8167. Your new balance is 1032.41 11-10-26 07:19 AM. Ref. No. 20261110BOPIPHMMXXXB000071916652428. Use now to buy load.';
    expect(parseNotification('gcash', n('GCash Funds Received', body))).toEqual({
      source: 'gcash', direction: 'in', amount: 90_000, counterparty: 'BPI / VYBE by BPI', counterpartyLast4: '8167', accountHint: null, ref: '20261110BOPIPHMMXXXB000071916652428', accountName: null,
    });
  });
  it('a payment includes the convenience fee, since that left the wallet too', () => {
    const body = 'You have paid P112.00 of GCash to purchase NEW POWER ALL FB + BINGE 109 with a convenience fee of P3.00 for 09694559502 on 09-23-26 08:55 AM. Your GCash balance is P22.41. Ref. No. 111913449.';
    expect(parseNotification('gcash', n('Your Buy Load Transaction Update', body))).toMatchObject({
      direction: 'out', amount: 11_500, counterparty: 'NEW POWER ALL FB + BINGE 109', ref: '111913449',
    });
  });
  it('Express Send: keeps the masked name and drops the phone number', () => {
    const body = 'You have sent PHP 500.00 to LU*******A D. +639328497018 on 10-23-2026 09:29 AM with MSG: . Your new balance is PHP 423.41. Ref. No. 1046430918200.';
    const p = parseNotification('gcash', n('Express Send Notification', body))!;
    expect(p).toMatchObject({ direction: 'out', amount: 50_000, counterparty: 'LU*******A D.', ref: '1046430918200' });
    expect(JSON.stringify(p)).not.toContain('639328497018');
  });
  it('prefers the expanded text when it is longer', () => {
    const p = parseNotification('gcash', n('t', 'You have received 900.00 of GCash from BPI / VYBE by BPI with ac..', 'You have received 900.00 of GCash from BPI / VYBE by BPI with account ending in 8167. Ref. No. 77.'));
    expect(p).toMatchObject({ counterpartyLast4: '8167', ref: '77' });
  });
});

describe('Maya', () => {
  it('money out and money in', () => {
    expect(parseNotification('maya', n('Money transferred', 'Success! You transferred ₱50.00 to BPI / VYBE by BPI.'))).toMatchObject({ direction: 'out', amount: 5_000, counterparty: 'BPI / VYBE by BPI' });
    expect(parseNotification('maya', n('Money received', 'You received ₱1.00 from Maya Savings'))).toMatchObject({ direction: 'in', amount: 100, counterparty: 'Maya Savings' });
    expect(parseNotification('maya', n('Money received', 'You received 100 in your wallet via InstaPay'))).toMatchObject({ direction: 'in', amount: 10_000, counterparty: 'InstaPay' });
    expect(parseNotification('maya', n('Money received', 'You received ₱1,250.50 in your wallet via InstaPay.'))).toMatchObject({ direction: 'in', amount: 125_050, counterparty: 'InstaPay' });
    expect(parseNotification('maya', n('Money received', 'You received 100 in your wallet'))).toMatchObject({ direction: 'in', amount: 10_000, counterparty: null });
  });
  it('a card payment received on Maya Black lands on that account', () => {
    expect(parseNotification('maya', n('Payment received', 'Payment of ₱5,000.00 received on your Maya Black'))).toMatchObject({ direction: 'in', amount: 500_000, counterparty: null, accountName: 'Maya Black' });
    expect(parseNotification('maya', n('Payment received', 'Your payment of PHP 1,234.56 has been received for your Maya Black.'))).toMatchObject({ direction: 'in', amount: 123_456, accountName: 'Maya Black' });
  });
});

describe('GoTyme', () => {
  it('money in keeps initials in the name', () => {
    expect(parseNotification('gotyme', n('Transfer received', 'You received ₱1.00 from K. A. T. DOCOT.'))).toMatchObject({ direction: 'in', amount: 100, counterparty: 'K. A. T. DOCOT' });
  });
  it('money out reads the other account digits', () => {
    expect(parseNotification('gotyme', n('Transfer successful', 'You sent P1.00 to Kenneth Docot Bank Of The Philippine Islands (BPI) ••••••8167.'))).toMatchObject({
      direction: 'out', amount: 100, counterparty: 'Kenneth Docot Bank Of The Philippine Islands (BPI)', counterpartyLast4: '8167',
    });
  });
});

describe('MariBank', () => {
  it('money in with the other side digits', () => {
    expect(parseNotification('maribank', n('Successful Incoming Transfer', "You've received PHP 34,990.00 from GrabPay with account ending 4615."))).toMatchObject({
      direction: 'in', amount: 3_499_000, counterparty: 'GrabPay', counterpartyLast4: '4615',
    });
  });
  it('InstaPay out', () => {
    const body = 'An InstaPay transfer of PHP 1.00 to BPI Kenneth Angelo Docot on 21 Nov 2026 12:11 was completed. If unauthorized, please chat with us live on the MariBank app.';
    expect(parseNotification('maribank', n('Successful InstaPay Transfer', body))).toMatchObject({ direction: 'out', amount: 100, counterparty: 'BPI Kenneth Angelo Docot' });
  });
});

describe('BPI push', () => {
  it('a credit shows the last digits of your own account', () => {
    expect(parseNotification('bpi', n('BPI', 'Your account XXXXXXX644 has been credited PHP 100.00 through a deposit via BPI partner store.'))).toMatchObject({
      direction: 'in', amount: 10_000, accountHint: '644', counterparty: 'deposit via BPI partner store',
    });
  });
});

describe('what is not a money movement', () => {
  it.each([
    ['gcash', 'Win up to P1,000 when you invite a friend!'],
    ['maya', 'Your OTP is 123456. Do not share it.'],
    ['gotyme', 'Rewards are waiting for you'],
    ['maribank', 'Your statement is ready'],
    ['bpi', 'Your one-time PIN is 998877'],
  ] as const)('%s ignores %j', (source, text) => {
    expect(parseNotification(source, n('Promo', text))).toBeNull();
  });
  it('returns null for an empty notification and for a source without a parser', () => {
    expect(parseNotification('gcash', { title: null, text: null, bigText: null })).toBeNull();
    expect(parseNotification('grab', n('Receipt', 'Total P514.00'))).toBeNull();
    expect(canParse('grab')).toBe(false);
    expect(canParse('gcash')).toBe(true);
  });
  it('never returns a zero or negative amount', () => {
    expect(parseNotification('maya', n('x', 'You received ₱0.00 from Maya Savings'))).toBeNull();
  });
});

describe('matchText', () => {
  it('joins title, text and expanded text for keyword rules', () => {
    expect(matchText(n('A', 'B', 'C'))).toBe('A B C');
    expect(matchText({ title: null, text: 'B', bigText: null })).toBe('B');
  });
});
