import { describe, expect, it } from 'vitest';
import { resolveColor } from './color';
import type { Palette } from './theme';

const c = { accent: '#a', blue: '#b', gold: '#g', violet: '#v', teal: '#t', pink: '#p' } as unknown as Palette;

describe('resolveColor', () => {
  it('maps the web css variables to the palette', () => {
    expect(resolveColor('var(--accent)', c)).toBe('#a');
    expect(resolveColor('var(--violet)', c)).toBe('#v');
  });
  it('falls back to the accent for an unknown variable and keeps hex colours', () => {
    expect(resolveColor('var(--nope)', c)).toBe('#a');
    expect(resolveColor('#123456', c)).toBe('#123456');
  });
});
