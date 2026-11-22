import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { supabase } from './supabase';

/** A screen that has been in front again after this long loads fresh data. */
const STALE_MS = 20_000;
/** A load that has not answered by now is given up on, so a stuck request cannot leave the screen (or its spinner) waiting forever. */
const LOAD_TIMEOUT_MS = 25_000;
const message = (e: unknown) => (e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : '');
const expired = (e: unknown) => /jwt|token|expired|401/i.test(message(e));
const stuck = (e: unknown) => /timed out|abort|network request failed|failed to fetch|load failed/i.test(message(e));

class TimedOut extends Error {
  constructor() {
    super('Timed out. Pull down to try again.');
  }
}

function withTimeout<T>(work: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const limit = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new TimedOut()), LOAD_TIMEOUT_MS);
  });
  return Promise.race([work, limit]).finally(() => clearTimeout(timer));
}

/** Loads data when a screen gains focus; `reload` powers pull-to-refresh. */
export function useLoad<T>(load: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const loadRef = useRef(load);
  const lastRef = useRef(0);
  // Only the newest load may change the screen, so a slow older one cannot overwrite fresher data or an error.
  const latest = useRef(0);
  useEffect(() => {
    loadRef.current = load;
  });

  const run = useCallback(async () => {
    const mine = ++latest.current;
    const attempt = async () => {
      const result = await withTimeout(loadRef.current());
      if (mine === latest.current) {
        setData(result);
        setError(null);
      }
    };
    try {
      await attempt();
    } catch (first) {
      // An expired session, or a request left hanging while the phone was idle or a background task ran: get the session back
      // (it is read from storage, where the background task may have just renewed it) and try once more on a fresh connection.
      if (expired(first) || stuck(first) || first instanceof TimedOut) {
        try {
          await withTimeout(supabase.auth.getSession());
          await withTimeout(supabase.auth.refreshSession());
        } catch {
          // The retry below says what is wrong.
        }
        try {
          await attempt();
          lastRef.current = Date.now();
          return;
        } catch (second) {
          if (mine === latest.current) setError(message(second) || 'Could not load');
          return;
        }
      }
      if (mine === latest.current) setError(message(first) || 'Could not load');
    }
    lastRef.current = Date.now();
  }, []);

  // Load when the screen comes into focus, and again when the app returns to the front after a while.
  useFocusEffect(
    useCallback(() => {
      void run();
      const sub = AppState.addEventListener('change', (st) => {
        if (st === 'active' && Date.now() - lastRef.current > STALE_MS) void run();
      });
      return () => sub.remove();
    }, [run]),
  );

  const reload = useCallback(async () => {
    setRefreshing(true);
    try {
      await run();
    } finally {
      setRefreshing(false);
    }
  }, [run]);

  return { data, error, refreshing, reload };
}
