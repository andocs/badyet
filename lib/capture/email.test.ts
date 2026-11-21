import { describe, expect, it } from 'vitest';
import { decodeBase64Url, gmailQuery, htmlToLines, parseEmail, readEmail, sourceForEmail, type GmailMessage } from './email';
import { defaultConfig, SOURCES, type SourceConfig } from './sources';

const b64url = (s: string) => Buffer.from(s, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const rows = (pairs: [string, string][]) => pairs.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('');
const msg = (from: string, subject: string, html: string, internalDate = '1795233316000'): GmailMessage => ({
  id: 'm1',
  internalDate,
  payload: {
    mimeType: 'multipart/alternative',
    headers: [{ name: 'From', value: from }, { name: 'Subject', value: subject }],
    parts: [{ mimeType: 'text/plain', body: { data: b64url('see html') } }, { mimeType: 'text/html', body: { data: b64url(html) } }],
  },
});

// Layouts follow the real emails in docs/expo-samples.md (names redacted).
const BPI_OUT = `<html><body><p>Dear USER,</p><p>You have successfully submitted your InstaPay Funds Transfer request with the following details.</p>
<table><tr><td colspan="2">Interbank Funds Transfer Transaction Details</td></tr>${rows([
  ['Confirmation Number', 'R1632511469324'], ['Transaction Date and Time', 'Saturday, Nov 21 2026; 11:52:34 AM (GMT +8)'],
  ['Transfer From', 'XXXX-XXXX-167 (Payroll Chevron)'], ['Transfer To', '01XXXXXX00654'], ['Bank Name', 'GoTyme'],
  ['Transfer Amount', 'PHP 1.00'], ['Service Fee', 'PHP 0.00'], ['Total Amount', 'PHP 1.00'], ['Transfer Service', 'INSTAPAY'], ['Transaction Ref No.', '454137'], ['Notes', ''],
])}</table></body></html>`;
const BPI_IN = `<html><body><p>Dear USER,</p><p>You have an incoming interbank funds transfer sent via Instapay with the following details.</p>
<table><tr><td colspan="2">Interbank Funds Transfer Transaction Details</td></tr>${rows([
  ['Reference Number', '20261121PAPHPHM1XXXB000000428155439'], ['Transaction Date and Time', 'Saturday, Nov 21 2026; 11:55:16 AM(GMT + 8)'],
  ['Transfer From', 'XXXXXXXX0325'], ['Transfer To', 'XXXXXXXXXX8167'], ['Bank Name', 'Maya Philippines, Inc.'], ['Transfer Amount', 'PHP 50.00'], ['Transfer Service', 'INSTAPAY'],
])}</table></body></html>`;
const GRAB = `<html><body><h2>Hope you enjoyed your food!</h2><table><tr><td>TOTAL</td><td>DATE | TIME</td></tr><tr><td>₱ 514.00</td><td>Pick-up time: 21 Nov 26 10:03 +0800</td></tr></table>
<table>${rows([['Booking code', 'A-A3TU6K9GXCAIAV'], ['Pick up location', "D' Original Pares - Pasig"], ['Drop off location', 'Home'], ['Payment Method:', 'Visa 1506']])}</table>
<table><tr><td>Subtotal</td><td>₱ 509.00</td></tr><tr><td>TOTAL (INCL. TAX)</td><td>₱ 514.00</td></tr></table></body></html>`;
const PANDA = `<html><body><p>Nice choice!</p><p>Your order from KFC - Pasig Caruncho has been placed.</p><table>${rows([
  ['Order number', 't9hb-2647-8vwh'], ['Order time', '2026-11-20 22:00:01'], ['Store', 'KFC - Pasig Caruncho'],
])}</table><table><tr><td>Subtotal</td><td>₱752.00</td></tr><tr><td>Platform fee</td><td>₱4.50</td></tr><tr><td>Order Total</td><td>₱756.50</td></tr></table></body></html>`;

describe('decodeBase64Url', () => {
  it('decodes UTF-8 including the peso sign and emoji', () => {
    for (const s of ['plain', '₱ 514.00 — ok', 'café 🙂']) expect(decodeBase64Url(b64url(s))).toBe(s);
  });
});

describe('htmlToLines', () => {
  it('makes one line per table row with tab-separated cells, and decodes entities', () => {
    expect(htmlToLines('<style>x{}</style><table><tr><td>A &amp; B</td><td>PHP&nbsp;1.00</td></tr><tr><td>C</td><td>&#8369; 2</td></tr></table>')).toBe('A & B\tPHP 1.00\nC\t₱ 2');
  });
});

describe('readEmail', () => {
  it('reads sender, subject, time and the HTML body', () => {
    const e = readEmail(msg('BPI Online <onlinebanking@bpi.com.ph>', 'Interbank Funds Transfer Confirmation', BPI_OUT))!;
    expect(e).toMatchObject({ from: 'BPI Online <onlinebanking@bpi.com.ph>', subject: 'Interbank Funds Transfer Confirmation', postTime: 1795233316000 });
    expect(e.text).toContain('Total Amount\tPHP 1.00');
  });
  it('falls back to plain text and returns null for an empty message', () => {
    const plain: GmailMessage = { id: 'p', payload: { mimeType: 'text/plain', headers: [], body: { data: b64url('Line one\r\nLine two') } } };
    expect(readEmail(plain)?.text).toBe('Line one\nLine two');
    expect(readEmail({ id: 'x' })).toBeNull();
    expect(readEmail({ id: 'y', payload: { mimeType: 'multipart/mixed', parts: [] } })).toBeNull();
  });
});

describe('sourceForEmail and gmailQuery', () => {
  const configs: SourceConfig[] = SOURCES.map(defaultConfig);
  it('matches a listed sender, then a known domain', () => {
    expect(sourceForEmail('BPI Online <onlinebanking@bpi.com.ph>', configs)).toBe('bpi');
    expect(sourceForEmail('no-reply@grab.com', configs)).toBe('grab');
    expect(sourceForEmail('orders@mail.foodpanda.ph', configs)).toBe('foodpanda');
    expect(sourceForEmail('someone@gmail.com', configs)).toBeNull();
  });
  it('knows the real Grab and foodpanda senders by address, and builds the search from them', () => {
    expect(defaultConfig('grab').senders).toEqual(['no-reply@grab.com']);
    expect(defaultConfig('foodpanda').senders).toEqual(['info@mail.foodpanda.ph']);
    expect(sourceForEmail('Grab <no-reply@grab.com>', configs)).toBe('grab');
    expect(sourceForEmail('foodpanda <info@mail.foodpanda.ph>', configs)).toBe('foodpanda');
    expect(gmailQuery(configs, 3)).toContain('info@mail.foodpanda.ph');
  });
  it('ignores a source that is switched off', () => {
    expect(sourceForEmail('no-reply@grab.com', configs.map((c) => (c.source === 'grab' ? { ...c, enabled: false } : c)))).toBeNull();
  });
  it('builds a search from the enabled senders and domains', () => {
    const q = gmailQuery(configs, 3)!;
    expect(q).toContain('onlinebanking@bpi.com.ph');
    expect(q).toContain('grab.com');
    expect(q.endsWith('newer_than:3d')).toBe(true);
    expect(gmailQuery(configs.map((c) => ({ ...c, enabled: false })), 3)).toBeNull();
  });
});

describe('BPI emails', () => {
  it('outgoing: amount with fee, your account digits and nickname, the bank it went to, the confirmation number', () => {
    const e = readEmail(msg('onlinebanking@bpi.com.ph', 'Interbank Funds Transfer Confirmation', BPI_OUT))!;
    expect(parseEmail('bpi', e)).toEqual({
      source: 'bpi', direction: 'out', amount: 100, counterparty: 'GoTyme', counterpartyLast4: '0654', accountHint: '167', accountName: 'Payroll Chevron', ref: 'R1632511469324',
    });
  });
  it('incoming: your account digits, the sending bank and the reference number', () => {
    const e = readEmail(msg('bpiinstapay@bpi.com.ph', 'Incoming Interbank Funds Transfer Confirmation', BPI_IN))!;
    expect(parseEmail('bpi', e)).toEqual({
      source: 'bpi', direction: 'in', amount: 5_000, counterparty: 'Maya Philippines, Inc.', counterpartyLast4: '0325', accountHint: '8167', accountName: null, ref: '20261121PAPHPHM1XXXB000000428155439',
    });
  });
  it('a statement or promo is not a money movement', () => {
    expect(parseEmail('bpi', { subject: 'Your eStatement', text: 'Your statement is attached.' })).toBeNull();
  });
});

describe('Grab and foodpanda emails', () => {
  it('Grab: the total with tax, the restaurant, the card digits and the booking code', () => {
    const e = readEmail(msg('no-reply@grab.com', 'Your Grab E-Receipt', GRAB))!;
    expect(parseEmail('grab', e)).toMatchObject({ source: 'grab', direction: 'out', amount: 51_400, counterparty: "D' Original Pares - Pasig", accountHint: '1506', ref: 'A-A3TU6K9GXCAIAV' });
  });
  it('Grab paid in cash is not counted', () => {
    const e = readEmail(msg('no-reply@grab.com', 'Receipt', GRAB.replace('Visa 1506', 'Cash')))!;
    expect(parseEmail('grab', e)).toBeNull();
  });
  it('foodpanda: the order total, the store and the order number', () => {
    const e = readEmail(msg('orders@foodpanda.ph', 'Your order has been placed', PANDA))!;
    expect(parseEmail('foodpanda', e)).toMatchObject({ source: 'foodpanda', direction: 'out', amount: 75_650, counterparty: 'KFC - Pasig Caruncho', accountHint: null, ref: 't9hb-2647-8vwh' });
  });
  it('sources without an email parser return null', () => {
    expect(parseEmail('gcash', { subject: 's', text: 'Total Amount PHP 1.00' })).toBeNull();
  });
});
