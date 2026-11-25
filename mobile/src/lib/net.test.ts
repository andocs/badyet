import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { networkAnswers, PROBE_MS } from './net';

vi.mock('react-native', () => ({ AppState: { currentState: 'active', addEventListener: vi.fn(() => ({ remove: vi.fn() })) } }));

beforeEach(() => {
  process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'anon';
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('networkAnswers', () => {
  it('is true when the server answers', async () => {
    vi.stubGlobal('fetch', async () => new Response('{}', { status: 200 }));
    await expect(networkAnswers('test')).resolves.toBe(true);
  });
  it('is false when the request fails', async () => {
    vi.stubGlobal('fetch', async () => {
      throw new Error('Network request failed');
    });
    await expect(networkAnswers('test')).resolves.toBe(false);
  });
  it('is false when the request never answers', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', (_u: string, init?: RequestInit) => new Promise((_res, rej) => init?.signal?.addEventListener('abort', () => rej(new Error('aborted')))));
    const p = networkAnswers('test');
    await vi.advanceTimersByTimeAsync(PROBE_MS + 10);
    await expect(p).resolves.toBe(false);
  });
});
