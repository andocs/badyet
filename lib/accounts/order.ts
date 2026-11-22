/**
 * Moves one account a place earlier or later in the list. Returns the ids in their new order, or null when the account is not in the
 * list or is already at that end. Callers renumber `sort` from the result, so accounts that all started at sort 0 get real positions.
 */
export function moveInOrder(ids: readonly string[], id: string, dir: "earlier" | "later"): string[] | null {
  const i = ids.indexOf(id);
  const j = dir === "earlier" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= ids.length) return null;
  const out = [...ids];
  [out[i], out[j]] = [out[j]!, out[i]!];
  return out;
}
