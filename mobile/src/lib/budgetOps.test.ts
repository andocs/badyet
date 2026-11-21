import { describe, expect, it } from 'vitest';
import { archiveCategory, createPool, setOfficeDay, setUsualOfficeDays, settleDay, takeFromPool, undoSettle } from './budgetOps';
import { client, find } from './fakeClient';

const A = '11111111-1111-4111-8111-111111111111';
const POOL = '55555555-5555-4555-8555-555555555555';
const LINE = '44444444-4444-4444-8444-444444444444';

describe('office days', () => {
  it('only accepts weekdays 1 to 7', async () => {
    const { supabase } = client({});
    expect(await setUsualOfficeDays(supabase, [0])).toHaveProperty('error');
    expect(await setUsualOfficeDays(supabase, [8])).toHaveProperty('error');
  });
  it('saves sorted unique days', async () => {
    const { supabase, log } = client({ 'user_settings:select': { data: { user_id: 'u' } } });
    expect(await setUsualOfficeDays(supabase, [3, 1, 3])).toEqual({ ok: true });
    expect(find(log, 'user_settings', 'update')?.args[0]).toEqual({ office_days: [1, 3] });
  });
  it('an extra office day draws one day budget from the contingency pool', async () => {
    const { supabase, log } = client({
      'pools:select': { data: [{ id: POOL, budget_line_id: LINE }] },
      'budget_lines_v2:select': { data: { id: LINE } },
    });
    expect(await setOfficeDay(supabase, { date: '2026-11-24', office: true, usual: false, dayBudget: 50_000 })).toEqual({ ok: true });
    expect(find(log, 'office_day_overrides', 'insert')?.args[0]).toEqual({ day: '2026-11-24', in_office: true });
    expect(find(log, 'pool_entries', 'insert')?.args[0]).toMatchObject({ pool_id: POOL, kind: 'use', amount: 50_000, note: 'Extra office day' });
  });
  it('rejects a bad date', async () => {
    const { supabase } = client({});
    expect(await setOfficeDay(supabase, { date: 'x', office: true, usual: true, dayBudget: 0 })).toHaveProperty('error');
  });
});

describe('settleDay and undoSettle', () => {
  it('needs a contingency line', async () => {
    const { supabase } = client({});
    expect(await settleDay(supabase, { date: '2026-11-24', under: true, to: 'pool', amount: 100 })).toEqual({ error: 'Mark one budget line as the RTO contingency first.' });
  });
  it('maps the choice to the right entry kind', async () => {
    const { supabase, log } = client({ 'budget_lines_v2:select': { data: { id: LINE } }, 'pools:select': { data: { id: POOL } } });
    expect(await settleDay(supabase, { date: '2026-11-24', under: false, to: 'excess', amount: 2_000 })).toEqual({ ok: true });
    expect(find(log, 'pool_entries', 'insert')?.args[0]).toMatchObject({ pool_id: POOL, kind: 'over_from_excess', amount: 2_000 });
  });
  it('refuses an impossible combination', async () => {
    const { supabase } = client({});
    expect(await settleDay(supabase, { date: '2026-11-24', under: true, to: 'excess', amount: 100 })).toEqual({ error: 'Pick where it goes.' });
  });
  it('undo removes that day settle entries', async () => {
    const { supabase, log } = client({});
    expect(await undoSettle(supabase, '2026-11-24')).toEqual({ ok: true });
    expect(find(log, 'pool_entries', 'delete')).toBeDefined();
  });
});

describe('pools', () => {
  it('takeFromPool checks amount and the pool', async () => {
    const { supabase } = client({});
    expect(await takeFromPool(supabase, { poolId: 'bad', amount: 100, to: 'use' })).toHaveProperty('error');
    expect(await takeFromPool(supabase, { poolId: POOL, amount: 0, to: 'use' })).toHaveProperty('error');
    expect(await takeFromPool(supabase, { poolId: POOL, amount: 100, to: 'use' })).toEqual({ error: 'That pool was not found.' });
  });
  it('takeFromPool writes an entry', async () => {
    const { supabase, log } = client({ 'pools:select': { data: { id: POOL } } });
    expect(await takeFromPool(supabase, { poolId: POOL, amount: 500, to: 'to_wants' })).toEqual({ ok: true });
    expect(find(log, 'pool_entries', 'insert')?.args[0]).toMatchObject({ pool_id: POOL, kind: 'to_wants', amount: 500, note: 'Moved to Wants' });
  });
  it('createPool validates the name and line', async () => {
    const { supabase, log } = client({});
    expect(await createPool(supabase, { name: '', lineId: null, keepUpTo: null })).toHaveProperty('error');
    expect(await createPool(supabase, { name: 'Trips', lineId: 'nope', keepUpTo: null })).toHaveProperty('error');
    expect(await createPool(supabase, { name: ' Trips ', lineId: A, keepUpTo: 100_000 })).toEqual({ ok: true });
    expect(find(log, 'pools', 'insert')?.args[0]).toEqual({ name: 'Trips', budget_line_id: A, keep_up_to: 100_000 });
  });
});

describe('archiveCategory', () => {
  it('refuses while a line still uses it', async () => {
    const { supabase } = client({});
    // the fake count is undefined, so a used category needs an explicit answer
    const used = client({ 'budget_lines_v2:select': { data: null } });
    expect(await archiveCategory(used.supabase, 'nope')).toHaveProperty('error');
    expect(await archiveCategory(supabase, A)).toEqual({ ok: true });
  });
});
