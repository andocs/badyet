import type { SupabaseClient } from '@supabase/supabase-js';
import { EXPORTS, isExportName, toCsv, type ExportName } from '@/lib/export/csv';

export { EXPORTS };
export type { ExportName };

/** One of your tables as CSV text, the same as the web download. Row-level security limits it to your own rows. */
export async function exportCsv(supabase: SupabaseClient, name: string): Promise<{ ok: true; csv: string } | { error: string }> {
  if (!isExportName(name)) return { error: 'That export was not found.' };
  const { data, error } = await supabase.from(name).select('*');
  if (error) return { error: 'Export failed. Try again.' };
  return { ok: true, csv: toCsv((data ?? []) as Record<string, unknown>[]) };
}
