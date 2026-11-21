import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { savePaydays } from './settingsWrite';

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
              if (prop === 'maybeSingle') {
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
const op = (log: { table: string; ops: Op[] }[], name: string) => log.find((e) => e.ops.some((o) => o.name === name))?.ops.find((o) => o.name === name);

describe('savePaydays', () => {
  it('updates the existing row with the cutoff start days that follow the paydays', async () => {
    const { supabase, log } = client({ 'user_settings:select': { data: { user_id: 'u' } } });
    expect(await savePaydays(supabase, { first: 10, second: 25 })).toEqual({ ok: true });
    expect(op(log, 'update')?.args[0]).toMatchObject({ first_payday_day: 10, second_payday_day: 25, first_cutoff_start_day: 11, second_cutoff_start_day: 25 });
  });

  it('creates the row the first time', async () => {
    const { supabase, log } = client({ 'user_settings:select': { data: null } });
    expect(await savePaydays(supabase, { first: 5, second: 20 })).toEqual({ ok: true });
    expect(op(log, 'insert')?.args[0]).toMatchObject({ first_payday_day: 5, second_payday_day: 20 });
  });

  it('checks the days like the web: first 1 to 27, second up to 28, at least two days apart', async () => {
    const { supabase, log } = client({});
    expect((await savePaydays(supabase, { first: 0, second: 25 })) as { error: string }).toHaveProperty('error');
    expect((await savePaydays(supabase, { first: 10, second: 29 })) as { error: string }).toHaveProperty('error');
    expect(await savePaydays(supabase, { first: 10, second: 11 })).toEqual({ error: 'The second payday has to be at least two days after the first.' });
    expect(log).toHaveLength(0);
  });

  it('reports a failed save plainly', async () => {
    const { supabase } = client({ 'user_settings:select': { data: { user_id: 'u' } }, 'user_settings:update': { error: { message: 'x' } } });
    expect(await savePaydays(supabase, { first: 10, second: 25 })).toEqual({ error: 'That did not save. Try again.' });
  });
});
