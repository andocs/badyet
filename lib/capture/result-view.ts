import { madeLegFor } from './claim';
import { pairCheck, simulate, type SampleOutcome, type SampleSetup } from './explain';

/** Step 5 of the Rules editor as lines and entries to draw, so the web and the phone say the same thing. */
export interface ResultLine {
  state: 'ok' | 'bad' | 'off';
  title: string;
  sub?: string;
}
export interface ResultEntry {
  name: string;
  kind: string;
  /** Centavos, negative = money out. */
  amount: number;
}
export interface ResultBox {
  lines: ResultLine[];
  heading?: string;
  entries: ResultEntry[];
  foot?: string;
}

export interface ResultNames {
  /** The label of the source the sample is read as. */
  source: string;
  /** The rule being edited, or null for "Everything else". */
  ruleId: string | null;
  rules: ReadonlyMap<string, string>;
  categories: ReadonlyMap<string, string>;
}

const SKIPPED = { 'source-off': 'This source is switched off.', 'under-minimum': "It is under the source's minimum.", 'ignore-rule': 'An ignore rule matches it.' } as const;

const nameOf = (setup: SampleSetup, id: string | null) => (id ? (setup.accounts.find((a) => a.id === id)?.name ?? 'Account') : "You'll be asked which account");

export function describeSample(sample: string, setup: SampleSetup, names: ResultNames): { box: ResultBox; outcome: SampleOutcome } {
  const outcome = simulate(sample, setup);
  if (outcome.kind === 'unreadable') {
    return { outcome, box: { lines: [{ state: 'bad', title: 'Nothing is saved', sub: `${names.source} can't read the sample, so the rules are not checked. Nothing shows in the Inbox either. Add a pattern in step 2.` }], entries: [] } };
  }
  if (outcome.kind === 'skipped') {
    return { outcome, box: { lines: [{ state: 'ok', title: 'It can be read' }, { state: 'bad', title: 'Nothing is saved', sub: SKIPPED[outcome.reason] }], entries: [] } };
  }
  const lines: ResultLine[] = [{ state: 'ok', title: 'It can be read' }, { state: 'ok', title: `${names.source} is on and it is not under the minimum` }];
  const matched = outcome.decision.ruleId;
  const matchedName = matched ? names.rules.get(matched) : undefined;
  if (names.ruleId) {
    if (matched === names.ruleId) lines.push({ state: 'ok', title: `This rule matches${matchedName ? `: ${matchedName}` : ''}` });
    else lines.push({ state: 'bad', title: 'This rule does not decide this sample', sub: matched ? `"${matchedName ?? 'Another rule'}" matches first.` : 'Its words or places do not match, so "Everything else" applies.' });
  } else lines.push({ state: 'ok', title: matched ? `A rule catches this one first: ${matchedName ?? 'a rule'}` : 'No rule matches, so these settings apply' });

  const { decision, entries } = outcome;
  const kindOf = (kind: (typeof entries)[number]['kind']) => {
    if (kind === 'transfer') return 'Transfer';
    if (decision.move) return 'Payment · choose the other account in the Inbox';
    if (kind === 'income') return 'Income';
    return `Spending · ${decision.categoryId ? (names.categories.get(decision.categoryId) ?? 'category') : 'choose a category'}`;
  };
  const status = decision.status === 'confirmed' && outcome.accountId ? 'confirmed at once' : 'waiting in the Inbox';
  return {
    outcome,
    box: {
      lines,
      heading: `${entries.length === 2 ? 'It saves two linked entries' : 'It saves one entry'}, ${status}`,
      entries: entries.map((e) => ({ name: nameOf(setup, e.accountId), kind: kindOf(e.kind), amount: e.amount })),
      foot: entries.length === 2 ? 'Not counted as spending or income. Confirming one confirms both.' : undefined,
    },
  };
}

/** What the other account's message would mean next to the first one. null = nothing to say yet. */
export function describeOther(first: SampleOutcome, text: string, otherSetup: SampleSetup, otherLabel: string): ResultBox | null {
  if (first.kind !== 'kept' || text.trim() === '') return null;
  const other = simulate(text, otherSetup);
  const madeBoth = first.entries.length === 2;
  if (other.kind !== 'kept') {
    return {
      lines: [{ state: 'bad', title: madeBoth ? 'The second message changes nothing' : 'These would not pair', sub: other.kind === 'unreadable' ? `${otherLabel} can't read it, so the app would ignore it. Is it the right source?` : SKIPPED[other.reason] }],
      entries: [],
    };
  }
  if (madeBoth) {
    const made = first.entries[1]!;
    const again = madeLegFor(
      { accountId: other.accountId ?? '', amount: other.entries[0]!.amount, at: 0, counterparty: other.read.parsed.counterparty },
      [{ id: 'made', accountId: made.accountId ?? '', amount: made.amount, at: 0, peerAccountId: first.accountId ?? '' }],
      otherSetup.accounts,
    );
    return {
      lines: [again ? { state: 'ok', title: 'It would not be added again', sub: 'It is recognised as the entry the rule already made, if it arrives within an hour.' } : { state: 'bad', title: 'It would be added as another entry', sub: 'Its account, amount or the name in it does not match the entry the rule made. Check the amount in both messages.' }],
      entries: [],
    };
  }
  const { pairs, checks } = pairCheck(first, other, otherSetup.accounts);
  return {
    lines: [
      { state: pairs ? 'ok' : 'bad', title: pairs ? 'These two would pair' : 'Both can be read, but they would not pair', sub: pairs ? "They must also arrive within an hour of each other. A sample can't check that." : undefined },
      ...checks.map((c): ResultLine => ({ state: c.ok ? 'ok' : 'bad', title: c.label })),
    ],
    heading: pairs ? 'One linked transfer, waiting in the Inbox' : 'Two separate entries',
    entries: [first, other].map((o) => ({ name: nameOf(otherSetup, o.accountId), kind: pairs ? 'Transfer' : o.entries[0]!.amount < 0 ? 'Spending' : 'Income', amount: o.entries[0]!.amount })),
  };
}
