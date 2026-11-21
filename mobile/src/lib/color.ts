import type { Palette } from './theme';

/** Envelope colours arrive as the web's CSS variables ("var(--accent)"); map them to the phone's palette. Hex colours pass through. */
export function resolveColor(color: string, c: Palette): string {
  const m = /^var\(--([a-z-]+)\)$/.exec(color);
  if (!m) return color;
  const map: Record<string, string> = { accent: c.accent, blue: c.blue, gold: c.gold, violet: c.violet, teal: c.teal, pink: c.pink };
  return map[m[1]!] ?? c.accent;
}
