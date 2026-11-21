import { onQueued } from '@modules/notification-listener';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { registerBackgroundCapture } from './backgroundCapture';
import { requestCapture } from './captureEngine';
import { useSession } from './session';
import { useSync } from './sync';

export { useCaptureStatus, useHeldCount, type CaptureStatus } from './captureEngine';

let trigger: ((forceGmail: boolean) => void) | null = null;
/** Runs capture now. `forceGmail` checks Gmail even if it was checked a minute ago. */
export const triggerCapture = (forceGmail = false) => trigger?.(forceGmail);

/**
 * Runs capture while the app is open: when you sign in, when the app comes to the front, and when a new notification arrives.
 * While the app is closed the same work runs from the listener (headless) and from a 15 minute background task; see backgroundCapture.ts.
 */
export function CaptureRunner() {
  const { session } = useSession();
  const { syncNow } = useSync();
  const signedIn = session !== null;

  useEffect(() => {
    if (!signedIn) return;
    const run = (forceGmail: boolean) => void requestCapture({ forceGmail, source: 'app', send: syncNow });
    trigger = run;
    void registerBackgroundCapture();

    const first = setTimeout(() => run(false), 0);
    const app = AppState.addEventListener('change', (st) => st === 'active' && run(false));
    let sub: { remove(): void } | null = null;
    try {
      sub = onQueued(() => run(false));
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
