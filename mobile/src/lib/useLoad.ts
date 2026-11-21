import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { supabase } from './supabase';

/** A screen that has been in front again after this long loads fresh data. */
const STALE_MS = 20_000;
const expired = (e: unknown) => /jwt|token|expired|401/i.test(e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : '');

/** Loads data when a screen gains focus; `reload` powers pull-to-refresh. */
export function useLoad<T>(load: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const loadRef = useRef(load);
  const lastRef = useRef(0);
  useEffect(() => {
    loadRef.current = load;
  });

  const run = useCallback(async () => {
    try {
      setData(await loadRef.current());
      setError(null);
    } catch (e) {
      // A session that expired while the app was away: get a fresh one and try once more.
      if (expired(e)) {
        try {
          await supabase.auth.refreshSession();
          setData(await loadRef.current());
          setError(null);
          lastRef.current = Date.now();
          return;
        } catch (e2) {
          e = e2;
        }
      }
      setError(e instanceof Error ? e.message : 'Could not load');
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
    await run();
    setRefreshing(false);
  }, [run]);

  return { data, error, refreshing, reload };
}
