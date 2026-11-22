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

/** The kinds of account in the order they are listed, and what each group is called. */
export const KIND_ORDER = ["ewallet", "debit", "savings", "credit", "cash"] as const;
export const KIND_LABEL: Record<string, string> = { ewallet: "E-wallets", debit: "Debit", savings: "Savings", credit: "Credit cards", cash: "Cash" };

/**
 * Moves an account one place within its own group (its kind): it swaps with the nearest account of the same kind, whatever sits between
 * them in the full list. Null when it is already first or last in its group, or is not in the list.
 */
export function moveWithinGroup(ids: readonly string[], kindOf: (id: string) => string, id: string, dir: "earlier" | "later"): string[] | null {
  const i = ids.indexOf(id);
  if (i < 0) return null;
  const step = dir === "earlier" ? -1 : 1;
  for (let j = i + step; j >= 0 && j < ids.length; j += step) {
    if (kindOf(ids[j]!) === kindOf(id)) {
      const out = [...ids];
      [out[i], out[j]] = [out[j]!, out[i]!];
      return out;
    }
  }
  return null;
}

/** Puts `id` where `before` is (dragging one card onto another): the dragged account takes the target's place and the rest shift. */
export function dropOn(ids: readonly string[], id: string, onto: string): string[] | null {
  const from = ids.indexOf(id);
  const to = ids.indexOf(onto);
  if (from < 0 || to < 0 || from === to) return null;
  const out = ids.filter((x) => x !== id);
  out.splice(to, 0, id);
  return out;
}
