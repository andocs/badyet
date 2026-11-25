import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { useHeldCount } from './captureEngine';
import { supabase } from './supabase';
import { useSync } from './sync';

/** How often the number is checked while the app is open, so a capture that arrives shows up without opening the Inbox. */
const EVERY_MS = 60_000;

/**
 * What is waiting in the Inbox: pending items on the server plus captures held on the phone until an account is chosen. Shown as the
 * Inbox tab's badge. It re-checks when the app comes to the front, when a capture is held or answered, after the phone's queue sends,
 * and once a minute.
 */
export function useInboxCount(): number {
  const held = useHeldCount();
  const { queued } = useSync();
  const [pending, setPending] = useState(0);

  const load = useCallback(async () => {
    try {
      const r = await supabase.from('transactions').select('id', { count: 'exact', head: true }).eq('status', 'pending');
      if (!r.error) setPending(r.count ?? 0);
    } catch {
      // Offline or slow: keep the last number.
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load() sets state only after an await, not during the effect.
    void load();
    const app = AppState.addEventListener('change', (s) => s === 'active' && void load());
    const timer = setInterval(() => void load(), EVERY_MS);
    return () => {
      app.remove();
      clearInterval(timer);
    };
  }, [load]);

  // A capture was held or answered, or the queue just sent something: the count may have changed.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- as above: the count is set after the request returns.
    void load();
  }, [held, queued.length, load]);

  return pending + held;
}
