import type { CaptureRule } from './sources';

/** A draft rule, placed where it would be tried, for the sample test. */
export function rulesWithDraft(saved: readonly CaptureRule[], draft: CaptureRule): CaptureRule[] {
  const at = saved.findIndex((r) => r.id === draft.id);
  if (at < 0) return [...saved, { ...draft, position: Math.max(0, ...saved.map((r) => r.position ?? 0)) + 1 }];
  return saved.map((r, i) => (i === at ? { ...draft, position: r.position } : r));
}
