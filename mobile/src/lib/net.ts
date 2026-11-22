import { diag } from './diag';

/** How long the phone's network client gets to answer a tiny request before it is treated as dead. */
export const PROBE_MS = 4_000;

/**
 * Asks the server one tiny question (its health check) to learn whether the app's network client works at all. After the phone has
 * idled, the client can be left holding a connection that died, and then every request waits on it for ever. This tells that apart
 * from a slow screen in about four seconds. Returns true when the server answered with anything.
 */
export async function networkAnswers(why: string): Promise<boolean> {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return true;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), PROBE_MS);
  const at = Date.now();
  let ok = false;
  try {
    const res = await fetch(`${url}/auth/v1/health`, { headers: { apikey: key }, signal: ctl.signal });
    ok = res.status > 0;
  } catch {
    ok = false;
  } finally {
    clearTimeout(timer);
  }
  diag('net-probe', { why, ok, ms: Date.now() - at });
  return ok;
}
