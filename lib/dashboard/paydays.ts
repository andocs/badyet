import type { CutoffRule } from "./helpers";

// The two days each cutoff starts on. The 1st starts on a day from 2 to 27, the 2nd on a later day up to 28,
// so the 2nd cutoff always ends the day before the 1st starts in the next month.
export function parsePaydays(first: unknown, second: unknown): CutoffRule | null {
  const read = (v: unknown) => {
    const t = typeof v === "string" ? v.trim() : "";
    return /^\d{1,2}$/.test(t) ? Number(t) : NaN;
  };
  const a = read(first);
  const b = read(second);
  if (!Number.isInteger(a) || !Number.isInteger(b) || a < 2 || b > 28 || a >= b) return null;
  return { firstStartDay: a, secondStartDay: b };
}
