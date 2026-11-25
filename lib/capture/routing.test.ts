import { describe, expect, it } from 'vitest';
import { gmailQuery, parseEmail, sourceForEmail } from './email';
import { allowedPackages, defaultConfig, rulesFromRows, SOURCES, sourceForPackage, type SourceConfig } from './sources';
import type { CapturePattern } from './patterns';

const configs: SourceConfig[] = SOURCES.map((s) => ({ ...defaultConfig(s), enabled: s === 'maya' || s === 'bpi' }));
const rules = rulesFromRows([
  { id: 'r1', source: null, match_text: '', action: 'record', category_id: null, enabled: true, packages: ['com.shopeepay.ph'], senders: ['@seabank.ph'], sources: [] },
  { id: 'r2', source: null, match_text: '', action: 'record', category_id: null, enabled: true, packages: ['com.globe.gcash.android'], sources: ['gcash'] },
  { id: 'r3', source: null, match_text: '', action: 'record', category_id: null, enabled: false, packages: ['com.paused.app'] },
]);

describe('apps and senders a rule names are really listened to', () => {
  it('adds a rule’s apps to the phone’s list, but not a paused rule’s', () => {
    const list = allowedPackages(configs, false, rules);
    expect(list).toEqual(expect.arrayContaining(['com.paymaya', 'com.shopeepay.ph', 'com.globe.gcash.android']));
    expect(list).not.toContain('com.paused.app');
  });
  it('reads a rule’s app with the rule’s source, else your own patterns', () => {
    expect(sourceForPackage('com.paymaya', configs, rules)).toBe('maya');
    expect(sourceForPackage('com.globe.gcash.android', configs, rules)).toBe('gcash'); // GCash source is off, the rule still asks for it
    expect(sourceForPackage('com.shopeepay.ph', configs, rules)).toBe('custom');
    expect(sourceForPackage('com.unknown', configs, rules)).toBeNull();
  });
  it('fetches and reads a rule’s senders, a whole domain when written with @', () => {
    expect(gmailQuery(configs, 3, rules)).toContain('seabank.ph');
    expect(sourceForEmail('SeaBank <alerts@seabank.ph>', configs, rules)).toBe('custom');
    expect(sourceForEmail('someone@else.com', configs, rules)).toBeNull();
  });
});

describe('patterns read emails too', () => {
  const patterns: CapturePattern[] = [{ id: 'p', source: 'custom', template: 'You sent {amount} to {name}', direction: 'out' }];
  it('reads an email with your pattern when there is no built-in email reader', () => {
    expect(parseEmail('custom', { subject: 'Transfer done', text: 'You sent PHP 250.00 to JUAN D' }, patterns)).toMatchObject({ direction: 'out', amount: 25_000, counterparty: 'JUAN D' });
    expect(parseEmail('custom', { subject: 'Promo', text: 'Big sale today' }, patterns)).toBeNull();
  });
});
