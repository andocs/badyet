import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { saveInstance } from './bonusesWrite';

const RULE = '44444444-4444-4444-8444-444444444444';
const FUND = '55555555-5555-4555-8555-555555555555';
const INST = '66666666-6666-4666-8666-666666666666';

type Answer = { data?: unknown; error?: unknown };
type Op = { name: string; args: unknown[] };

function client(answers: Record<string, Answer>) {
  const log: { table: string; ops: Op[] }[] = [];
  const c = {
    from(table: string) {
      const ops: Op[] = [];
      const key = () => table + ':' + (ops.find((o) => ['insert', 'update', 'delete'].includes(o.name))?.name ?? 'select');
      const make = (): unknown =>
        new Proxy({}, {
          get(_t, prop: string) {
            if (prop === 'then') {
              log.push({ table, ops });
              return (resolve: (v: unknown) => void) => resolve({ data: null, error: null, ...answers[key()] });
            }
            return (...args: unknown[]) => {
              ops.push({ name: prop, args });
              if (prop === 'maybeSingle' || prop === 'single') {
                log.push({ table, ops });
                return Promise.resolve({ data: null, error: null, ...answers[key()] });
              }
              return make();
            };
          },
        });
      return make();
    },
  };
  return { supabase: c as unknown as SupabaseClient, log };
}
const op = (log: { table: string; ops: Op[] }[], table: string, name: string) => log.find((e) => e.table === table && e.ops.some((o) => o.name === name))?.ops.find((o) => o.name === name);

const input = { ruleId: RULE, year: 2027, multiplierNum: 100, splits: [{ kind: 'fund', targetId: FUND, label: null, amount: 5_000_000, done: true }], received: null };

describe('saveInstance', () => {
  it('creates the year’s instance the first time and replaces its destinations', async () => {
    const { supabase, log } = client({
      'bonus_rules:select': { data: { id: RULE } },
      'funds:select': { data: [{ id: FUND }] },
      'bonus_instances:select': { data: null },
      'bonus_instances:insert': { data: { id: INST } },
    });
    expect(await saveInstance(supabase, input)).toEqual({ ok: true });
    expect(op(log, 'bonus_instances', 'insert')?.args[0]).toEqual({ rule_id: RULE, year: 2027, status: 'planned', multiplier_num: 100 });
    expect(op(log, 'bonus_instance_splits', 'delete')).toBeDefined();
    expect(op(log, 'bonus_instance_splits', 'insert')?.args[0]).toEqual([{ instance_id: INST, target_kind: 'fund', target_id: null, label: null, amount: 5_000_000, done: true }]);
  });

  it('updates an existing instance and records what arrived', async () => {
    const { supabase, log } = client({
      'bonus_rules:select': { data: { id: RULE } },
      'bonus_instances:select': { data: { id: INST } },
    });
    const r = await saveInstance(supabase, { ...input, splits: [], received: { gross: 6_400_000, deMinimis: 0, net: 5_900_000 } });
    expect(r).toEqual({ ok: true });
    expect(op(log, 'bonus_instances', 'update')?.args[0]).toEqual({ multiplier_num: 100, status: 'received', gross_actual: 6_400_000, de_minimis_actual: 0, net_actual: 5_900_000, tax_actual: 500_000 });
    expect(op(log, 'bonus_instance_splits', 'insert')).toBeUndefined();
  });

  it('refuses a bonus that is not there', async () => {
    expect(await saveInstance(client({}).supabase, input)).toEqual({ error: 'That bonus was not found.' });
  });

  it('rejects bad input before touching the database', async () => {
    const { supabase, log } = client({});
    expect((await saveInstance(supabase, { ...input, ruleId: 'nope' })) as { error: string }).toHaveProperty('error');
    expect(log).toHaveLength(0);
  });

  it('reports a failed destination save plainly', async () => {
    const { supabase } = client({
      'bonus_rules:select': { data: { id: RULE } },
      'funds:select': { data: [{ id: FUND }] },
      'bonus_instances:select': { data: { id: INST } },
      'bonus_instance_splits:insert': { error: { message: 'x' } },
    });
    expect(await saveInstance(supabase, input)).toEqual({ error: 'Saved the bonus but not its destinations. Try again.' });
  });
});
