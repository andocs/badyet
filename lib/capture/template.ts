/**
 * Your own notification patterns. You write the wording the way it appears, with a few placeholders for the parts that change, and the
 * app turns it into a regular expression:
 *
 *   You have received {amount} from {name}
 *   Your account {last4} has been debited {amount}. Ref {ref}
 *
 * {amount} is required. {name} (who it was with), {last4} (the last digits of YOUR account) and {ref} (a reference number) are optional and
 * can each appear once. {any} skips text you do not care about and can appear many times. Everything else must match as written, ignoring
 * capital letters and how many spaces there are.
 */

const CUR = String.raw`(?:PHP|P|₱)?\s?`;
const AMT = String.raw`([\d,]+(?:\.\d{1,2})?)`;

export type Placeholder = 'amount' | 'name' | 'last4' | 'ref' | 'any';
const PLACEHOLDER = /\{(amount|name|last4|ref|any)\}/g;

export interface CompiledTemplate {
  regex: RegExp;
  /** Which capture group holds each placeholder (1-based), for the ones that capture. */
  groups: Partial<Record<'amount' | 'name' | 'last4' | 'ref', number>>;
}

export type Compiled = { ok: true; value: CompiledTemplate } | { ok: false; error: string };

const escapeLiteral = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, (ch) => `\\${ch}`).replace(/\s+/g, String.raw`\s+`);

export const MAX_TEMPLATE = 200;

/** Turns what you typed into a pattern, or says what is wrong in plain words. */
export function compileTemplate(template: string): Compiled {
  const text = template.trim();
  if (text === '') return { ok: false, error: 'Write the wording of the notification.' };
  if (text.length > MAX_TEMPLATE) return { ok: false, error: `Keep the pattern under ${MAX_TEMPLATE} characters.` };
  if (/[{}]/.test(text.replace(PLACEHOLDER, ''))) return { ok: false, error: 'Use only {amount}, {name}, {last4}, {ref} and {any} inside curly brackets.' };

  const found = [...text.matchAll(PLACEHOLDER)].map((m) => m[1] as Placeholder);
  if (found.filter((p) => p === 'amount').length !== 1) return { ok: false, error: 'Put {amount} exactly once, where the amount appears.' };
  for (const p of ['name', 'last4', 'ref'] as const) {
    if (found.filter((x) => x === p).length > 1) return { ok: false, error: `{${p}} can appear only once.` };
  }
  const literal = text.replace(PLACEHOLDER, '').replace(/\s+/g, '');
  if (literal.length < 3) return { ok: false, error: 'Add a few words around the placeholders so it only matches the notifications you mean.' };

  const groups: CompiledTemplate['groups'] = {};
  let n = 0;
  let source = '';
  let last = 0;
  for (const m of text.matchAll(PLACEHOLDER)) {
    source += escapeLiteral(text.slice(last, m.index));
    last = m.index + m[0].length;
    const p = m[1] as Placeholder;
    if (p === 'amount') { groups.amount = ++n; source += `${CUR}${AMT}`; }
    else if (p === 'name') { groups.name = ++n; source += '(.+?)'; }
    else if (p === 'last4') { groups.last4 = ++n; source += String.raw`[Xx*•]*(\d{2,4})`; }
    else if (p === 'ref') { groups.ref = ++n; source += '([A-Za-z0-9]+)'; }
    else source += '.*?';
  }
  source += escapeLiteral(text.slice(last));
  // A lazy ending (a name or "anything" last) would match nothing, so let it run to the end of the message.
  if (/\{(name|any)\}\s*$/.test(text)) source += String.raw`\.?\s*$`;

  try {
    return { ok: true, value: { regex: new RegExp(source, 'is'), groups } };
  } catch {
    return { ok: false, error: 'That pattern could not be used. Check the wording.' };
  }
}
