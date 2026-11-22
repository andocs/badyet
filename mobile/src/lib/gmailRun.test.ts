import { describe, expect, it } from 'vitest';
import type { GmailMessage } from '@/lib/capture/email';
import { defaultConfig, SOURCES, type CaptureRule } from '@/lib/capture/sources';
import type { Held, RunContext } from './captureRun';
import { getMessage, GmailAuthError, listMessageIds } from './gmail';
import { remember, type Recent } from '@/lib/capture/recent';
import { runGmail, type GmailDeps } from './gmailRun';

const b64url = (s: string) => Buffer.from(s, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const rows = (pairs: [string, string][]) => pairs.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('');
const mail = (id: string, from: string, subject: string, html: string): GmailMessage => ({
  id,
  internalDate: '1795233316000',
  payload: { mimeType: 'text/html', headers: [{ name: 'From', value: from }, { name: 'Subject', value: subject }], body: { data: b64url(html) } },
});

const BPI_IN = `<table>${rows([['Reference Number', 'REF-1'], ['Transfer To', 'XXXXXXXXXX8167'], ['Bank Name', 'Maya Philippines, Inc.'], ['Transfer Amount', 'PHP 50.00']])}</table>`;
const incoming = (id = 'm1') => mail(id, 'bpiinstapay@bpi.com.ph', 'Incoming Interbank Funds Transfer Confirmation', BPI_IN);

function setup(over: { messages?: GmailMessage[]; token?: string | null; ctx?: Partial<RunContext> | null; seen?: string[]; held?: Held[]; recent?: Recent[]; listError?: Error } = {}) {
  const messages = over.messages ?? [incoming()];
  let seen = over.seen ?? [];
  let held = over.held ?? [];
  let recent = over.recent ?? [];
  const calls = { list: 0, get: 0 };
  const deps: GmailDeps = {
    loadContext: async () => (over.ctx === null ? null : { configs: SOURCES.map(defaultConfig), rules: [], accounts: [], ...over.ctx }),
    token: async () => (over.token === undefined ? 'tok' : over.token),
    list: async () => {
      calls.list += 1;
      if (over.listError) throw over.listError;
      return messages.map((m) => m.id);
    },
    get: async (_t, id) => {
      calls.get += 1;
      return messages.find((m) => m.id === id)!;
    },
    readSeen: () => seen,
    writeSeen: (ids) => void (seen = ids),
    readHeld: () => held,
    writeHeld: (h) => void (held = h),
    hash: async (s) => `h(${s})`,
    readRecent: () => recent,
    writeRecent: (r) => void (recent = r),
  };
  return { deps, calls, seen: () => seen, held: () => held, recent: () => recent };
}

describe('runGmail', () => {
  it('skips an email whose phone alert was already seen (even one you dropped) and notes a new email', async () => {
    const alert = { source: 'bpi', direction: 'in', amount: 5_000 } as never;
    const seenFirst = setup({ recent: remember([], 'notification', alert, 1795233316000 - 120_000) });
    expect(await runGmail(seenFirst.deps)).toMatchObject({ status: 'ok', found: 0, skipped: 1 });
    expect(seenFirst.held()).toHaveLength(0);

    const fresh = setup();
    await runGmail(fresh.deps);
    expect(fresh.recent()).toMatchObject([{ origin: 'import', source: 'bpi', direction: 'in', amount: 5_000 }]);
  });

  it('turns a BPI email into a held capture marked as an import, and remembers the message', async () => {
    const t = setup();
    expect(await runGmail(t.deps)).toEqual({ status: 'ok', checked: 1, found: 1, ignored: 0, skipped: 0 });
    expect(t.held()).toHaveLength(1);
    expect(t.held()[0]).toMatchObject({ origin: 'import', hash: 'h(bpi|ref|REF-1)', postTime: 1795233316000, parsed: { source: 'bpi', direction: 'in', amount: 5_000, accountHint: '8167' } });
    expect(JSON.stringify(t.held())).not.toContain('Transfer Amount'); // no email text kept
    expect(t.seen()).toEqual(['m1']);
  });

  it('reports the sender addresses it saw, lowercase, and survives a failing callback', async () => {
    const t = setup({ messages: [incoming('m1'), mail('m2', 'Someone <Person@Example.COM>', 'Hi', '<p>hello</p>'), incoming('m3')] });
    let counts: Record<string, number> = {};
    t.deps.noteSenders = (c) => void (counts = c);
    await runGmail(t.deps);
    expect(counts).toEqual({ 'bpiinstapay@bpi.com.ph': 2, 'person@example.com': 1 });

    const bad = setup();
    bad.deps.noteSenders = () => {
      throw new Error('boom');
    };
    expect(await runGmail(bad.deps)).toMatchObject({ status: 'ok', found: 1 });
  });

  it('reads a message only once', async () => {
    const t = setup({ seen: ['m1'] });
    expect(await runGmail(t.deps)).toMatchObject({ status: 'ok', checked: 0, found: 0 });
    expect(t.calls.get).toBe(0);
  });

  it('does nothing when Gmail is not connected or no source sends email', async () => {
    const off = setup({ token: null });
    expect(await runGmail(off.deps)).toEqual({ status: 'not-connected' });
    expect(off.calls.list).toBe(0);

    const none = setup({ ctx: { configs: SOURCES.map((s) => ({ ...defaultConfig(s), enabled: false })) } });
    expect(await runGmail(none.deps)).toEqual({ status: 'no-sources' });

    expect(await runGmail(setup({ ctx: null }).deps)).toEqual({ status: 'no-settings' });
  });

  it('marks unknown senders and non-money mail as seen without keeping anything', async () => {
    const t = setup({
      messages: [mail('a', 'someone@example.com', 'Hi', '<p>hello</p>'), mail('b', 'onlinebanking@bpi.com.ph', 'Your eStatement', '<p>statement attached</p>')],
    });
    expect(await runGmail(t.deps)).toEqual({ status: 'ok', checked: 2, found: 0, ignored: 2, skipped: 0 });
    expect(t.held()).toEqual([]);
    expect(t.seen()).toEqual(['a', 'b']);
  });

  it('applies your keyword rules', async () => {
    const rule: CaptureRule = { id: 'r', source: 'bpi', matchText: 'maya', action: 'ignore', categoryId: null };
    const t = setup({ ctx: { rules: [rule] } });
    expect(await runGmail(t.deps)).toMatchObject({ found: 0, skipped: 1 });
    expect(t.held()).toEqual([]);
  });

  it('keeps one item when the same reference arrives in two emails', async () => {
    const t = setup({ messages: [incoming('m1'), incoming('m2')] });
    expect(await runGmail(t.deps)).toMatchObject({ found: 1, skipped: 1 });
    expect(t.held()).toHaveLength(1);
  });

  it('reads at most 30 new messages per run, leaving the rest for next time', async () => {
    const many = Array.from({ length: 45 }, (_, i) => incoming(`m${i}`));
    const t = setup({ messages: many });
    expect(await runGmail(t.deps)).toMatchObject({ checked: 30 });
    expect(t.seen()).toHaveLength(30);
  });

  it('on an error changes nothing, so the next run starts clean', async () => {
    const t = setup({ listError: new Error('network') });
    await expect(runGmail(t.deps)).rejects.toThrow('network');
    expect(t.seen()).toEqual([]);
    expect(t.held()).toEqual([]);
  });
});

describe('Gmail requests', () => {
  const fakeFetch = (status: number, body: unknown) => {
    const seen: { url: string; auth: string | null }[] = [];
    const f = (async (url: string, init?: RequestInit) => {
      seen.push({ url, auth: (init?.headers as Record<string, string>)?.Authorization ?? null });
      return { status, ok: status >= 200 && status < 300, json: async () => body } as Response;
    }) as unknown as typeof fetch;
    return { f, seen };
  };

  it('lists ids with the search encoded and the token as a bearer', async () => {
    const { f, seen } = fakeFetch(200, { messages: [{ id: 'a' }, { id: 'b' }] });
    expect(await listMessageIds('tok', 'from:(a@b.com) newer_than:3d', 50, f)).toEqual(['a', 'b']);
    expect(seen[0]).toEqual({ url: 'https://gmail.googleapis.com/gmail/v1/users/me/messages?q=from%3A(a%40b.com)%20newer_than%3A3d&maxResults=50', auth: 'Bearer tok' });
  });
  it('an empty mailbox is an empty list', async () => {
    expect(await listMessageIds('t', 'q', 50, fakeFetch(200, {}).f)).toEqual([]);
  });
  it('fetches one message in full', async () => {
    const { f, seen } = fakeFetch(200, { id: 'a' });
    await getMessage('tok', 'a/b', f);
    expect(seen[0]!.url).toBe('https://gmail.googleapis.com/gmail/v1/users/me/messages/a%2Fb?format=full');
  });
  it('401 and 403 mean sign in again; other failures are plain errors', async () => {
    await expect(listMessageIds('t', 'q', 50, fakeFetch(401, {}).f)).rejects.toBeInstanceOf(GmailAuthError);
    await expect(getMessage('t', 'a', fakeFetch(403, {}).f)).rejects.toBeInstanceOf(GmailAuthError);
    await expect(listMessageIds('t', 'q', 50, fakeFetch(500, {}).f)).rejects.toThrow('Gmail answered 500.');
  });
});
