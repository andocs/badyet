import type { SupabaseClient } from '@supabase/supabase-js';
import { installedApps, seenPackages } from '@modules/notification-listener';

export interface AppInfo {
  package: string;
  label: string;
}

export interface SenderInfo {
  address: string;
  emails: number;
}

/** What the phone can offer the app picker. Empty lists when the installed build lacks the native part. */
export function readPhoneApps(): { installed: AppInfo[]; recent: string[] } {
  let recent: string[] = [];
  try {
    recent = seenPackages();
  } catch {}
  return { installed: installedApps(), recent };
}

/**
 * Tells the database which apps the phone has, so the web's Rules page can offer them (the web cannot see the phone).
 * Rows for apps no longer installed are removed. Nothing is written when the phone reported no apps.
 */
export async function syncDeviceApps(supabase: SupabaseClient, installed: readonly AppInfo[], recent: readonly string[]): Promise<void> {
  if (installed.length === 0) return;
  const notified = new Set(recent);
  const now = new Date().toISOString();
  const rows = installed
    .filter((a) => a.package.length >= 3 && a.package.length <= 200)
    .map((a) => ({ package: a.package, label: a.label.slice(0, 100), seen: notified.has(a.package) ? 'notified' : 'installed', updated_at: now }));
  for (let i = 0; i < rows.length; i += 200) {
    const { error } = await supabase.from('device_apps').upsert(rows.slice(i, i + 200), { onConflict: 'user_id,package' });
    if (error) return;
  }
  const have = new Set(rows.map((r) => r.package));
  const { data } = await supabase.from('device_apps').select('package');
  const gone = ((data ?? []) as { package: string }[]).map((r) => r.package).filter((p) => !have.has(p));
  if (gone.length > 0) await supabase.from('device_apps').delete().in('package', gone);
}

/** Email addresses seen in Gmail, most frequent first. An older database without the table gives an empty list. */
export async function loadSeenSenders(supabase: SupabaseClient): Promise<SenderInfo[]> {
  const { data, error } = await supabase.from('seen_senders').select('address, emails').order('emails', { ascending: false }).limit(100);
  return error ? [] : ((data ?? []) as SenderInfo[]);
}
