import type { DestKind } from "./view";

/** The swatches a fund can be, and the colours a custom bonus line is drawn in (never one a fund already uses). */
export const FUND_COLORS = [
  "#34D399", "#7FA8FF", "#F6C453", "#C4A0FF", "#5CD0E6", "#F28BC8",
  "#10B981", "#3B82F6", "#F59E0B", "#8B5CF6", "#06B6D4", "#EC4899",
  "#EF4444", "#F97316", "#84CC16", "#14B8A6", "#6366F1", "#A8A29E",
] as const;

const GOLD = "#F6C453";

interface DestRef {
  kind: DestKind;
  targetId: string | null;
  name: string;
}

/** Identifies a destination across cards: a fund by its id, anything else by its name. */
export const destKey = (d: DestRef): string => `${d.kind}|${d.targetId ?? d.name}`;

const hash = (s: string): number => {
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
};

/**
 * One colour per destination. A fund keeps its own colour. Every other line gets a colour from the palette that no fund uses and no other
 * line already has, picked from its name so it stays the same when you add or remove other lines. Pass `base` to keep colours already
 * handed out and only fill in the new ones.
 */
export function destColors(funds: readonly { id: string; color: string | null }[], dests: readonly DestRef[], base: Readonly<Record<string, string>> = {}): Record<string, string> {
  const out: Record<string, string> = { ...base };
  const fundColor = new Map(funds.map((f) => [f.id, f.color ?? FUND_COLORS[0]]));
  // The "Not placed yet" bar is gold, so gold is never given to a custom line either.
  const taken = new Set([GOLD, ...fundColor.values(), ...Object.values(base)].map((c) => c.toLowerCase()));
  const free = FUND_COLORS.filter((c) => !taken.has(c.toLowerCase()));
  const usedFree = new Set<number>();
  const seen = new Set<string>();
  for (const d of [...dests].sort((a, b) => destKey(a).localeCompare(destKey(b)))) {
    const k = destKey(d);
    if (seen.has(k) || out[k]) continue;
    seen.add(k);
    if (d.kind === "fund") {
      out[k] = fundColor.get(d.targetId ?? "") ?? FUND_COLORS[0];
      continue;
    }
    if (free.length === 0) {
      out[k] = FUND_COLORS[hash(k) % FUND_COLORS.length]!;
      continue;
    }
    let i = hash(k) % free.length;
    while (usedFree.has(i) && usedFree.size < free.length) i = (i + 1) % free.length;
    usedFree.add(i);
    out[k] = free[i]!;
  }
  return out;
}
