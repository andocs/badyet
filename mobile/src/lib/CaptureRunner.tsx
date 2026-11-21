import { drainQueue, onQueued } from '@modules/notification-listener';
import * as Crypto from 'expo-crypto';
import 'expo-sqlite/localStorage/install';
import { useEffect, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import type { AccountLite, TxnInsert } from '@/lib/capture/row';
import { applyAllowlist } from './allowlist';
import { loadCapture } from './capture';
import { runCapture, type Held, type RunContext, type RunDeps } from './captureRun';
import { getMessage, GmailAuthError, listMessageIds } from './gmail';
import { dropGmailToken, gmailToken } from './googleAuth';
import { runGmail, type GmailResult } from './gmailRun';
import { outbox } from './outboxStore';
import { pairRecent } from './pairing';
import { useSession } from './session';
import { supabase } from './supabase';
import { useSync } from './sync';

const CTX_KEY = 'capture_ctx';
const HELD_KEY = 'capture_held';
const SEEN_KEY = 'gmail_seen';
const GMAIL_EVERY_MS = 5 * 60_000;

const read = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};
const write = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
};

// A tiny shared store so screens can show what capture is doing.
export interface CaptureStatus {
  /** Captures waiting for an account. */
  held: number;
  /** The last Gmail check. */
  gmail: (GmailResult & { at: number }) | { status: 'error'; message: string; at: number } | null;
}
let status: CaptureStatus = { held: read<Held[]>(HELD_KEY, []).length, gmail: null };
const listeners = new Set<() => void>();
const setStatus = (patch: Partial<CaptureStatus>) => {
  status = { ...status, ...patch };
  listeners.forEach((l) => l());
};
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};
export const useCaptureStatus = () => useSyncExternalStore(subscribe, () => status);
export const useHeldCount = () => useSyncExternalStore(subscribe, () => status.held);

/** Your capture settings and accounts; remembered so a capture still works with no signal. */
async function loadContext(): Promise<RunContext | null> {
  try {
    const [cap, acc] = await Promise.all([loadCapture(supabase), supabase.from('accounts').select('id, name, institution, last4').is('archived_at', null)]);
    if (acc.error) throw acc.error;
    const ctx: RunContext = { configs: cap.configs, rules: cap.rules, accounts: (acc.data ?? []) as AccountLite[] };
    write(CTX_KEY, ctx);
    applyAllowlist(ctx.configs);
    return ctx;
  } catch {
    return read<RunContext | null>(CTX_KEY, null);
  }
}

const hash = (text: string) => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, text);

/** The same money movement already recorded within 3 minutes in the same account (the phone alert usually comes first). */
async function isDuplicate(row: TxnInsert): Promise<boolean> {
  const at = Date.parse(row.occurred_at);
  const { data } = await supabase
    .from('transactions')
    .select('id')
    .eq('account_id', row.account_id)
    .eq('amount', row.amount)
    .gte('occurred_at', new Date(at - 180_000).toISOString())
    .lte('occurred_at', new Date(at + 180_000).toISOString())
    .limit(1);
  return (data?.length ?? 0) > 0;
}

const captureDeps: RunDeps = {
  loadContext,
  drain: drainQueue,
  readHeld: () => read<Held[]>(HELD_KEY, []),
  writeHeld: (h) => write(HELD_KEY, h),
  enqueue: (row) => outbox.add(row),
  hash,
  newId: () => Crypto.randomUUID(),
  isDuplicate,
};

async function checkGmail(): Promise<void> {
  try {
    const r = await runGmail({
      loadContext,
      token: gmailToken,
      list: (t, q) => listMessageIds(t, q),
      get: (t, id) => getMessage(t, id),
      readSeen: () => read<string[]>(SEEN_KEY, []),
      writeSeen: (ids) => write(SEEN_KEY, ids),
      readHeld: captureDeps.readHeld,
      writeHeld: captureDeps.writeHeld,
      hash,
    });
    setStatus({ gmail: { ...r, at: Date.now() } });
  } catch (e) {
    if (e instanceof GmailAuthError) {
      const t = await gmailToken();
      if (t) await dropGmailToken(t);
    }
    setStatus({ gmail: { status: 'error', message: e instanceof Error ? e.message : 'Could not check Gmail.', at: Date.now() } });
  }
}

let trigger: ((forceGmail: boolean) => void) | null = null;
/** Runs capture now. `forceGmail` checks Gmail even if it was checked a minute ago. */
export const triggerCapture = (forceGmail = false) => trigger?.(forceGmail);

/**
 * Reads what the notification listener queued and recent bank and shop emails, turns them into pending items, sends them,
 * and links moves between your own accounts. Runs when you sign in, when the app comes to the front, and when a new
 * notification arrives while it is open. Notifications that arrive while the app is closed wait safely in the listener's queue.
 */
export function CaptureRunner() {
  const { session } = useSession();
  const { syncNow } = useSync();
  const signedIn = session !== null;

  useEffect(() => {
    if (!signedIn) return;
    let running = false;
    let again = false;
    let againForce = false;
    let lastGmail = 0;

    const run = async (forceGmail: boolean) => {
      if (running) {
        again = true;
        againForce = againForce || forceGmail;
        return;
      }
      running = true;
      try {
        let force = forceGmail;
        do {
          again = false;
          if (force || Date.now() - lastGmail > GMAIL_EVERY_MS) {
            lastGmail = Date.now();
            await checkGmail();
          }
          const s = await runCapture(captureDeps);
          setStatus({ held: s.held });
          if (s.added > 0) {
            await syncNow();
            await pairRecent(supabase);
          }
          force = againForce;
          againForce = false;
        } while (again);
      } catch {
        // Anything unexpected: the queue and held items are untouched, so the next trigger retries.
      } finally {
        running = false;
      }
    };
    trigger = (f) => void run(f);

    const first = setTimeout(() => void run(false), 0);
    const app = AppState.addEventListener('change', (st) => st === 'active' && void run(false));
    let sub: { remove(): void } | null = null;
    try {
      sub = onQueued(() => void run(false));
    } catch {
      sub = null;
    }
    return () => {
      clearTimeout(first);
      app.remove();
      sub?.remove();
      trigger = null;
    };
  }, [signedIn, syncNow]);

  return null;
}
