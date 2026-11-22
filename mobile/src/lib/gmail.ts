import type { GmailMessage } from '@/lib/capture/email';
import { fetchWithTimeout } from './http';

const BASE = 'https://gmail.googleapis.com/gmail/v1/users/me';

/** Google rejected the access token or the permission: sign in to Gmail again. */
export class GmailAuthError extends Error {}

async function call<T>(token: string, path: string, fetcher: typeof fetch): Promise<T> {
  const res = await fetcher(BASE + path, { headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 401 || res.status === 403) throw new GmailAuthError('Gmail needs you to sign in again.');
  if (!res.ok) throw new Error(`Gmail answered ${res.status}.`);
  return (await res.json()) as T;
}

/** Ids of messages matching a Gmail search, newest first. */
export async function listMessageIds(token: string, query: string, max = 50, fetcher: typeof fetch = fetchWithTimeout): Promise<string[]> {
  const r = await call<{ messages?: { id: string }[] }>(token, `/messages?q=${encodeURIComponent(query)}&maxResults=${max}`, fetcher);
  return (r.messages ?? []).map((m) => m.id);
}

export const getMessage = (token: string, id: string, fetcher: typeof fetch = fetchWithTimeout) =>
  call<GmailMessage>(token, `/messages/${encodeURIComponent(id)}?format=full`, fetcher);
