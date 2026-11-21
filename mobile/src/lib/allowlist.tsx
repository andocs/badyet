import { setAllowedPackages } from '@modules/notification-listener';
import { useEffect } from 'react';
import { allowedPackages } from '@/lib/capture/sources';
import { loadCapture } from './capture';
import { useSession } from './session';
import { supabase } from './supabase';

/** Tells the Android listener which apps to queue notifications from. Changing it needs no new build. */
export function applyAllowlist(configs: Parameters<typeof allowedPackages>[0]) {
  setAllowedPackages(allowedPackages(configs));
}

/** Loads your capture settings once you are signed in and applies them to the listener. */
export function AllowlistSync() {
  const { session } = useSession();
  const signedIn = session !== null;
  useEffect(() => {
    if (!signedIn) return;
    let cancelled = false;
    loadCapture(supabase)
      .then((d) => {
        if (!cancelled) applyAllowlist(d.configs);
      })
      .catch(() => {
        // Offline: the listener keeps the list it already has.
      });
    return () => {
      cancelled = true;
    };
  }, [signedIn]);
  return null;
}
