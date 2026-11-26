import { describe, expect, it } from 'vitest';
import { madeLegFor, type MadeLeg } from './claim';
import type { AccountLite } from './row';

const accounts = [
  { id: 'wallet', name: 'Maya', institution: null, last4: null },
  { id: 'black', name: 'Maya Black', institution: null, last4: null },
] as AccountLite[];
const HOUR = 60 * 60_000;
const leg = (over: Partial<MadeLeg> = {}): MadeLeg => ({ id: 'l1', accountId: 'black', amount: 500_000, at: 0, peerAccountId: 'wallet', ...over });
const later = (over: Partial<Parameters<typeof madeLegFor>[0]> = {}) => ({ accountId: 'black', amount: 500_000, at: 60_000, counterparty: null, ...over });

describe('madeLegFor', () => {
  it('takes the other side the app made when that account then sends a message naming nobody', () => {
    expect(madeLegFor(later(), [leg()], accounts)?.id).toBe('l1');
  });
  it('takes it when the message names the other account of that move', () => {
    expect(madeLegFor(later({ counterparty: 'Maya wallet' }), [leg()], accounts)?.id).toBe('l1');
  });
  it('keeps a separate purchase: it names someone else', () => {
    expect(madeLegFor(later({ counterparty: 'Sample Store' }), [leg()], accounts)).toBeNull();
  });
  it('needs the same account, the same money and the same hour', () => {
    expect(madeLegFor(later({ accountId: 'wallet' }), [leg()], accounts)).toBeNull();
    expect(madeLegFor(later({ amount: -500_000 }), [leg()], accounts)).toBeNull();
    expect(madeLegFor(later({ at: HOUR + 1 }), [leg()], accounts)).toBeNull();
  });
  it('takes the closest in time when two would fit', () => {
    expect(madeLegFor(later(), [leg({ id: 'far', at: -30 * 60_000 }), leg({ id: 'near', at: 30_000 })], accounts)?.id).toBe('near');
  });
});
