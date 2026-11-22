import type { SupabaseClient } from '@supabase/supabase-js';
import { readDiag } from './diag';

const UPLOADED_KEY = 'diag_uploaded_t';
const MIN_BETWEEN_MS = 60_000;
let last = 0;

/**
 * Sends the diagnostic log entries not yet sent to the app_diagnostics table, so they can be read on the web (Settings > Diagnostics).
 * Called when a load has just worked, which is when the connection is known to be good. A missing table or a failure changes nothing.
 */
export async function uploadDiag(supabase: SupabaseClient): Promise<void> {
  const now = Date.now();
  if (now - last < MIN_BETWEEN_MS) return;
  last = now;
  try {
    const since = Number(localStorage.getItem(UPLOADED_KEY) ?? 0);
    const fresh = readDiag().filter((x) => x.t > since).slice(-200);
    if (fresh.length === 0) return;
    const { error } = await supabase.from('app_diagnostics').insert(fresh.map((x) => ({ at: new Date(x.t).toISOString(), session: x.s, event: x.e, detail: x.d ?? null })));
    if (!error) localStorage.setItem(UPLOADED_KEY, String(fresh[fresh.length - 1]!.t));
  } catch {}
}
