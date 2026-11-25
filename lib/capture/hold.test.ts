import { describe, expect, it } from 'vitest';
import { TRANSFER_HOLD_MS, transferHoldUntil, type HoldAccount, type HoldCandidate } from './hold';

const accounts: HoldAccount[] = [
  { id: 'maya', name: 'Maya', institution: null },
  { id: 'bpi', name: 'BPI Savings', institution: 'BPI' },
  { id: 'gcash', name: 'GCash', institution: null },
];
const at = Date.parse('2026-11-25T02:00:00Z');
const item = (over: Partial<HoldCandidate> = {}): HoldCandidate => ({
  status: 'pending', kind: 'income', source: 'notification', occurredAt: new Date(at).toISOString(), counterparty: 'InstaPay', accountId: 'maya', ...over,
});

describe('transferHoldUntil', () => {
  it('holds a Maya "from InstaPay" item for five minutes', () => {
    expect(transferHoldUntil(item(), accounts, at + 60_000)).toBe(at + TRANSFER_HOLD_MS);
  });
  it('holds an item that names another of your accounts', () => {
    expect(transferHoldUntil(item({ kind: 'expense', counterparty: 'BPI / VYBE by BPI' }), accounts, at)).toBe(at + TRANSFER_HOLD_MS);
  });
  it('does not hold once the wait is over', () => {
    expect(transferHoldUntil(item(), accounts, at + TRANSFER_HOLD_MS)).toBeNull();
  });
  it('does not hold ordinary spending or the item\'s own account name', () => {
    expect(transferHoldUntil(item({ kind: 'expense', counterparty: 'JOLLIBEE' }), accounts, at)).toBeNull();
    expect(transferHoldUntil(item({ counterparty: 'Maya' }), accounts, at)).toBeNull();
  });
  it('does not hold transfers, confirmed rows, or rows you typed', () => {
    expect(transferHoldUntil(item({ kind: 'transfer' }), accounts, at)).toBeNull();
    expect(transferHoldUntil(item({ status: 'confirmed' }), accounts, at)).toBeNull();
    expect(transferHoldUntil(item({ source: 'manual' }), accounts, at)).toBeNull();
  });
});
