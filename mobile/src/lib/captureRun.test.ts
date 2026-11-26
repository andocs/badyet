import { describe, expect, it } from 'vitest';
import type { AccountLite, TxnInsert } from '@/lib/capture/row';
import { defaultConfig, SOURCES, type CaptureRule, type SourceConfig } from '@/lib/capture/sources';
import { remember, type Recent } from '@/lib/capture/recent';
import { runCapture, type CapturedNotification, type Held, type RunContext, type RunDeps } from './captureRun';

const ACC: AccountLite[] = [
  { id: 'a-gcash', name: 'GCash', institution: null, last4: null },
  { id: 'a-maya', name: 'Maya', institution: null, last4: null },
];
const CAT = '33333333-3333-4333-8333-333333333333';
const T = Date.parse('2026-11-21T03:55:00Z');

const note = (pkg: string, title: string, text: string, over: Partial<CapturedNotification> = {}): CapturedNotification => ({ package: pkg, title, text, bigText: null, postTime: T, ...over });
const GCASH_PAID = note('com.globe.gcash.android', 'Your Buy Load Transaction Update', 'You have paid P112.00 of GCash to purchase NEW POWER with a convenience fee of P3.00 for 0969 on 09-23-26 08:55 AM. Ref. No. 111913449.');

function setup(over: { ctx?: Partial<RunContext> | null; queue?: CapturedNotification[]; held?: Held[] } = {}) {
  const rows: TxnInsert[] = [];
  let held: Held[] = over.held ?? [];
  let drained = 0;
  let n = 0;
  const configs: SourceConfig[] = SOURCES.map(defaultConfig);
  const deps: RunDeps = {
    loadContext: async () => (over.ctx === null ? null : { configs, rules: [], accounts: ACC, ...over.ctx }),
    drain: () => {
      drained += 1;
      return over.queue ?? [];
    },
    readHeld: () => held,
    writeHeld: (h) => void (held = h),
    enqueue: async (r) => void rows.push(r),
    hash: async (s) => `h(${s})`,
    newId: () => `id-${++n}`,
  };
  return { deps, rows, held: () => held, drained: () => drained, configs };
}

describe('runCapture', () => {
  it('turns a GCash payment into a pending expense in the GCash account, fee included', async () => {
    const t = setup({ queue: [GCASH_PAID] });
    expect(await runCapture(t.deps)).toEqual({ added: 1, held: 0, skipped: 0, ignored: 0 });
    expect(t.rows).toEqual([
      {
        id: 'id-1', account_id: 'a-gcash', occurred_at: new Date(T).toISOString(), amount: -11_500, merchant: 'NEW POWER', kind: 'expense',
        category_id: null, source: 'notification', status: 'pending', confirmed_at: null, dedupe_hash: 'h(gcash|ref|111913449)',
      },
    ]);
  });

  it('ignores apps it does not listen to and notifications that are not money', async () => {
    const t = setup({ queue: [note('com.some.game', 'Win!', 'You won P1000'), note('com.globe.gcash.android', 'Promo', 'Invite a friend and win P1,000!')] });
    expect(await runCapture(t.deps)).toMatchObject({ added: 0, ignored: 2 });
  });

  it('skips a source that is off and anything an ignore rule matches', async () => {
    const off = setup({ queue: [GCASH_PAID] });
    off.configs.find((c) => c.source === 'gcash')!.enabled = false;
    expect(await runCapture(off.deps)).toMatchObject({ added: 0, skipped: 1 });

    const rule: CaptureRule = { id: 'r', source: null, matchText: 'new power', action: 'ignore', categoryId: null };
    const ign = setup({ queue: [GCASH_PAID], ctx: { rules: [rule] } });
    expect(await runCapture(ign.deps)).toMatchObject({ added: 0, skipped: 1 });
  });

  it('drops a repeat of the same notification in one batch', async () => {
    const t = setup({ queue: [GCASH_PAID, { ...GCASH_PAID, postTime: T + 5_000 }] });
    expect(await runCapture(t.deps)).toMatchObject({ added: 1, skipped: 1 });
    expect(t.rows).toHaveLength(1);
  });

  it('confirms by itself only when you allowed it and the account and category are set', async () => {
    const t = setup({ queue: [GCASH_PAID] });
    Object.assign(t.configs.find((c) => c.source === 'gcash')!, { autoConfirm: true, categoryId: CAT, accountId: 'a-gcash' });
    await runCapture(t.deps);
    expect(t.rows[0]).toMatchObject({ status: 'confirmed', category_id: CAT, confirmed_at: new Date(T).toISOString() });
  });

  it('holds a capture with no known account, without its text, and places it once an account is known', async () => {
    const maya = note('com.paymaya', 'Money received', 'You received ₱1.00 from Maya Savings');
    const first = setup({ queue: [maya], ctx: { accounts: [ACC[0]!] } });
    expect(await runCapture(first.deps)).toMatchObject({ added: 0, held: 1 });
    expect(JSON.stringify(first.held())).not.toContain('You received');
    expect(first.drained()).toBe(1);

    const second = setup({ held: first.held() });
    expect(await runCapture(second.deps)).toMatchObject({ added: 1, held: 0 });
    expect(second.rows[0]).toMatchObject({ account_id: 'a-maya', amount: 100, kind: 'income', merchant: 'Maya Savings' });
    expect(second.held()).toEqual([]);
  });

  it('places an email capture as an import, and skips it when the same money is already recorded', async () => {
    const held: Held = {
      parsed: { source: 'gcash', direction: 'out', amount: 5_000, counterparty: 'X', counterpartyLast4: null, accountHint: null, ref: 'R1', accountName: null },
      postTime: T,
      decision: { keep: true, status: 'pending', accountId: null, categoryId: null, ruleId: null },
      hash: 'h-email',
      origin: 'import',
    };
    const fresh = setup({ held: [held] });
    expect(await runCapture(fresh.deps)).toMatchObject({ added: 1 });
    expect(fresh.rows[0]).toMatchObject({ source: 'import', amount: -5_000, dedupe_hash: 'h-email' });

    const dup = setup({ held: [held] });
    dup.deps.isDuplicate = async () => true;
    expect(await runCapture(dup.deps)).toMatchObject({ added: 0, skipped: 1 });
    expect(dup.rows).toHaveLength(0);
  });

  it('does not run the duplicate check on phone notifications, so two real purchases in a row are both kept', async () => {
    const t = setup({ queue: [GCASH_PAID, { ...GCASH_PAID, text: GCASH_PAID.text!.replace('111913449', '222222222'), postTime: T + 60_000 }] });
    t.deps.isDuplicate = async () => true;
    expect(await runCapture(t.deps)).toMatchObject({ added: 2 });
  });

  it('skips a phone alert when its email was already seen, and notes alerts it keeps', async () => {
    let recent: Recent[] = remember([], 'import', { source: 'gcash', direction: 'out', amount: 11_500 } as never, T + 60_000);
    const t = setup({ queue: [GCASH_PAID] });
    t.deps.readRecent = () => recent;
    t.deps.writeRecent = (r) => void (recent = r);
    expect(await runCapture(t.deps)).toMatchObject({ added: 0, skipped: 1 });

    recent = [];
    const u = setup({ queue: [GCASH_PAID] });
    u.deps.readRecent = () => recent;
    u.deps.writeRecent = (r) => void (recent = r);
    expect(await runCapture(u.deps)).toMatchObject({ added: 1 });
    expect(recent).toMatchObject([{ origin: 'notification', source: 'gcash', direction: 'out', amount: 11_500 }]);
  });


  it('records both halves of a card payment rule, the card side as money in', async () => {
    const FROM = '11111111-1111-4111-8111-111111111111';
    const CARD = '99999999-9999-4999-8999-999999999999';
    const rule = { id: 'r', source: null, matchText: 'paid', action: 'record' as const, categoryId: null, kind: 'payment' as const, fromAccountId: FROM, toAccountId: CARD, autoConfirm: true };
    const t = setup({ queue: [GCASH_PAID], ctx: { rules: [rule] } });
    t.deps.transferCategoryId = async () => 'tcat';
    expect(await runCapture(t.deps)).toMatchObject({ added: 1 });
    expect(t.rows).toHaveLength(2);
    expect(t.rows[0]).toMatchObject({ account_id: FROM, kind: 'transfer', category_id: 'tcat', status: 'confirmed' });
    expect(t.rows[1]).toMatchObject({ account_id: CARD, amount: -t.rows[0]!.amount, kind: 'transfer', transfer_peer_id: t.rows[0]!.id, dedupe_hash: null });
  });

  it('leaves the queue alone when settings cannot be loaded, so nothing is lost', async () => {
    const t = setup({ ctx: null, queue: [GCASH_PAID] });
    await runCapture(t.deps);
    expect(t.drained()).toBe(0);
    expect(t.rows).toHaveLength(0);
  });

  it('does not place the same held capture twice', async () => {
    const first = setup({ queue: [GCASH_PAID], ctx: { accounts: [] } });
    await runCapture(first.deps);
    const again = setup({ held: first.held(), queue: [GCASH_PAID], ctx: { accounts: [] } });
    expect(await runCapture(again.deps)).toMatchObject({ held: 1, skipped: 1 });
  });
});

describe('a rule that records both sides, and the other side message', () => {
  const accounts: AccountLite[] = [
    { id: 'wallet', name: 'Maya', institution: null, last4: null },
    { id: 'black', name: 'Maya Black', institution: null, last4: null },
  ];
  const maya = (text: string, at = T) => note('com.paymaya', 'Maya', text, { postTime: at });
  const PAID = maya('You paid P5,000.00 to Maya Black.');
  const RECEIVED = maya('Payment of P5,000.00 received on your Maya Black', T + 60_000);
  const rule = (over: object): CaptureRule => ({ id: 'r', source: null, matchText: 'to maya black', words: ['to maya black'], action: 'record', categoryId: null, kind: 'payment', fromAccountId: 'wallet', toAccountId: 'black', ...over });
  const withMaya = (t: ReturnType<typeof setup>) => {
    const c = t.configs.find((x) => x.source === 'maya')!;
    c.packages = ['com.paymaya'];
    return t;
  };

  it('does not add the card side again when its own message arrives in the same pass', async () => {
    const t = withMaya(setup({ queue: [PAID, RECEIVED], ctx: { rules: [rule({})], accounts } }));
    expect(await runCapture(t.deps)).toMatchObject({ added: 1, skipped: 1 });
    expect(t.rows.map((r) => [r.account_id, r.amount, r.kind])).toEqual([['wallet', -500_000, 'transfer'], ['black', 500_000, 'transfer']]);
  });

  it('claims the entry already saved when the message arrives later', async () => {
    const t = withMaya(setup({ queue: [RECEIVED], ctx: { accounts } }));
    const claimed: [string, string][] = [];
    t.deps.madeLegs = async () => [{ id: 'leg', accountId: 'black', amount: 500_000, at: T, peerAccountId: 'wallet' }];
    t.deps.claimLeg = async (id, hash) => void claimed.push([id, hash]);
    expect(await runCapture(t.deps)).toMatchObject({ added: 0, skipped: 1 });
    expect(t.rows).toHaveLength(0);
    expect(claimed).toHaveLength(1);
    expect(claimed[0]![0]).toBe('leg');
  });

  it('with only "money arrives in" set, takes this side from the message and records both', async () => {
    const t = withMaya(setup({ queue: [PAID], ctx: { rules: [rule({ fromAccountId: undefined, autoConfirm: true })], accounts } }));
    expect(await runCapture(t.deps)).toMatchObject({ added: 1 });
    expect(t.rows.map((r) => [r.account_id, r.kind, r.status])).toEqual([['wallet', 'transfer', 'pending'], ['black', 'transfer', 'pending']]);
  });

  it('with only "money leaves" set, uses that account and waits for the other side to be picked', async () => {
    const t = withMaya(setup({ queue: [PAID], ctx: { rules: [rule({ toAccountId: undefined, autoConfirm: true })], accounts: [...accounts, { id: 'other', name: 'Other Maya Wallet', institution: null, last4: null }] } }));
    expect(await runCapture(t.deps)).toMatchObject({ added: 1 });
    expect(t.rows).toHaveLength(1);
    expect(t.rows[0]).toMatchObject({ account_id: 'wallet', amount: -500_000, kind: 'expense', category_id: null, status: 'pending' });
  });
});
