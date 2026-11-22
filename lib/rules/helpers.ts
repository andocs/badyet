/** Small pure helpers for the Rules page. */

export interface DedupeInput {
  windowMinutes: number;
  matchSource: boolean;
}

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

/** The duplicate rule: a whole number of minutes from 1 to 240. */
export function validateDedupe(i: DedupeInput): Result<DedupeInput> {
  if (!Number.isInteger(i.windowMinutes) || i.windowMinutes < 1 || i.windowMinutes > 240) return { ok: false, error: 'Pick a time from 1 minute to 4 hours.' };
  return { ok: true, value: { windowMinutes: i.windowMinutes, matchSource: i.matchSource === true } };
}

/** 90 minutes shows as 90 min; whole hours show as hours. */
export function windowParts(minutes: number): { amount: number; unit: 'min' | 'hours' } {
  return minutes > 0 && minutes % 60 === 0 ? { amount: minutes / 60, unit: 'hours' } : { amount: minutes, unit: 'min' };
}

export const windowMinutes = (amount: number, unit: 'min' | 'hours'): number => Math.round(unit === 'hours' ? amount * 60 : amount);

/** The new order of ids after moving one up or down a place, or null when it cannot move. */
export function reorder(ids: readonly string[], id: string, dir: 'up' | 'down'): string[] | null {
  const i = ids.indexOf(id);
  const j = dir === 'up' ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= ids.length) return null;
  const next = [...ids];
  [next[i], next[j]] = [next[j]!, next[i]!];
  return next;
}

/** A rule's name, or its first word when it has none. */
export const ruleTitle = (r: { name?: string | null; words?: readonly string[]; matchText: string }): string => r.name?.trim() || r.words?.[0] || r.matchText || 'Rule';

/** Adds a word to a list unless it is blank or already there (case-insensitive). */
export function addWord(list: readonly string[], word: string): string[] {
  const w = word.replace(/\s+/g, ' ').trim().toLowerCase();
  return w === '' || list.includes(w) ? [...list] : [...list, w];
}
