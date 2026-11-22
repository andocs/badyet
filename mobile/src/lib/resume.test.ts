import { describe, expect, it, vi } from 'vitest';

vi.mock('expo-sqlite/localStorage/install', () => ({}));
vi.mock('expo-updates', () => ({ reloadAsync: vi.fn() }));
vi.mock('react-native', () => ({ AppState: { addEventListener: vi.fn(() => ({ remove: vi.fn() })) } }));

import { IDLE_RELOAD_MS, shouldReload } from './resume';

const MIN = 60_000;

describe('shouldReload', () => {
  it('starts over after a long absence', () => {
    expect(shouldReload(0, IDLE_RELOAD_MS, null)).toBe(true);
    expect(shouldReload(0, IDLE_RELOAD_MS + 5 * MIN, null)).toBe(true);
  });
  it('leaves a short absence alone', () => {
    expect(shouldReload(0, IDLE_RELOAD_MS - 1, null)).toBe(false);
  });
  it('does nothing when it never left (a fresh start)', () => {
    expect(shouldReload(null, 99 * MIN, null)).toBe(false);
  });
  it('does not restart twice in a row', () => {
    const now = 60 * MIN;
    expect(shouldReload(now - IDLE_RELOAD_MS, now, now - MIN)).toBe(false);
    expect(shouldReload(now - IDLE_RELOAD_MS, now, now - 3 * MIN)).toBe(true);
  });
});
