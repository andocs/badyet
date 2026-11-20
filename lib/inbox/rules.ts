export interface MerchantRule {
  id: string;
  /** Case-insensitive "contains" text. */
  pattern: string;
  categoryId: string;
  /** null = any account. */
  accountId: string | null;
  priority: number;
}

/** A merchant as it is stored in a rule: trimmed, spaces collapsed, at most 80 characters. Null when nothing is left. */
export function normalizePattern(merchant: string | null | undefined): string | null {
  const text = (merchant ?? "").replace(/\s+/g, " ").trim().slice(0, 80);
  return text === "" ? null : text;
}

/**
 * The rule that applies to a new pending row, if any. A rule matches when its pattern is contained in the merchant (ignoring case) and
 * its account, if it names one, is the row's account. The highest priority wins, then the longer (more specific) pattern, then the id.
 */
export function matchRule(merchant: string | null, accountId: string, rules: readonly MerchantRule[]): MerchantRule | null {
  const text = (merchant ?? "").toLowerCase();
  if (text === "") return null;
  const hits = rules.filter((r) => (r.accountId === null || r.accountId === accountId) && r.pattern !== "" && text.includes(r.pattern.toLowerCase()));
  hits.sort((a, b) => b.priority - a.priority || b.pattern.length - a.pattern.length || a.id.localeCompare(b.id));
  return hits[0] ?? null;
}

/** A best guess from past purchases: the category you used most for the same merchant (ignoring case). Null when there is no history. */
export function bestGuess(merchant: string | null, history: readonly { merchant: string | null; categoryId: string | null }[]): string | null {
  const key = (merchant ?? "").trim().toLowerCase();
  if (key === "") return null;
  const counts = new Map<string, number>();
  for (const h of history) {
    if (h.categoryId === null || (h.merchant ?? "").trim().toLowerCase() !== key) continue;
    counts.set(h.categoryId, (counts.get(h.categoryId) ?? 0) + 1);
  }
  let best: string | null = null;
  let top = 0;
  for (const [id, n] of counts) if (n > top) { best = id; top = n; }
  return best;
}
