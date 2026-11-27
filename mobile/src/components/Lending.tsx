import * as Crypto from 'expo-crypto';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { isoDate } from '@/lib/domain/dates';
import { dueBadge, lendEffect, paybackAmount, paybackEffect, paybackInput, pesoText, promptDetail, receivedOptions } from '@/lib/lending/forms';
import type { PaybackChoice } from '@/lib/lending/load';
import { dueChips, outstandingOf, type Loan } from '@/lib/lending/model';
import { NO_SOURCE, type SourceGroup } from '@/lib/lending/sources';
import { postponeLoan, recordPayback, type Env, type Result } from '@/lib/lending/write';
import { todayManila } from '@/lib/plans/validate';
import { DateInput } from '~/components/DateInput';
import { Field, Input } from '~/components/Sheet';
import { Body, Card, Chip } from '~/components/ui';
import { supabase } from '~/lib/supabase';
import { fonts, useTheme } from '~/lib/theme';

export const lendingEnv = (): Env => ({ today: isoDate(todayManila()), newId: () => Crypto.randomUUID() });

export interface LendDraft {
  borrower: string;
  dueOn: string;
  fromKey: string;
}
export interface LendContext {
  sources: SourceGroup[];
  today: ReturnType<typeof isoDate>;
  paydays: { first: number; second: number };
}
export interface PaybackContext {
  choices: PaybackChoice[];
  accounts: { id: string; name: string }[];
  today: ReturnType<typeof isoDate>;
  paydays: { first: number; second: number };
}

export const newDraft = (ctx: LendContext): LendDraft => ({ borrower: '', dueOn: dueChips(ctx.today, ctx.paydays)[0]!.date, fromKey: ctx.sources[0]?.options[0]?.key ?? NO_SOURCE });

/** A labelled wrap of chips, one of which is picked. */
export function Choices({ label, options, value, onPick }: { label: string; options: { key: string; label: string }[]; value: string | null; onPick: (key: string) => void }) {
  return (
    <Field label={label}>
      <View style={s.chips}>
        {options.map((o) => (
          <Chip key={o.key} label={o.label} on={value === o.key} onPress={() => onPick(o.key)} />
        ))}
      </View>
    </Field>
  );
}

export function Muted({ children }: { children: React.ReactNode }) {
  const c = useTheme();
  return <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 12 }}>{children}</Text>;
}

export function Effect({ children }: { children: string }) {
  const c = useTheme();
  return (
    <View style={[s.effect, { backgroundColor: c.soft }]}>
      <Text style={{ color: c.ink, fontFamily: fonts.body, fontSize: 13 }}>{children}</Text>
    </View>
  );
}

export function DateField({ label, value, onChange, ctx, weeks = 2 }: { label: string; value: string; onChange: (v: string) => void; ctx: Pick<LendContext, 'today' | 'paydays'>; weeks?: 1 | 2 }) {
  return (
    <Field label={label}>
      <DateInput label={label} value={value} onChange={onChange} min={ctx.today} />
      <View style={s.chips}>
        {dueChips(ctx.today, ctx.paydays, weeks).map((d) => (
          <Chip key={d.label} label={d.label} on={value === d.date} onPress={() => onChange(d.date)} />
        ))}
      </View>
    </Field>
  );
}

/** "Take it from", grouped like the web's picker. */
export function SourcePicker({ ctx, value, onChange, label = 'Take it from' }: { ctx: LendContext; value: string; onChange: (key: string) => void; label?: string }) {
  const [open, setOpen] = useState(false);
  const picked = ctx.sources.flatMap((g) => g.options).find((o) => o.key === value);
  return (
    <Field label={label}>
      <View style={s.chips}>
        <Chip label={`${picked?.label ?? 'No budget line'}  ${open ? '▴' : '▾'}`} on={false} onPress={() => setOpen((v) => !v)} />
      </View>
      {open
        ? [{ title: '', options: [{ key: NO_SOURCE, label: 'No budget line', name: '' }] }, ...ctx.sources].map((g) => (
            <View key={g.title || 'none'} style={{ gap: 6 }}>
              {g.title ? <Muted>{g.title}</Muted> : null}
              <View style={s.chips}>
                {g.options.map((o) => (
                  <Chip
                    key={o.key}
                    label={o.label}
                    on={value === o.key}
                    onPress={() => {
                      onChange(o.key);
                      setOpen(false);
                    }}
                  />
                ))}
              </View>
            </View>
          ))
        : null}
    </Field>
  );
}

export function LendFields({ ctx, draft, onChange, amount, askWho = true }: { ctx: LendContext; draft: LendDraft; onChange: (d: LendDraft) => void; amount: number | null; askWho?: boolean }) {
  const set = (part: Partial<LendDraft>) => onChange({ ...draft, ...part });
  const name = ctx.sources.flatMap((g) => g.options).find((o) => o.key === draft.fromKey)?.name ?? null;
  return (
    <View style={{ gap: 10 }}>
      {askWho ? (
        <Field label="Who are you lending to?">
          <Input value={draft.borrower} onChangeText={(borrower) => set({ borrower })} maxLength={80} placeholder="Name" accessibilityLabel="Who are you lending to" />
        </Field>
      ) : null}
      <DateField label="Expected back on" value={draft.dueOn} onChange={(dueOn) => set({ dueOn })} ctx={ctx} />
      <SourcePicker ctx={ctx} value={draft.fromKey} onChange={(fromKey) => set({ fromKey })} />
      <Effect>{lendEffect({ kind: draft.fromKey.split(':')[0]!, name }, amount, draft.borrower)}</Effect>
    </View>
  );
}

type Mode = 'ask' | 'full' | 'part' | 'postpone';

/** Paid in full, part of it, or postponed (which needs a new date). */
export function LoanActions({ loan, ctx, onDone }: { loan: Loan; ctx: PaybackContext; onDone: () => void }) {
  const c = useTheme();
  const owed = outstandingOf(loan);
  const next = dueChips(ctx.today, ctx.paydays).find((d) => d.date > ctx.today)!.date;
  const [mode, setMode] = useState<Mode>('ask');
  const [received, setReceived] = useState('');
  const [amount, setAmount] = useState('');
  const [nextDue, setNextDue] = useState<string>(next);
  const [note, setNote] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const options = mode === 'full' || mode === 'part' ? receivedOptions(ctx.choices, ctx.accounts, owed, mode === 'full', ctx.today) : [];
  const key = options.some((o) => o.key === received) ? received : (options[0]?.key ?? 'cash');
  const part = mode === 'part' ? paybackAmount(ctx.choices, key, amount) : null;
  const open = (m: Mode) => {
    setMode(m);
    setReceived('');
    setProblem(null);
  };

  const run = async (go: () => Promise<Result>) => {
    setBusy(true);
    setProblem(null);
    const r = await go();
    setBusy(false);
    if ('error' in r) setProblem(r.error);
    else {
      setMode('ask');
      onDone();
    }
  };
  const save = () =>
    void run(() => recordPayback(supabase, paybackInput(loan.id, key, mode === 'full' ? (owed / 100).toFixed(2) : amount, mode === 'part' && part !== null && part < owed ? nextDue : null), lendingEnv()));

  const actions = (label: string, onSave: () => void) => (
    <View style={s.chips}>
      <Chip label="Cancel" on={false} onPress={() => open('ask')} />
      <Chip label={busy ? 'Saving…' : label} on onPress={() => (busy ? undefined : onSave())} />
    </View>
  );

  return (
    <View style={{ gap: 10 }}>
      {mode === 'ask' ? (
        <View style={s.chips}>
          <Chip label="Paid in full" on onPress={() => open('full')} />
          <Chip label="Part of it" on={false} onPress={() => open('part')} />
          <Chip label="Postponed" on={false} onPress={() => open('postpone')} />
        </View>
      ) : null}
      {mode === 'full' || mode === 'part' ? (
        <>
          <Choices label="Where did the money arrive?" options={options} value={key} onPick={setReceived} />
          <Muted>Picking the Inbox item stops it being counted twice, or as income.</Muted>
        </>
      ) : null}
      {mode === 'full' ? (
        <>
          <Effect>{paybackEffect(loan.from, owed, owed, loan.borrower, null)}</Effect>
          {actions(`Save ${pesoText(owed)} as paid`, save)}
        </>
      ) : null}
      {mode === 'part' ? (
        <>
          {key.startsWith('txn:') ? null : (
            <Field label="Amount received (₱)">
              <Input value={amount} onChangeText={setAmount} keyboardType="decimal-pad" accessibilityLabel="Amount received" />
            </Field>
          )}
          <DateField label={part !== null && part < owed ? `When will the other ${pesoText(owed - part)} come?` : 'When will the rest come?'} value={nextDue} onChange={setNextDue} ctx={ctx} />
          {part !== null && part <= owed ? <Effect>{paybackEffect(loan.from, part, owed, loan.borrower, /^\d{4}-\d{2}-\d{2}$/.test(nextDue) ? nextDue : null)}</Effect> : null}
          {actions('Save', save)}
        </>
      ) : null}
      {mode === 'postpone' ? (
        <>
          <DateField label={`When will ${loan.borrower} pay you now?`} value={nextDue} onChange={setNextDue} ctx={ctx} weeks={1} />
          <Field label="Note (optional)">
            <Input value={note} onChangeText={setNote} maxLength={200} accessibilityLabel="Note" />
          </Field>
          <Muted>A date is required. The card comes back on that day.</Muted>
          {actions('Postpone', () => void run(() => postponeLoan(supabase, { loanId: loan.id, newDue: nextDue, note }, lendingEnv())))}
        </>
      ) : null}
      {problem ? <Text accessibilityRole="alert" style={{ color: c.err, fontFamily: fonts.body, fontSize: 14 }}>{problem}</Text> : null}
    </View>
  );
}

/** "Did Sam pay you back?": on Now from the expected day until you answer. */
export function DueCard({ loan, ctx, onDone }: { loan: Loan; ctx: PaybackContext; onDone: () => void }) {
  const c = useTheme();
  return (
    <Card style={{ borderColor: c.gold }}>
      <Text style={{ color: c.ink, fontFamily: fonts.display, fontSize: 18 }}>Did {loan.borrower} pay you back?</Text>
      <Text style={{ color: c.gold, fontFamily: fonts.bodyBold, fontSize: 12 }}>{dueBadge(loan, ctx.today).text}</Text>
      <Body>{promptDetail(loan)}</Body>
      <LoanActions loan={loan} ctx={ctx} onDone={onDone} />
    </Card>
  );
}

const s = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  effect: { borderRadius: 10, padding: 12 },
});
