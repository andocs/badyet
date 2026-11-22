import 'expo-sqlite/localStorage/install';
import * as Updates from 'expo-updates';
import { AppState } from 'react-native';

/** Away from the app at least this long, and it starts over when you come back (see installResumeGuard). */
export const IDLE_RELOAD_MS = 10 * 60_000;
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
      if (shouldReload(was, Date.now(), readLast())) void reloadApp();
    }
  });
  return () => sub.remove();
}
