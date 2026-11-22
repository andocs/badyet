import { diag } from './diag';

/**
 * Every request gives up after this long. After the phone has been idle or a background task was running, a request can be left
 * waiting on a dead connection; everything behind it then waits too. Cutting it off lets the next try start on a fresh connection.
 */
export const REQUEST_TIMEOUT_MS = 20_000;
/** Requests slower than this are written to the diagnostic log, and so is every failure. */
const SLOW_MS = 2_000;

const inflight = new Map<number, { at: number; label: string }>();
let nextId = 1;

/** How many requests are waiting right now and how long the oldest has waited, for the diagnostic log. */
export function inflightNow(): { n: number; oldestMs: number } {
  const now = Date.now();
  let oldest = 0;
  for (const r of inflight.values()) oldest = Math.max(oldest, now - r.at);
  return { n: inflight.size, oldestMs: oldest };
}

const labelOf = (input: string | URL | Request, method: string) => {
  try {
    const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url;
    const u = new URL(raw);
    // Host and path only: no query, no credentials.
    return `${method} ${u.host}${u.pathname}`;
  } catch {
    return method;
  }
};

/** fetch with a time limit, and a note in the diagnostic log of anything slow or failed. */
export const fetchWithTimeout: typeof fetch = (input, init) => {
  const ctl = new AbortController();
  const id = nextId++;
  const at = Date.now();
  const label = labelOf(input, init?.method ?? 'GET');
  inflight.set(id, { at, label });
  const timer = setTimeout(() => ctl.abort(), REQUEST_TIMEOUT_MS);
  init?.signal?.addEventListener('abort', () => ctl.abort());
  return fetch(input as RequestInfo, { ...init, signal: ctl.signal }).then(
    (res) => {
      const ms = Date.now() - at;
      if (ms >= SLOW_MS || res.status >= 500) diag('http', { req: label, ms, status: res.status });
      return res;
    },
    (err: unknown) => {
      diag('http-fail', { req: label, ms: Date.now() - at, err: err instanceof Error ? err.name : 'error', aborted: ctl.signal.aborted });
      throw err;
    },
  ).finally(() => {
    clearTimeout(timer);
    inflight.delete(id);
  });
};

/**
 * Waits for `work` at most `ms`; if it has not finished by then, gives up on waiting (the work itself cannot be cancelled) and
 * returns undefined, noting it in the diagnostic log. For things that can hang with no limit of their own.
 */
export function withLimit<T>(work: Promise<T>, ms: number, label: string): Promise<T | undefined> {
  let timer: ReturnType<typeof setTimeout>;
  const at = Date.now();
  const gaveUp = new Promise<undefined>((resolve) => {
    timer = setTimeout(() => {
      diag('limit', { what: label, ms: Date.now() - at });
      resolve(undefined);
    }, ms);
  });
  return Promise.race([work, gaveUp]).finally(() => clearTimeout(timer));
}
