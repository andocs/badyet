import type { SupabaseClient } from '@supabase/supabase-js';
import { heldToRow } from '@/lib/capture/held';
import type { Held } from './captureRun';

/**
 * Decides what to do so the phone's held captures and the held_captures table agree (the web shows and answers the table).
 * `synced` is what this phone has already uploaded, so a row that has gone from the table was answered elsewhere.
 */
export function planHeldSync(local: readonly string[], synced: ReadonlySet<string>, server: ReadonlySet<string>) {
  const answeredElsewhere = local.filter((h) => synced.has(h) && !server.has(h));
  const keep = local.filter((h) => !answeredElsewhere.includes(h));
  const upload = keep.filter((h) => !server.has(h));
  // Placed by the phone since it was uploaded (an account became known): the table row is out of date.
  const staleOnServer = [...synced].filter((h) => server.has(h) && !keep.includes(h));
  const nextSynced = new Set(keep);
  return { keep, upload, staleOnServer, nextSynced };
}

export interface HeldIO {
  read: () => Held[];
  write: (held: Held[]) => void;
  readSynced: () => string[];
  writeSynced: (hashes: string[]) => void;
}

/** Brings the table and the phone's held list into line. Does nothing if the table cannot be read (offline, or not created yet). */
export async function syncHeld(supabase: SupabaseClient, io: HeldIO): Promise<void> {
  const r = await supabase.from('held_captures').select('hash');
  if (r.error) return;
  const server = new Set(((r.data ?? []) as { hash: string }[]).map((x) => x.hash));
  const local = io.read();
  const plan = planHeldSync(
    local.map((h) => h.hash),
    new Set(io.readSynced()),
    server,
  );
  const byHash = new Map(local.map((h) => [h.hash, h]));

  if (plan.upload.length > 0) {
    const { error } = await supabase.from('held_captures').upsert(
      plan.upload.map((hash) => heldToRow(byHash.get(hash)!)),
      { onConflict: 'user_id,hash', ignoreDuplicates: true },
    );
    // Not uploaded: it stays on the phone only and is tried again next time.
    if (error) plan.upload.forEach((hash) => plan.nextSynced.delete(hash));
  }
  if (plan.staleOnServer.length > 0) await supabase.from('held_captures').delete().in('hash', plan.staleOnServer);
  if (plan.keep.length !== local.length) io.write(local.filter((h) => plan.keep.includes(h.hash)));
  io.writeSynced([...plan.nextSynced]);
}
