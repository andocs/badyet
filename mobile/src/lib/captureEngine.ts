import { drainQueue } from '@modules/notification-listener';
import * as Crypto from 'expo-crypto';
import 'expo-sqlite/localStorage/install';
import { useSyncExternalStore } from 'react';
import { buildRow, type AccountLite, type TxnInsert } from '@/lib/capture/row';
import { applyAllowlist } from './allowlist';
import { loadCapture } from './capture';
import { runCapture, type Held, type RunContext, type RunDeps } from './captureRun';
import { getMessage, GmailAuthError, listMessageIds } from './gmail';
import { dropGmailToken, gmailToken } from './googleAuth';
import { runGmail, type GmailResult } from './gmailRun';
import { outbox } from './outboxStore';
import { pairRecent } from './pairing';
import { supabase } from './supabase';

// Everything capture does that is not a screen, so the app, the 15 minute background task and the headless notification task share it.

const CTX_KEY = 'capture_ctx';
const HELD_KEY = 'capture_held';
const SEEN_KEY = 'gmail_seen';
const GMAIL_LAST_KEY = 'gmail_last';
const GMAIL_ON_KEY = 'gmail_on';
const RECONNECT_KEY = 'gmail_reconnect';
const LAST_RUN_KEY = 'capture_last_run';
const GMAIL_EVERY_MS = 5 * 60_000;

const read = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};
const write = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
};

export type RunSource = 'app' | 'notification' | 'background';
export interface LastRun {
  at: number;
  source: RunSource;
  added: number;
}
export const readLastRun = (): LastRun | null => read<LastRun | null>(LAST_RUN_KEY, null);

// A tiny shared store so screens can show what capture is doing.
export interface CaptureStatus {
  /** Captures waiting for an account. */
  held: number;
  /** The same captures, so the Inbox can ask about each one. */
  heldItems: Held[];
  /** The last Gmail check. */
  gmail: (GmailResult & { at: number }) | { status: 'error'; message: string; at: number } | null;
  /** Gmail was connected but Google wants you to sign in again (the weekly re-sign-in). */
  reconnect: boolean;
}
let status: CaptureStatus = { held: read<Held[]>(HELD_KEY, []).length, heldItems: read<Held[]>(HELD_KEY, []), gmail: null, reconnect: read<boolean>(RECONNECT_KEY, false) };
const listeners = new Set<() => void>();
const setStatus = (patch: Partial<CaptureStatus>) => {
  status = { ...status, ...patch };
  listeners.forEach((l) => l());
};
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};
export const useCaptureStatus = () => useSyncExternalStore(subscribe, () => status);
export const useHeldCount = () => useSyncExternalStore(subscribe, () => status.held);
export const useHeldItems = () => useSyncExternalStore(subscribe, () => status.heldItems);
export const useGmailReconnect = () => useSyncExternalStore(subscribe, () => status.reconnect);

/** Called when Gmail is connected or disconnected, so a later expiry can be told from "never connected". */
export function setGmailConnected(on: boolean) {
  write(GMAIL_ON_KEY, on);
  if (!on) {
    write(RECONNECT_KEY, false);
    setStatus({ reconnect: false });
  }
}

function setReconnect(on: boolean) {
  if (status.reconnect === on) return;
  write(RECONNECT_KEY, on);
  setStatus({ reconnect: on });
}

/** Your capture settings and accounts; remembered so a capture still works with no signal. */
async function loadContext(): Promise<RunContext | null> {
  try {
    const [cap, acc] = await Promise.all([loadCapture(supabase), supabase.from('accounts').select('id, name, institution, last4').is('archived_at', null)]);
    if (acc.error) throw acc.error;
    const ctx: RunContext = { configs: cap.configs, rules: cap.rules, patterns: cap.patterns, accounts: (acc.data ?? []) as AccountLite[] };
    write(CTX_KEY, ctx);
    applyAllowlist(ctx.configs);
    return ctx;
  } catch {
    return read<RunContext | null>(CTX_KEY, null);
  }
}

const hash = (text: string) => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, text);

/** The same money movement already recorded within 3 minutes in the same account (the phone alert usually comes first). */
async function isDuplicate(row: TxnInsert): Promise<boolean> {
  const at = Date.parse(row.occurred_at);
  const { data } = await supabase
    .from('transactions')
    .select('id')
    .eq('account_id', row.account_id)
    .eq('amount', row.amount)
    .gte('occurred_at', new Date(at - 180_000).toISOString())
    .lte('occurred_at', new Date(at + 180_000).toISOString())
    .limit(1);
  return (data?.length ?? 0) > 0;
}

/**
 * You answered the Inbox's question about a capture that no account claimed: which of your accounts it belongs to and, if the other
 * side is also yours, which one. It joins the Inbox as a pending row (naming the other account when there is one, so the pairing can
 * make it a transfer) and stops being held. Drop it with `accountId: null`.
 */
export async function resolveHeld(args: { hash: string; accountId: string | null; other?: { name: string } | null; send?: () => Promise<void> | void }): Promise<void> {
  const all = read<Held[]>(HELD_KEY, []);
  const h = all.find((x) => x.hash === args.hash);
  if (!h) return;
  if (args.accountId) {
    const parsed = args.other ? { ...h.parsed, counterparty: args.other.name } : h.parsed;
    const decision = { ...h.decision, status: 'pending' as const, accountId: args.accountId };
    const row = buildRow({ id: Crypto.randomUUID(), parsed, decision, accountId: args.accountId, postTime: h.postTime, hash: h.hash, source: h.origin });
    await outbox.add(row);
  }
  const rest = all.filter((x) => x.hash !== args.hash);
  write(HELD_KEY, rest);
  setStatus({ held: rest.length, heldItems: rest });
  if (args.accountId) {
    await args.send?.();
    await pairRecent(supabase);
  }
}

const captureDeps: RunDeps = {
  loadContext,
  drain: drainQueue,
  readHeld: () => read<Held[]>(HELD_KEY, []),
  writeHeld: (h) => write(HELD_KEY, h),
  enqueue: (row) => outbox.add(row),
  hash,
  newId: () => Crypto.randomUUID(),
  isDuplicate,
};

async function checkGmail(): Promise<void> {
  try {
    const r = await runGmail({
      loadContext,
      token: gmailToken,
      list: (t, q) => listMessageIds(t, q),
      get: (t, id) => getMessage(t, id),
      readSeen: () => read<string[]>(SEEN_KEY, []),
      writeSeen: (ids) => write(SEEN_KEY, ids),
      readHeld: captureDeps.readHeld,
      writeHeld: captureDeps.writeHeld,
      hash,
    });
    // "Not connected" after it was connected means the weekly sign-in ran out.
    if (r.status === 'ok') {
      write(GMAIL_ON_KEY, true);
      setReconnect(false);
    } else if (r.status === 'not-connected' && read<boolean>(GMAIL_ON_KEY, false)) {
      setReconnect(true);
    }
    setStatus({ gmail: { ...r, at: Date.now() } });
  } catch (e) {
    if (e instanceof GmailAuthError) {
      const t = await gmailToken();
      if (t) await dropGmailToken(t);
      if (read<boolean>(GMAIL_ON_KEY, false)) setReconnect(true);
    }
    setStatus({ gmail: { status: 'error', message: e instanceof Error ? e.message : 'Could not check Gmail.', at: Date.now() } });
  }
}

let running = false;
let again = false;
let againForce = false;

/**
 * One capture cycle: Gmail (when due or forced), then the listener queue, then sending and pairing.
 * Safe to call from anywhere at any time: if a cycle is already running it asks for one more pass and returns.
 */
export async function requestCapture(opts: { forceGmail: boolean; source: RunSource; send: () => Promise<void> }): Promise<void> {
  if (running) {
    again = true;
    againForce = againForce || opts.forceGmail;
    return;
  }
  running = true;
  let added = 0;
  try {
    let force = opts.forceGmail;
    do {
      again = false;
      if (force || Date.now() - read<number>(GMAIL_LAST_KEY, 0) > GMAIL_EVERY_MS) {
        write(GMAIL_LAST_KEY, Date.now());
        await checkGmail();
      }
      const s = await runCapture(captureDeps);
      setStatus({ held: s.held, heldItems: read<Held[]>(HELD_KEY, []) });
      added += s.added;
      if (s.added > 0) {
        await opts.send();
        await pairRecent(supabase);
      }
      force = againForce;
      againForce = false;
    } while (again);
    write(LAST_RUN_KEY, { at: Date.now(), source: opts.source, added } satisfies LastRun);
  } catch {
    // Anything unexpected: the queue and held items are untouched, so the next trigger retries.
  } finally {
    running = false;
  }
}
