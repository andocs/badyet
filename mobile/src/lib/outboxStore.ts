import * as SQLite from 'expo-sqlite';
import type { ExpenseRow, QueueStore, Queued } from './expense';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

function db() {
  dbPromise ??= SQLite.openDatabaseAsync('badyet.db').then(async (d) => {
    await d.execAsync(
      'CREATE TABLE IF NOT EXISTS outbox (id TEXT PRIMARY KEY NOT NULL, payload TEXT NOT NULL, created_at TEXT NOT NULL, tries INTEGER NOT NULL DEFAULT 0, last_error TEXT)',
    );
    return d;
  });
  return dbPromise;
}

/** Expenses saved on the phone that have not reached the server yet. */
export const outbox: QueueStore = {
  async all(): Promise<Queued[]> {
    const rows = await (await db()).getAllAsync<{ payload: string; tries: number; last_error: string | null }>(
      'SELECT payload, tries, last_error FROM outbox ORDER BY created_at',
    );
    return rows.map((r) => ({ row: JSON.parse(r.payload) as ExpenseRow, tries: r.tries, lastError: r.last_error }));
  },
  async add(row) {
    await (await db()).runAsync('INSERT OR IGNORE INTO outbox (id, payload, created_at) VALUES (?, ?, ?)', row.id, JSON.stringify(row), row.occurred_at);
  },
  async remove(id) {
    await (await db()).runAsync('DELETE FROM outbox WHERE id = ?', id);
  },
  async fail(id, message) {
    await (await db()).runAsync('UPDATE outbox SET tries = tries + 1, last_error = ? WHERE id = ?', message, id);
  },
};
