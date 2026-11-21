import type { SupabaseClient } from '@supabase/supabase-js';
import type { TxnInsert } from '@/lib/capture/row';
import { parsePesos } from '@/lib/domain/money';

const MAX_CENTAVOS = 100_000_000_000; // same limit as the database check
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A transaction waiting to be sent: a quick-add expense, or something captured from a notification. Same columns the web inserts. */
export type ExpenseRow = TxnInsert;

export interface Queued {
  row: ExpenseRow;
  tries: number;
  lastError: string | null;
}

export type Built = { ok: true; row: ExpenseRow } | { error: string };

/** Validates the form like the web action does, and stamps the time the expense was entered (not when it syncs). */
export function buildExpense(
  input: { id: string; amountText: string; merchant: string; accountId: string | null; categoryId: string | null },
  now: Date = new Date(),
): Built {
  const amount = parsePesos(input.amountText);
  if (amount === undefined || amount <= 0) return { error: 'Enter an amount above zero, like 250 or 1,250.50.' };
  if (amount > MAX_CENTAVOS) return { error: 'That amount is too large.' };
  if (!input.accountId || !UUID.test(input.accountId)) return { error: 'Pick an account.' };
  if (input.categoryId !== null && !UUID.test(input.categoryId)) return { error: 'Pick a category from the list.' };
  const merchant = input.merchant.trim().slice(0, 80) || null;
  const iso = now.toISOString();
  return {
    ok: true,
    row: {
      id: input.id,
      account_id: input.accountId,
      occurred_at: iso,
      amount: -amount,
      merchant,
      kind: 'expense',
      category_id: input.categoryId,
      source: 'manual',
      status: 'confirmed',
      confirmed_at: iso,
    },
  };
}

export interface QueueStore {
  all(): Promise<Queued[]>;
  add(row: ExpenseRow): Promise<void>;
  remove(id: string): Promise<void>;
  fail(id: string, message: string): Promise<void>;
}

/** A database rejection (bad data, permission) will never succeed on retry; a network failure or expired login will. */
const isPermanent = (e: { code?: string }) => !!e.code && !e.code.startsWith('PGRST30');

/**
 * Sends everything waiting. The row id is made on the phone and the write ignores duplicates, so sending twice is safe.
 * A network problem stops the run and keeps everything; a rejected row is marked and the rest carry on.
 */
export async function flushQueue(store: QueueStore, supabase: SupabaseClient): Promise<{ sent: number; left: number }> {
  let sent = 0;
  const items = await store.all();
  for (const item of items) {
    const { error } = await supabase.from('transactions').upsert(item.row, { onConflict: 'id', ignoreDuplicates: true });
    if (!error) {
      await store.remove(item.row.id);
      sent += 1;
    } else if (error.code === '23505') {
      // The same notification was already captured (its dedupe hash exists): nothing more to send.
      await store.remove(item.row.id);
    } else if (isPermanent(error)) {
      await store.fail(item.row.id, error.message);
    } else {
      break;
    }
  }
  return { sent, left: (await store.all()).length };
}
