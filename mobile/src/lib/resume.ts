import 'expo-sqlite/localStorage/install';
import * as Updates from 'expo-updates';
import { AppState } from 'react-native';
import { diag, flushDiag } from './diag';
import { networkAnswers } from './net';

/** Away from the app at least this long, and it starts over when you come back (see installResumeGuard), whatever state it is in. */
export const IDLE_RELOAD_MS = 30 * 60_000;
/** Away at least this long, and a tiny request checks the network client on the way back. */
const PROBE_AFTER_MS = 60_000;
/** Never restart twice within this long, so a problem that survives a restart cannot become a restart loop. */
const MIN_BETWEEN_RELOADS_MS = 2 * 60_000;
const KEY = 'resume_reload_at';

const readLast = (): number | null => {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? Number(raw) : null;
  } catch {
    return null;
  }
};

/** Whether to start the app over now: it was away long enough, and has not just been restarted. */
export function shouldReload(leftAt: number | null, now: number, lastReloadAt: number | null, idleMs: number = IDLE_RELOAD_MS): boolean {
  if (leftAt === null || now - leftAt < idleMs) return false;
  return lastReloadAt === null || now - lastReloadAt >= MIN_BETWEEN_RELOADS_MS;
}

/**
 * Starts the app's JavaScript over (no reinstall, nothing lost that is saved). Used when the app is stuck: a phone that was idle, or
 * running background capture, can leave the app's internal state (a sign-in refresh, a timer, a half-finished request) wedged, and
 * everything that loads waits behind it. A fresh start clears all of that. Returns false when it declined or could not.
 */
export async function reloadApp(): Promise<boolean> {
  const now = Date.now();
  const last = readLast();
  if (last !== null && now - last < MIN_BETWEEN_RELOADS_MS) return false;
  try {
    localStorage.setItem(KEY, String(now));
    diag('reload-app');
    flushDiag();
    await Updates.reloadAsync();
    return true;
  } catch {
    // Not available (a development build): nothing to do.
    return false;
  }
}

/** Starts the app over when you come back to it after a long absence, before anything has a chance to be stuck. */
export function installResumeGuard(): () => void {
  let leftAt: number | null = null;
  const sub = AppState.addEventListener('change', (state) => {
    if (state === 'background') leftAt = Date.now();
    else if (state === 'active') {
      const was = leftAt;
      leftAt = null;
      const now = Date.now();
      if (shouldReload(was, now, readLast())) {
        void reloadApp();
        return;
      }
      // After a while away the network client can be left holding a dead connection. One tiny request tells, in about four seconds, and
      // if it fails the app starts over before any screen shows an error.
      if (was !== null && now - was >= PROBE_AFTER_MS) {
        void networkAnswers('resume').then((ok) => {
          if (!ok) void reloadApp();
        });
      }
    }
  });
  return () => sub.remove();
}
