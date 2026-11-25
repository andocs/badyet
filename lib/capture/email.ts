import { centavos, parseWithPatterns, type Parsed } from './parsers';
import type { CapturePattern } from './patterns';
import { ruleSource, SOURCE_INFO, SOURCES, type CaptureRule, type SourceConfig, type SourceKey } from './sources';

// ---- Reading a Gmail API message -------------------------------------------------------------------------------

export interface GmailPart {
  mimeType?: string;
  headers?: { name: string; value: string }[];
  body?: { data?: string };
  parts?: GmailPart[];
}
export interface GmailMessage {
  id: string;
  /** Milliseconds since 1970, as a string. */
  internalDate?: string;
  payload?: GmailPart;
}

/** What the rest of the code needs from an email. `text` is only read, never stored. */
export interface Email {
  id: string;
  from: string;
  subject: string;
  postTime: number;
  text: string;
}

/** Gmail sends bodies as base64url of UTF-8. */
export function decodeBase64Url(data: string): string {
  const b64 = data.replace(/-/g, '+').replace(/_/g, '/');
  const bin = b64.replace(/=+$/, '');
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const ch of bin) {
    const v = alphabet.indexOf(ch);
    if (v < 0) continue;
    buffer = (buffer << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }
  let out = '';
  for (let i = 0; i < bytes.length; ) {
    const b = bytes[i]!;
    let cp: number;
    let n: number;
    if (b < 0x80) { cp = b; n = 1; }
    else if (b >= 0xf0) { cp = ((b & 0x07) << 18) | ((bytes[i + 1]! & 0x3f) << 12) | ((bytes[i + 2]! & 0x3f) << 6) | (bytes[i + 3]! & 0x3f); n = 4; }
    else if (b >= 0xe0) { cp = ((b & 0x0f) << 12) | ((bytes[i + 1]! & 0x3f) << 6) | (bytes[i + 2]! & 0x3f); n = 3; }
    else { cp = ((b & 0x1f) << 6) | (bytes[i + 1]! & 0x3f); n = 2; }
    out += String.fromCodePoint(cp);
    i += n;
  }
  return out;
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', peso: '₱' };

/**
 * HTML to plain lines. A table row becomes one line with its cells separated by a tab, so "Label<TAB>Value" is easy to read back.
 */
export function htmlToLines(html: string): string {
  return html
    .replace(/<(style|script)[\s\S]*?<\/\1>/gi, '')
    .replace(/<\/t[dh]>/gi, '\t')
    .replace(/<(br\s*\/?|\/tr|\/p|\/div|\/li|\/h\d|\/table)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
      if (e[0] === '#') return String.fromCodePoint(e[1]!.toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
      return ENTITIES[e.toLowerCase()] ?? m;
    })
    .split('\n')
    .map((l) => l.replace(/[  ]+/g, ' ').replace(/ ?\t ?/g, '\t').replace(/\t+/g, '\t').replace(/^\t|\t$/g, '').trim())
    .filter(Boolean)
    .join('\n');
}

const header = (p: GmailPart | undefined, name: string): string => p?.headers?.find((h) => h.name.toLowerCase() === name)?.value ?? '';

function findBody(p: GmailPart | undefined, mime: string): string | null {
  if (!p) return null;
  if (p.mimeType === mime && p.body?.data) return decodeBase64Url(p.body.data);
  for (const child of p.parts ?? []) {
    const hit = findBody(child, mime);
    if (hit) return hit;
  }
  return null;
}

/** Subject, sender, time and body text. Prefers the HTML body, because the tables carry the details. */
export function readEmail(m: GmailMessage): Email | null {
  if (!m.payload) return null;
  const html = findBody(m.payload, 'text/html');
  const plain = findBody(m.payload, 'text/plain');
  const text = html ? htmlToLines(html) : plain ? plain.replace(/\r/g, '').split('\n').map((l) => l.trim()).filter(Boolean).join('\n') : '';
  if (!text) return null;
  return { id: m.id, from: header(m.payload, 'from'), subject: header(m.payload, 'subject'), postTime: Number(m.internalDate) || 0, text };
}

// ---- Which source sent it --------------------------------------------------------------------------------------

const address = (from: string): string => (/<([^>]+)>/.exec(from)?.[1] ?? from).trim().toLowerCase();

/** A sender entry matches an exact address, or a whole domain when written "@bank.com". */
const sends = (entry: string, addr: string): boolean => {
  const e = entry.trim().toLowerCase();
  return e.startsWith('@') ? addr.endsWith(e) || addr.endsWith('.' + e.slice(1)) : e === addr;
};

/** Which source reads an email: an enabled source by sender or its bank's domain, else a rule that names the sender. */
export function sourceForEmail(from: string, configs: readonly SourceConfig[], rules: readonly CaptureRule[] = []): SourceKey | null {
  const addr = address(from);
  const enabled = configs.filter((c) => c.enabled);
  const exact = enabled.find((c) => c.senders.some((s) => sends(s, addr)));
  if (exact) return exact.source;
  const byDomain = enabled.find((c) => SOURCE_INFO[c.source].domains.some((d) => addr.endsWith('@' + d) || addr.endsWith('.' + d)));
  if (byDomain) return byDomain.source;
  const rule = rules.find((r) => r.enabled && (r.senders ?? []).some((s) => sends(s, addr)));
  return rule ? ruleSource(rule) : null;
}

/** The Gmail search that finds mail from your enabled sources, or null when none can send email. */
export function gmailQuery(configs: readonly SourceConfig[], days: number, rules: readonly CaptureRule[] = []): string | null {
  const terms = new Set<string>();
  const add = (s: string) => {
    const t = s.trim().toLowerCase().replace(/^@/, '');
    if (t) terms.add(t);
  };
  for (const c of configs.filter((x) => x.enabled)) {
    for (const s of c.senders) add(s);
    for (const d of SOURCE_INFO[c.source].domains) add(d);
  }
  for (const r of rules.filter((x) => x.enabled)) for (const s of (r.senders ?? [])) add(s);
  return terms.size === 0 ? null : `from:(${[...terms].join(' OR ')}) newer_than:${days}d`;
}

// ---- Parsing ---------------------------------------------------------------------------------------------------

/** Reads "Label<TAB>Value" or "Label: Value" from the lines. */
function field(text: string, label: string): string | null {
  const esc = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^${esc}\\s*[:\\t]\\s*(.+)$`, 'im').exec(text)?.[1]?.trim() ?? null;
}

const digitsAtEnd = (t: string | null): string | null => (t ? (/(\d{2,4})\s*(?:\(|$)/.exec(t.replace(/\s*\([^)]*\)\s*$/, ''))?.[1] ?? null) : null);
const nickname = (t: string | null): string | null => (t ? (/\(([^)]+)\)\s*$/.exec(t)?.[1]?.trim() ?? null) : null);
const make = (p: Pick<Parsed, 'source' | 'direction' | 'amount'> & Partial<Parsed>): Parsed => ({ counterparty: null, counterpartyLast4: null, accountHint: null, ref: null, accountName: null, ...p });
const trim80 = (t: string | null) => (t ? t.replace(/\s+/g, ' ').trim().slice(0, 80) || null : null);

/**
 * BPI online banking. Outgoing: "Interbank Funds Transfer Confirmation" (Confirmation Number, Transfer From "XXXX-XXXX-167 (nickname)", Bank Name, Total Amount).
 * Incoming: "Incoming Interbank Funds Transfer Confirmation" (Reference Number, Transfer To "XXXXXXXXXX8167", Bank Name, Transfer Amount).
 */
function bpi(subject: string, text: string): Parsed | null {
  const incoming = /incoming/i.test(subject) || /incoming interbank/i.test(text);
  const amount = centavos(/(?:PHP|₱)\s?([\d,]+(?:\.\d{1,2})?)/i.exec((incoming ? field(text, 'Transfer Amount') : (field(text, 'Total Amount') ?? field(text, 'Transfer Amount'))) ?? '')?.[1]);
  if (amount === null) return null;
  if (incoming) {
    return make({
      source: 'bpi', direction: 'in', amount, counterparty: trim80(field(text, 'Bank Name')),
      counterpartyLast4: digitsAtEnd(field(text, 'Transfer From')), accountHint: digitsAtEnd(field(text, 'Transfer To')),
      ref: field(text, 'Reference Number'),
    });
  }
  const from = field(text, 'Transfer From');
  return make({
    source: 'bpi', direction: 'out', amount, counterparty: trim80(field(text, 'Bank Name')),
    counterpartyLast4: digitsAtEnd(field(text, 'Transfer To')), accountHint: digitsAtEnd(from), accountName: nickname(from),
    ref: field(text, 'Confirmation Number') ?? field(text, 'Transaction Ref No.'),
  });
}

const PESO = String.raw`₱\s?([\d,]+(?:\.\d{1,2})?)`;

/** Grab receipt: TOTAL, "Payment Method  Visa 1506" (the card digits pick the account), pick-up location (the restaurant) and booking code. Cash rides are not yours to count. */
function grab(_subject: string, text: string): Parsed | null {
  const total = new RegExp(String.raw`TOTAL\s*\(INCL\.?\s*TAX\)\s*[:\t ]*\s*${PESO}`, 'i').exec(text) ?? new RegExp(String.raw`\bTOTAL\b[:\t \n]*${PESO}`, 'i').exec(text);
  const amount = centavos(total?.[1]);
  const booking = field(text, 'Booking code');
  if (amount === null || !booking) return null;
  const method = field(text, 'Payment Method') ?? '';
  if (/\bcash\b/i.test(method)) return null;
  const merchant = field(text, 'Pick up location') ?? field(text, 'Pick-up location');
  return make({
    source: 'grab', direction: 'out', amount, counterparty: trim80(merchant) ?? 'Grab',
    accountHint: /(\d{4})\s*$/.exec(method)?.[1] ?? null, ref: booking,
  });
}

/** foodpanda order email: Order Total, Store, Order number. The email does not say how it was paid, so the source's usual account is used. */
function foodpanda(_subject: string, text: string): Parsed | null {
  const amount = centavos(new RegExp(PESO, 'i').exec(field(text, 'Order Total') ?? '')?.[1]);
  const order = field(text, 'Order number');
  if (amount === null || !order) return null;
  return make({ source: 'foodpanda', direction: 'out', amount, counterparty: trim80(field(text, 'Store')), ref: order });
}

const PARSERS: Partial<Record<SourceKey, (subject: string, text: string) => Parsed | null>> = { bpi, grab, foodpanda };

/** True when an email from this source can be read: a built-in email reader, or your own patterns for the source. */
export const canParseEmail = (source: SourceKey, patterns: readonly CapturePattern[] = []): boolean => source in PARSERS || patterns.some((p) => p.source === source);

/**
 * Reads one email. Your patterns for the source come first (on the subject and text, so a pattern can match either), then the
 * built-in reader. Anything that is not a money movement (statements, promos) returns null.
 */
export function parseEmail(source: SourceKey, e: Pick<Email, 'subject' | 'text'>, patterns: readonly CapturePattern[] = []): Parsed | null {
  const mine = parseWithPatterns(patterns, source, [e.subject, e.text].join(String.fromCharCode(10)));
  if (mine) return mine;
  return PARSERS[source]?.(e.subject, e.text) ?? null;
}

export const EMAIL_SOURCES: readonly SourceKey[] = SOURCES.filter((s) => canParseEmail(s));
