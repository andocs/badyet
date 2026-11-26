import { describe, expect, it } from 'vitest';
import { BUILTIN_FORMATS, groupRules, pairCheck, readSample, simulate, suggestPattern, type Channel, type SampleSetup } from './explain';
import { parseWithPatterns } from './parsers';
import { describeOther, describeSample } from './result-view';
import type { AccountLite } from './row';
import { defaultConfig, type CaptureRule, type SourceKey } from './sources';

describe('the built-in wordings the editor shows', () => {
  const all = Object.entries(BUILTIN_FORMATS).flatMap(([source, byChannel]) => Object.entries(byChannel!).flatMap(([channel, list]) => list!.map((f) => ({ source: source as SourceKey, channel: channel as Channel, f }))));
  it.each(all.map((x) => [x.source, x.channel, x.f.label, x]))('%s %s "%s": its example is really read', (_s, _c, _l, x) => {
    const read = readSample(x.source, x.f.example, [], [x.channel]);
    expect(read).not.toBeNull();
    expect(read!.by).toBe('builtin');
  });
});

const accounts: AccountLite[] = [
  { id: 'wallet', name: 'Maya', institution: null, last4: null },
  { id: 'black', name: 'Maya Black', institution: null, last4: null },
];
const setup = (over: Partial<SampleSetup> = {}): SampleSetup => ({ source: 'maya', config: defaultConfig('maya'), rules: [], patterns: [], accounts, channels: ['notification'], ...over });
const PAID = 'You paid ₱5,000.00 to Maya Black.';
const CARD = 'Payment of ₱5,000.00 received on your Maya Black';
const kept = (text: string, s = setup()) => {
  const o = simulate(text, s);
  if (o.kind !== 'kept') throw new Error(o.kind);
  return o;
};

describe('simulate', () => {
  it('shows what one message would save, in the account it would land in', () => {
    expect(kept(CARD).entries).toEqual([{ accountId: 'black', amount: 500_000, kind: 'income' }]);
    expect(kept(PAID).entries).toEqual([{ accountId: 'wallet', amount: -500_000, kind: 'expense' }]);
  });
  it('shows both entries when a rule records the move', () => {
    const rule = { id: 'r', source: null, matchText: 'to maya black', action: 'record', kind: 'payment', categoryId: null, fromAccountId: 'wallet', toAccountId: 'black' } as CaptureRule;
    expect(kept(PAID, setup({ rules: [rule] })).entries).toEqual([{ accountId: 'wallet', amount: -500_000, kind: 'transfer' }, { accountId: 'black', amount: 500_000, kind: 'transfer' }]);
  });
  it('says when a message cannot be read, or is skipped by the source', () => {
    expect(simulate('You paid your Maya Black bill of ₱5,000.00.', setup())).toEqual({ kind: 'unreadable' });
    expect(simulate(CARD, setup({ config: { ...defaultConfig('maya'), minAmount: 900_000 } }))).toMatchObject({ kind: 'skipped', reason: 'under-minimum' });
  });
});

describe('pairCheck', () => {
  it('passes the wallet and card messages of one payment', () => {
    const r = pairCheck(kept(PAID), kept(CARD), accounts);
    expect(r.pairs).toBe(true);
    expect(r.checks.every((c) => c.ok)).toBe(true);
  });
  it('says which check fails', () => {
    const r = pairCheck(kept(PAID), kept('Payment of ₱4,985.00 received on your Maya Black'), accounts);
    expect(r.pairs).toBe(false);
    expect(r.checks.filter((c) => !c.ok).map((c) => c.label)).toEqual(['Exactly the same amount (a fee on one side stops it)']);
  });
});

describe('suggestPattern', () => {
  it('turns the amount and a labelled reference into placeholders, and the result reads the sample', () => {
    const sample = 'You paid your Sample Card bill of ₱5,000.00. Ref. No. 12345';
    const template = suggestPattern(sample)!;
    expect(template).toBe('You paid your Sample Card bill of {amount}. Ref. No. {ref}');
    expect(parseWithPatterns([{ id: 'p', source: 'maya', direction: 'out', template }], 'maya', sample)?.amount).toBe(500_000);
  });
  it('gives nothing when there is no amount to find', () => {
    expect(suggestPattern('Payment of three thousand pesos')).toBeNull();
  });
});

describe('groupRules', () => {
  const rule = (id: string, over: Partial<CaptureRule>) => ({ id, source: null, matchText: id, action: 'record', categoryId: null, ...over }) as CaptureRule;
  it('puts a one-source rule under that source, the rest together, and numbers them in the order tried', () => {
    const g = groupRules([rule('a', { sources: ['maya'] }), rule('b', { sources: ['maya', 'gcash'] }), rule('c', {}), rule('d', { source: 'gcash' }), rule('e', { sources: ['bpi'] })], ['gcash', 'maya']);
    expect(g.groups.map((x) => [x.source, x.rules.map((r) => r.id)])).toEqual([['gcash', ['d']], ['maya', ['a']]]);
    expect(g.shared.map((r) => r.id)).toEqual(['b', 'c', 'e']);
    expect(g.numberOf.get('d')).toBe(4);
  });
});

describe('step 5 as the editors draw it', () => {
  const names = { source: 'Maya', ruleId: null, rules: new Map<string, string>(), categories: new Map<string, string>() };
  it('names the entry saved, then says the two messages would pair', () => {
    const { box, outcome } = describeSample(PAID, setup(), names);
    expect(box.heading).toBe('It saves one entry, waiting in the Inbox');
    expect(box.entries).toEqual([{ name: 'Maya', kind: 'Spending · choose a category', amount: -500_000 }]);
    const other = describeOther(outcome, CARD, setup(), 'Maya')!;
    expect(other.lines[0]!.title).toBe('These two would pair');
    expect(other.entries.map((e) => [e.name, e.kind])).toEqual([['Maya', 'Transfer'], ['Maya Black', 'Transfer']]);
  });
  it('says the second message will not be added again when a rule records both sides', () => {
    const rule = { id: 'r', source: null, matchText: 'to maya black', action: 'record', kind: 'payment', categoryId: null, fromAccountId: 'wallet', toAccountId: 'black' } as CaptureRule;
    const { box, outcome } = describeSample(PAID, setup({ rules: [rule] }), { ...names, ruleId: 'r' });
    expect(box.entries).toHaveLength(2);
    expect(describeOther(outcome, CARD, setup({ rules: [rule] }), 'Maya')!.lines[0]!.title).toBe('It would not be added again');
  });
});
