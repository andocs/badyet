import { describe, expect, it } from 'vitest';
import { exportCsv } from './exportData';
import { client } from './fakeClient';

describe('exportCsv', () => {
  it('refuses a table that is not on the list', async () => {
    const { supabase, log } = client({});
    expect(await exportCsv(supabase, 'auth.users')).toEqual({ error: 'That export was not found.' });
    expect(log).toHaveLength(0);
  });
  it('turns rows into CSV, quoting commas and guarding formulas', async () => {
    const { supabase } = client({ 'accounts:select': { data: [{ name: 'Bank, main', note: '=1+1' }] } });
    const r = await exportCsv(supabase, 'accounts');
    expect(r).toEqual({ ok: true, csv: 'name,note\r\n"Bank, main",\'=1+1\r\n' });
  });
  it('an error is a friendly message', async () => {
    const { supabase } = client({ 'accounts:select': { error: { code: 'x' } } });
    expect(await exportCsv(supabase, 'accounts')).toEqual({ error: 'Export failed. Try again.' });
  });
});
