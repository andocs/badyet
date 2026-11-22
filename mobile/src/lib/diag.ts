
/**
 * A short diagnostic log, kept on the phone and uploaded when the app is healthy, for finding out what hangs when the app sticks.
 * It records events and timings only: what happened, how long it took, which request path (never the address's query, a header, a
 * body, a notification's text or an amount).
 */
export interface DiagEntry {
  /** Milliseconds since 1970. */
  t: number;
  /** Which start of the app's JavaScript wrote it: the same value for one run, a new one after a restart or a headless start. */
  s: string;
  e: string;
  d?: Record<string, string | number | boolean | null>;
}

const KEY = 'diag_log';
const KEEP = 400;
export const SESSION = Math.random().toString(36).slice(2, 8);

let buffer: DiagEntry[] = [];
let loaded = false;
let flushTimer: ReturnType<typeof setTimeout> | null = null;

// The phone's storage is installed when the app starts; an event written before that is held in memory and merged in afterwards.
const store = (): Storage | null => (typeof localStorage !== 'undefined' ? localStorage : null);

function load() {
  if (loaded) return;
  const st = store();
  if (!st) return;
  loaded = true;
  try {
    const raw = st.getItem(KEY);
    const earlier = raw ? (JSON.parse(raw) as DiagEntry[]) : [];
    buffer = [...earlier, ...buffer].slice(-KEEP);
  } catch {}
}

export function flushDiag() {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = null;
  load();
  try {
    store()?.setItem(KEY, JSON.stringify(buffer));
  } catch {}
}

/** Adds one event. Cheap enough to call anywhere. */
export function diag(e: string, d?: DiagEntry['d']) {
  load();
  buffer.push({ t: Date.now(), s: SESSION, e, ...(d ? { d } : {}) });
  if (buffer.length > KEEP) buffer = buffer.slice(-KEEP);
  // Saved a moment later, and straight away when the app leaves the screen.
  if (!flushTimer) flushTimer = setTimeout(flushDiag, 1500);
}

export const readDiag = (): DiagEntry[] => {
  load();
  return [...buffer];
};

export function clearDiag() {
  buffer = [];
  flushDiag();
}
