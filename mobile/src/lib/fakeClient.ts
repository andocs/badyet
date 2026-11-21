import type { SupabaseClient } from '@supabase/supabase-js';

// A stand-in Supabase client for tests only; the app never imports this file.
type Answer = { data?: unknown; error?: unknown };
export type Op = { name: string; args: unknown[] };
export type Call = { table: string; ops: Op[] };

/** Every query ends in `answers["table:op"]` (op = insert, update, delete or select); every call is recorded in `log`. */
export function client(answers: Record<string, Answer>) {
  const log: Call[] = [];
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

export const find = (log: Call[], table: string, name: string) => log.find((e) => e.table === table && e.ops.some((o) => o.name === name))?.ops.find((o) => o.name === name);
