import type { SupabaseClient } from '@supabase/supabase-js';
import { validatePaydays } from '@/lib/setup/input';

export type Result = { ok: true } | { error: string };

/** Updates your settings row, creating it the first time. */
async function saveSettingsRow(supabase: SupabaseClient, values: Record<string, unknown>): Promise<boolean> {
  const stamped = { ...values, updated_at: new Date().toISOString() };
  const existing = await supabase.from('user_settings').select('user_id').maybeSingle();
  const { error } = existing.data ? await supabase.from('user_settings').update(stamped).eq('user_id', existing.data.user_id) : await supabase.from('user_settings').insert(stamped);
  return !error;
}

/** The two paydays. Cutoffs run payday to payday, so the old cutoff start columns follow. Same rules as the web. */
export async function savePaydays(supabase: SupabaseClient, input: { first: number; second: number }): Promise<Result> {
  const v = validatePaydays(input.first, input.second);
  if (!v.ok) return { error: v.error };
  const ok = await saveSettingsRow(supabase, {
    first_payday_day: v.value.first,
    second_payday_day: v.value.second,
    first_cutoff_start_day: v.value.first + 1,
    second_cutoff_start_day: v.value.second,
  });
  return ok ? { ok: true } : { error: 'That did not save. Try again.' };
}
