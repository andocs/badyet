import { describe, expect, it } from 'vitest';
import { allowedPackages, configsFromRows, defaultConfig, rulesFromRows, SOURCES } from './sources';
import { ruleFullRow, splitList, validateRule, validateRuleFull, validateSource, type SourceInput } from './validate';

const ACC = '22222222-2222-4222-8222-222222222222';
const CAT = '33333333-3333-4333-8333-333333333333';

const src = (over: Partial<SourceInput> = {}): SourceInput => ({
  source: 'gcash', enabled: true, packages: 'com.globe.gcash.android', senders: '', accountId: null, categoryId: null, autoConfirm: false, minAmount: '', ...over,
});

describe('splitList', () => {
  it('splits on commas, spaces and lines, trimming and removing repeats', () => {
    expect(splitList(' a.b.c, d.e.f\n a.b.c ;g.h.i ')).toEqual(['a.b.c', 'd.e.f', 'g.h.i']);
    expect(splitList('')).toEqual([]);
  });
});

describe('validateSource', () => {
  it('accepts a normal source and turns pesos into centavos', () => {
    expect(validateSource(src({ minAmount: '1,250.50', accountId: ACC, categoryId: CAT, autoConfirm: true }))).toEqual({
      ok: true,
      value: { source: 'gcash', enabled: true, packages: ['com.globe.gcash.android'], senders: [], accountId: ACC, categoryId: CAT, autoConfirm: true, minAmount: 125_050 },
    });
  });
  it('treats an empty minimum as none, and lowercases ids and senders', () => {
    const r = validateSource(src({ packages: 'COM.Example.App', senders: 'Bank@Example.COM' }));
    expect(r).toMatchObject({ ok: true, value: { packages: ['com.example.app'], senders: ['bank@example.com'], minAmount: 0 } });
  });
  it.each([
    [{ source: 'nope' }, 'That source was not found.'],
    [{ packages: 'notapackage' }, 'An app id looks like com.example.app.'],
    [{ senders: 'not an email' }, 'An email sender looks like name@bank.com.'],
    [{ accountId: 'x' }, 'Pick an account from the list.'],
    [{ categoryId: 'x' }, 'Pick a category from the list.'],
    [{ minAmount: '-5' }, 'Minimum amount is pesos, like 50 or 1,250.50.'],
    [{ minAmount: 'abc' }, 'Minimum amount is pesos, like 50 or 1,250.50.'],
    [{ minAmount: '1,000,000,001' }, 'That minimum is too large.'],
  ])('rejects %j', (over, error) => {
    expect(validateSource(src(over as Partial<SourceInput>))).toEqual({ ok: false, error });
  });
  it('limits how many apps and senders a source can have', () => {
    const many = Array.from({ length: 11 }, (_, i) => `com.a.app${i}`).join(',');
    expect(validateSource(src({ packages: many }))).toEqual({ ok: false, error: 'Up to 10 apps per source.' });
  });
});

describe('validateRule', () => {
  it('accepts an ignore rule for all sources and tidies the words', () => {
    expect(validateRule({ source: '', matchText: '  cash   back ', action: 'ignore', categoryId: CAT })).toEqual({
      ok: true,
      value: { source: null, matchText: 'cash back', action: 'ignore', categoryId: null },
    });
  });
  it('set_category needs a valid category', () => {
    expect(validateRule({ source: 'maya', matchText: 'jollibee', action: 'set_category', categoryId: null })).toEqual({ ok: false, error: 'Pick a category.' });
    expect(validateRule({ source: 'maya', matchText: 'jollibee', action: 'set_category', categoryId: CAT })).toMatchObject({ ok: true, value: { categoryId: CAT } });
  });
  it('rejects empty or long words, unknown actions and unknown sources', () => {
    expect(validateRule({ source: null, matchText: '   ', action: 'ignore', categoryId: null })).toEqual({ ok: false, error: 'Type the words to look for.' });
    expect(validateRule({ source: null, matchText: 'x'.repeat(81), action: 'ignore', categoryId: null })).toEqual({ ok: false, error: 'Keep the words to 80 characters.' });
    expect(validateRule({ source: null, matchText: 'x', action: 'delete', categoryId: null })).toEqual({ ok: false, error: 'Pick what to do.' });
    expect(validateRule({ source: 'visa', matchText: 'x', action: 'ignore', categoryId: null })).toEqual({ ok: false, error: 'That source was not found.' });
  });
});

describe('rows to config', () => {
  it('gives every source a config, with saved choices over the defaults', () => {
    const out = configsFromRows([{ source: 'maya', enabled: false, packages: ['com.paymaya'], senders: [], account_id: ACC, category_id: null, auto_confirm: true, min_amount: 5000 }, { source: 'bogus', enabled: true, packages: [], senders: [], account_id: null, category_id: null, auto_confirm: false, min_amount: 0 }]);
    expect(out.map((c) => c.source)).toEqual([...SOURCES]);
    expect(out.find((c) => c.source === 'maya')).toMatchObject({ enabled: false, accountId: ACC, autoConfirm: true, minAmount: 5000 });
    expect(out.find((c) => c.source === 'gcash')).toEqual(defaultConfig('gcash'));
  });
  it('drops rules with an unknown source or action', () => {
    const out = rulesFromRows([
      { id: '1', source: null, match_text: 'a', action: 'ignore', category_id: null },
      { id: '2', source: 'bogus', match_text: 'a', action: 'ignore', category_id: null },
      { id: '3', source: 'gcash', match_text: 'a', action: 'explode', category_id: null },
    ]);
    expect(out.map((r) => r.id)).toEqual(['1']);
  });
  it('listens only to the apps of enabled sources', () => {
    const cfgs = SOURCES.map((s) => ({ ...defaultConfig(s), enabled: s !== 'maya' }));
    const pk = allowedPackages(cfgs);
    expect(pk).toContain('com.globe.gcash.android');
    expect(pk).not.toContain('com.paymaya');
  });
});

describe('validateRuleFull', () => {
  const base = { name: ' Coffee ', enabled: true, channel: 'emails', words: ['Coffee', 'coffee', ' Starbucks '], mustWords: [], skipWords: ['refund'], sources: ['grab'], packages: [], senders: ['@bank.com'], action: 'record', kind: 'spending', categoryId: null, fromAccountId: null, toAccountId: null, autoConfirm: true };
  it('cleans words and keeps the first as match_text', () => {
    const r = validateRuleFull(base);
    expect(r.ok && r.value).toMatchObject({ name: 'Coffee', words: ['coffee', 'starbucks'], channel: 'emails', autoConfirm: true });
    expect(r.ok && ruleFullRow(r.value).match_text).toBe('coffee');
  });
  it('refuses no words, a bad channel, a bad sender and the same account twice', () => {
    expect(validateRuleFull({ ...base, words: [] })).toMatchObject({ ok: false });
    expect(validateRuleFull({ ...base, channel: 'sms' })).toMatchObject({ ok: false });
    expect(validateRuleFull({ ...base, senders: ['bank'] })).toMatchObject({ ok: false });
    const id = '55555555-5555-4555-8555-555555555555';
    expect(validateRuleFull({ ...base, kind: 'payment', fromAccountId: id, toAccountId: id })).toMatchObject({ ok: false, error: 'Pick two different accounts.' });
  });
  it('drops accounts for spending and the category for a transfer', () => {
    const id = '55555555-5555-4555-8555-555555555555';
    const t = validateRuleFull({ ...base, kind: 'transfer', categoryId: id, fromAccountId: id, toAccountId: '66666666-6666-4666-8666-666666666666' });
    expect(t.ok && t.value).toMatchObject({ categoryId: null, fromAccountId: id });
    const s = validateRuleFull({ ...base, kind: 'spending', fromAccountId: id });
    expect(s.ok && s.value).toMatchObject({ fromAccountId: null, toAccountId: null });
  });
});
