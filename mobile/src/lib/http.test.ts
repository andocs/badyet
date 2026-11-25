import { afterEach, describe, expect, it, vi } from 'vitest';

import { fetchWithTimeout, inflightNow, REQUEST_TIMEOUT_MS, withLimit } from './http';

vi.mock('expo-sqlite/localStorage/install', () => ({}));
vi.mock('react-native', () => ({ AppState: { currentState: 'active', addEventListener: vi.fn(() => ({ remove: vi.fn() })) } }));

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('withLimit', () => {
  it('returns what the work returns when it is quick', async () => {
    await expect(withLimit(Promise.resolve(5), 1000, 'quick')).resolves.toBe(5);
  });
  it('gives up on work that never finishes', async () => {
    vi.useFakeTimers();
    const p = withLimit(new Promise<number>(() => {}), 1000, 'hangs');
    await vi.advanceTimersByTimeAsync(1000);
    await expect(p).resolves.toBeUndefined();
  });
});

describe('fetchWithTimeout', () => {
  it('cancels a request that never answers, and stops counting it as waiting', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', (_url: string, init?: RequestInit) => new Promise((_res, rej) => init?.signal?.addEventListener('abort', () => rej(new DOMException('aborted', 'AbortError')))));
    const p = fetchWithTimeout('https://example.com/rest/v1/x?select=secret');
    const caught = p.catch((e: unknown) => e);
    expect(inflightNow().n).toBe(1);
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS + 10);
    expect(await caught).toMatchObject({ name: 'AbortError' });
    expect(inflightNow().n).toBe(0);
  });
  it('passes a good answer through', async () => {
    vi.stubGlobal('fetch', async () => new Response('ok', { status: 200 }));
    const res = await fetchWithTimeout('https://example.com/a');
    expect(res.status).toBe(200);
    expect(inflightNow().n).toBe(0);
  });
});
