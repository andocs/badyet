import type { SupabaseClient } from '@supabase/supabase-js';
import 'expo-sqlite/localStorage/install';

export interface Picker { id: string; name: string }
export interface Pickers { accounts: Picker[]; categories: Picker[]; offline: boolean }

const KEY = 'pickers';

function readCache(): Pickers | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? ({ ...(JSON.parse(raw) as Pickers), offline: true } satisfies Pickers) : null;
  } catch {
    return null;
  }
}

/**
 * The accounts and categories Quick add offers. Remembered on the phone so you can still add an expense with no signal.
 * Order matches the web: by `sort`, archived ones left out, the first account is the default.
 */
export async function loadPickers(supabase: SupabaseClient): Promise<Pickers> {
  const [a, c] = await Promise.all([
    supabase.from('accounts').select('id, name').is('archived_at', null).order('sort'),
    supabase.from('categories').select('id, name').is('archived_at', null).neq('name', 'Transfer').order('sort'),
  ]);
  if (!a.error && !c.error) {
    const fresh = { accounts: (a.data ?? []) as Picker[], categories: (c.data ?? []) as Picker[] };
    try {
      localStorage.setItem(KEY, JSON.stringify(fresh));
    } catch {}
    return { ...fresh, offline: false };
  }
  const cached = readCache();
  if (cached) return cached;
  throw a.error ?? c.error ?? new Error('Could not load accounts');
}
