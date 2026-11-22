import { decide } from '@/lib/capture/decide';
import { canParseEmail, gmailQuery, parseEmail, readEmail, sourceForEmail, type GmailMessage } from '@/lib/capture/email';
import { isRepeat, remember, type Recent } from '@/lib/capture/recent';
import { dedupeKey } from '@/lib/capture/row';
import type { Held, RunContext } from './captureRun';

export interface GmailDeps {
  loadContext: () => Promise<RunContext | null>;
  /** A fresh access token, or null when Gmail is not connected. */
  token: () => Promise<string | null>;
  list: (token: string, query: string) => Promise<string[]>;
  get: (token: string, id: string) => Promise<GmailMessage>;
  /** Message ids already looked at. */
  readSeen: () => string[];
  writeSeen: (ids: string[]) => void;
  readHeld: () => Held[];
  writeHeld: (held: Held[]) => void;
  hash: (text: string) => Promise<string>;
  /** What notifications and emails saw recently, to tell an email from a phone alert for the same movement. */
  readRecent?: () => Recent[];
  writeRecent?: (recent: Recent[]) => void;
  /** Called once at the end with how many emails each sender (lowercase address) sent in this run, for the Rules page's sender picker. */
  noteSenders?: (counts: Record<string, number>) => void;
}

export type GmailResult =
  | { status: 'not-connected' | 'no-sources' | 'no-settings' }
  | { status: 'ok'; checked: number; found: number; ignored: number; skipped: number };

const DAYS = 3;
const MAX_PER_RUN = 30;
const MAX_SEEN = 500;
const MAX_HELD = 200;

/**
 * Looks at recent email from your enabled sources and adds what it understands to the held list. The normal capture run then
 * places those items (account, duplicate check, send). Message ids are remembered so an email is read once; only parsed facts
 * are kept, never the email text. A network or sign-in error stops the run and leaves everything as it was.
 */
export async function runGmail(d: GmailDeps): Promise<GmailResult> {
  const ctx = await d.loadContext();
  if (!ctx) return { status: 'no-settings' };
  const query = gmailQuery(ctx.configs, DAYS);
  if (!query) return { status: 'no-sources' };
  const token = await d.token();
  if (!token) return { status: 'not-connected' };

  const seen = new Set(d.readSeen());
  const ids = (await d.list(token, query)).filter((id) => !seen.has(id)).slice(0, MAX_PER_RUN);
  const held = d.readHeld();
  const known = new Set(held.map((h) => h.hash));
  let recent = d.readRecent?.() ?? [];
  const out = { checked: ids.length, found: 0, ignored: 0, skipped: 0 };
  const senders: Record<string, number> = {};

  for (const id of ids) {
    const email = readEmail(await d.get(token, id));
    if (email) {
      const address = (/<([^>]+)>/.exec(email.from)?.[1] ?? email.from).trim().toLowerCase();
      if (address) senders[address] = (senders[address] ?? 0) + 1;
    }
    const source = email ? sourceForEmail(email.from, ctx.configs) : null;
    const cfg = source ? ctx.configs.find((c) => c.source === source) : undefined;
    if (!email || !source || !cfg || !canParseEmail(source)) {
      out.ignored += 1;
      seen.add(id);
      continue;
    }
    const parsed = parseEmail(source, email);
    if (!parsed) {
      out.ignored += 1;
      seen.add(id);
      continue;
    }
    const decision = decide({ source, amount: parsed.amount, direction: parsed.direction, text: `${email.subject} ${email.text}`, channel: 'email', from: (/<([^>]+)>/.exec(email.from)?.[1] ?? email.from).trim() }, cfg, ctx.rules);
    if (!decision.keep) {
      out.skipped += 1;
      seen.add(id);
      continue;
    }
    const hash = await d.hash(dedupeKey(parsed, email.postTime));
    // The phone alert for the same movement already came (placed, held or dropped), so this email adds nothing.
    if (isRepeat(recent, 'import', parsed, email.postTime, ctx.dedupe)) {
      out.skipped += 1;
    } else if (!known.has(hash)) {
      known.add(hash);
      recent = remember(recent, 'import', parsed, email.postTime);
      held.push({ parsed, postTime: email.postTime, decision, hash, origin: 'import' });
      out.found += 1;
    } else {
      out.skipped += 1;
    }
    seen.add(id);
  }

  d.writeRecent?.(recent);
  d.writeHeld(held.slice(-MAX_HELD));
  d.writeSeen([...seen].slice(-MAX_SEEN));
  try {
    if (Object.keys(senders).length > 0) d.noteSenders?.(senders);
  } catch {
    // The sender list is a convenience; it never fails a run.
  }
  return { status: 'ok', ...out };
}
