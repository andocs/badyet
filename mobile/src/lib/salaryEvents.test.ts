import { describe, expect, it } from 'vitest';
import { client, find } from './fakeClient';
import { addSalaryEvent, resetTemplates, saveTemplates } from './salaryEvents';

const LINE = '44444444-4444-4444-8444-444444444444';
const EV = '66666666-6666-4666-8666-666666666666';

describe('addSalaryEvent', () => {
  it('rejects nonsense before any write', async () => {
    const { supabase, log } = client({});
    expect(await addSalaryEvent(supabase, { kind: 'merit', status: 'confirmed', month: '2026-13' })).toHaveProperty('error');
    expect(log).toHaveLength(0);
  });
  it('saves a percent merit raise with a top-up', async () => {
    const { supabase, log } = client({ 'budget_lines_v2:select': { data: [{ id: LINE }] }, 'salary_events:insert': { data: { id: EV } } });
    const r = await addSalaryEvent(supabase, { kind: 'merit', status: 'expected', month: '2027-03', pctBp: 500, allocations: [{ lineId: LINE, mode: 'percent', pctBp: 5_000 }] });
    expect(r).toEqual({ ok: true });
    expect(find(log, 'salary_events', 'insert')?.args[0]).toMatchObject({ effective_month: '2027-03-01', kind: 'merit', pct_bp: 500, status: 'expected', allowance_id: null });
    expect(find(log, 'raise_allocations', 'insert')?.args[0]).toEqual([{ salary_event_id: EV, budget_line_id: LINE, mode: 'percent', amount: null, pct_bp: 5_000 }]);
  });
  it('a new allowance is added first, and removed if the event fails', async () => {
    const { supabase, log } = client({ 'allowances:insert': { data: { id: 'al' } }, 'salary_events:insert': { error: { code: 'x' } } });
    const r = await addSalaryEvent(supabase, { kind: 'allowance', status: 'confirmed', month: '2026-12', allowance: { name: 'Meal', amount: 100_000, frequency: 'monthly', cutoff: 'second', taxable: false }, allocations: [] });
    expect(r).toEqual({ error: 'Could not save the event. Try again.' });
    expect(find(log, 'allowances', 'delete')).toBeDefined();
  });
  it('says so when a budget line is missing', async () => {
    const { supabase } = client({ 'budget_lines_v2:select': { data: [] } });
    expect(await addSalaryEvent(supabase, { kind: 'merit', status: 'confirmed', month: '2027-03', pctBp: 500, allocations: [{ lineId: LINE, mode: 'amount', amount: 100 }] })).toEqual({ error: 'One of those budget lines was not found.' });
  });
});

describe('payslip templates', () => {
  const lines = [{ kind: 'earning', label: 'Basic', source: 'base_share', shareBp: 5_000 }];
  it('replaces the month and writes both cutoffs lines', async () => {
    const { supabase, log } = client({ 'payslip_templates:insert': { data: [{ id: 't1', cutoff: 'first' }, { id: 't2', cutoff: 'second' }] } });
    expect(await saveTemplates(supabase, { month: '2026-12', first: lines, second: lines })).toEqual({ ok: true });
    expect(find(log, 'payslip_templates', 'delete')).toBeDefined();
    const rows = find(log, 'payslip_lines', 'insert')?.args[0] as { template_id: string; sort: number }[];
    expect(rows.map((r) => [r.template_id, r.sort])).toEqual([['t1', 0], ['t2', 0]]);
  });
  it('a custom line needs an amount', async () => {
    const { supabase } = client({});
    expect(await saveTemplates(supabase, { month: '2026-12', first: [{ kind: 'deduction', label: 'Loan', source: 'custom' }], second: [] })).toHaveProperty('error');
  });
  it('resetTemplates needs a month', async () => {
    const { supabase } = client({});
    expect(await resetTemplates(supabase, 'nope')).toEqual({ error: 'Pick a month.' });
    expect(await resetTemplates(supabase, '2026-12')).toEqual({ ok: true });
  });
});
