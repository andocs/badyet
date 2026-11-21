import { drainQueue, onQueued } from '@modules/notification-listener';
import * as Crypto from 'expo-crypto';
import 'expo-sqlite/localStorage/install';
import { useEffect, useRef, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import type { AccountLite } from '@/lib/capture/row';
import { applyAllowlist } from './allowlist';
import { loadCapture } from './capture';
import { runCapture, type Held, type RunContext, type RunDeps } from './captureRun';
import { outbox } from './outboxStore';
import { pairRecent } from './pairing';
import { useSession } from './session';
import { supabase } from './supabase';
import { useSync } from './sync';

const CTX_KEY = 'capture_ctx';
const HELD_KEY = 'capture_held';

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

// How many captures are waiting for an account, so a screen can say so.
let heldCount = read<Held[]>(HELD_KEY, []).length;
const listeners = new Set<() => void>();
const setHeldCount = (n: number) => {
  if (n === heldCount) return;
  heldCount = n;
  listeners.forEach((l) => l());
};
export const useHeldCount = () =>
  useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => heldCount,
  );

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

const deps: RunDeps = {
  loadContext,
  drain: drainQueue,
  readHeld: () => read<Held[]>(HELD_KEY, []),
  writeHeld: (h) => write(HELD_KEY, h),
  enqueue: (row) => outbox.add(row),
  hash: (text) => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, text),
  newId: () => Crypto.randomUUID(),
};

/**
 * Reads what the notification listener queued, turns it into pending items, sends them, and links moves between your own accounts.
 * Runs when you sign in, when the app comes to the front, and when a new notification arrives while it is open.
 * Notifications that arrive while the app is closed wait in the listener's queue until the next run.
 */
export function CaptureRunner() {
  const { session } = useSession();
  const { syncNow } = useSync();
  const signedIn = session !== null;
  const running = useRef(false);
  const again = useRef(false);

  useEffect(() => {
    if (!signedIn) return;
    const run = async () => {
      if (running.current) {
        again.current = true;
        return;
      }
      running.current = true;
      try {
        do {
          again.current = false;
          const s = await runCapture(deps);
          setHeldCount(s.held);
          if (s.added > 0) {
            await syncNow();
            await pairRecent(supabase);
          }
        } while (again.current);
      } catch {
        // Anything unexpected: the queue and held items are untouched, so the next trigger retries.
      } finally {
        running.current = false;
      }
    };
    const first = setTimeout(() => void run(), 0);
    const app = AppState.addEventListener('change', (st) => st === 'active' && void run());
    let sub: { remove(): void } | null = null;
    try {
      sub = onQueued(() => void run());
    } catch {
      sub = null;
    }
    return () => {
      clearTimeout(first);
      app.remove();
      sub?.remove();
    };
  }, [signedIn, syncNow]);

  return null;
}
