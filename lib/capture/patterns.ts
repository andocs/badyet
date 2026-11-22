import { compileTemplate } from './template';
import { isSource, type SourceKey } from './sources';

/** A notification wording you wrote yourself, read before the built-in readers. */
export interface CapturePattern {
  id: string;
  source: SourceKey;
  /** For example "You received {amount} from {name}". See template.ts. */
  template: string;
  /** Whether the money came in or went out. */
  direction: 'in' | 'out';
}

export interface PatternRow {
  id: string;
  source: string;
  template: string;
  direction: string;
}

export interface PatternInput {
  source: string;
  template: string;
  direction: string;
}

export const MAX_PATTERNS = 50;

export const patternsFromRows = (rows: readonly PatternRow[]): CapturePattern[] =>
  rows
    .filter((r) => isSource(r.source) && (r.direction === 'in' || r.direction === 'out') && compileTemplate(r.template).ok)
    .map((r) => ({ id: r.id, source: r.source as SourceKey, template: r.template, direction: r.direction as 'in' | 'out' }));

export type Checked<T> = { ok: true; value: T } | { ok: false; error: string };

export function validatePattern(i: PatternInput): Checked<{ source: SourceKey; template: string; direction: 'in' | 'out' }> {
  if (!isSource(i.source)) return { ok: false, error: 'Pick the app this pattern is for.' };
  if (i.direction !== 'in' && i.direction !== 'out') return { ok: false, error: 'Say whether the money comes in or goes out.' };
  const template = i.template.trim().replace(/\s+/g, ' ');
  const c = compileTemplate(template);
  if (!c.ok) return { ok: false, error: c.error };
  return { ok: true, value: { source: i.source, template, direction: i.direction } };
}
