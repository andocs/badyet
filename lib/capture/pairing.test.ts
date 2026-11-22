import { describe, expect, it } from 'vitest';
import { client } from '../../mobile/src/lib/fakeClient';
import { pairRecent } from './pairing';

describe('pairRecent', () => {
  it('looks at phone notifications and emails alike, so a bank email can pair with a wallet push', async () => {
    const { supabase, log } = client({ 'accounts:select': { data: [] }, 'transactions:select': { data: [] } });
    await pairRecent(supabase, Date.parse('2026-11-22T06:00:00Z'));
    const call = log.find((c) => c.table === 'transactions')!;
    const ins = call.ops.filter((o) => o.name === 'in');
    expect(ins[0]!.args).toEqual(['source', ['notification', 'import']]);
    expect(ins[1]!.args).toEqual(['kind', ['expense', 'income']]);
  });
});
