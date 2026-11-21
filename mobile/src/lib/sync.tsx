import * as Network from 'expo-network';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { flushQueue, type Queued } from './expense';
import { outbox } from './outboxStore';
import { useSession } from './session';
import { supabase } from './supabase';

type Ctx = {
  /** What is waiting on the phone, oldest first. */
  queued: Queued[];
  syncing: boolean;
  /** Sends what is waiting now. Safe to call any time. */
  syncNow: () => Promise<void>;
  /** Re-reads the queue (after adding or deleting). */
  refresh: () => Promise<void>;
  remove: (id: string) => Promise<void>;
};

const SyncCtx = createContext<Ctx>({ queued: [], syncing: false, syncNow: async () => {}, refresh: async () => {}, remove: async () => {} });

/** Keeps the phone's queue and the server in step: on launch, on coming back to the app, and when signal returns. */
export function SyncProvider({ children }: { children: ReactNode }) {
  const [queued, setQueued] = useState<Queued[]>([]);
  const [syncing, setSyncing] = useState(false);
  const running = useRef(false);
  const { session } = useSession();
  const signedIn = session !== null;

  const refresh = useCallback(async () => setQueued(await outbox.all()), []);

  const syncNow = useCallback(async () => {
    // Signed out, the database would reject every row; wait for a session instead of marking them failed.
    if (!signedIn) {
      await refresh();
      return;
    }
    if (running.current) return;
    running.current = true;
    setSyncing(true);
    try {
      await flushQueue(outbox, supabase);
    } catch {
      // Network trouble: the queue is untouched and the next trigger tries again.
    } finally {
      running.current = false;
      setSyncing(false);
      await refresh();
    }
  }, [refresh, signedIn]);

  const remove = useCallback(
    async (id: string) => {
      await outbox.remove(id);
      await refresh();
    },
    [refresh],
  );

  useEffect(() => {
    const first = setTimeout(() => void syncNow(), 0);
    const app = AppState.addEventListener('change', (s) => s === 'active' && void syncNow());
    const net = Network.addNetworkStateListener((e) => e.isInternetReachable && void syncNow());
    return () => {
      clearTimeout(first);
      app.remove();
      net.remove();
    };
  }, [syncNow]);

  const value = useMemo(() => ({ queued, syncing, syncNow, refresh, remove }), [queued, syncing, syncNow, refresh, remove]);
  return <SyncCtx.Provider value={value}>{children}</SyncCtx.Provider>;
}

export const useSync = () => useContext(SyncCtx);
