import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import type { YearMonth } from '@/lib/domain/dates';
import { formatPesos, money, parsePesos, type Money } from '@/lib/domain/money';
import { monthRange } from '@/lib/engine/months';
import { buildMonthPay, templateFor, type PayslipLineSpec } from '@/lib/engine/payslip';
import type { Allowance, PayCutoff, SalaryEvent } from '@/lib/engine/types';
import { salaryAt, type SalaryInput } from '@/lib/salary/view';
import { Chip } from '~/components/ui';
import { Field, Input, Sheet, SheetActions } from '~/components/Sheet';
import { useHide } from '~/lib/hide';
import { peso } from '~/lib/money';
import { deleteAllowance, deleteEvent, confirmEvent, saveAssumptions, setAllowance } from '~/lib/salaryWrite';
import { resetTemplates, saveTemplates } from '~/lib/salaryEvents';
import { supabase } from '~/lib/supabase';
import { fonts, useTheme } from '~/lib/theme';

type Result = { ok: true } | { error: string };
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const KIND: Record<string, string> = { start: 'Start', merit: 'Merit raise', promotion: 'Promotion', allowance: 'Allowance', adjustment: 'One-off adjustment' };
const label = (m: string) => `${MON[Number(m.slice(5)) - 1]} ${m.slice(0, 4)}`;

function useRun(onSaved: () => void) {
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<Result>) => {
    setBusy(true);
    setProblem(null);
    const r = await fn();
    setBusy(false);
    if ('error' in r) setProblem(r.error);
    else onSaved();
  };
  return { problem, busy, run };
}

const ask = (title: string, message: string, onYes: () => void) =>
  Alert.alert(title, message, [{ text: 'Cancel', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: onYes }]);

function Button({ label: text, onPress, tone = 'soft' }: { label: string; onPress: () => void; tone?: 'soft' | 'accent' | 'danger' }) {
  const c = useTheme();
  const bg = tone === 'accent' ? c.accent : tone === 'danger' ? c.errTint : c.soft;
  const fg = tone === 'accent' ? c.onAccent : tone === 'danger' ? c.err : c.ink;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={[s.btn, { backgroundColor: bg }]}>
      <Text style={{ color: fg, fontFamily: fonts.bodyBold, fontSize: 15 }}>{text}</Text>
    </Pressable>
  );
}

/** One event: what it did, and confirm (when expected) or remove (anything but the start). */
export function EventSheet({ e, delta, onClose, onSaved }: { e: SalaryEvent; delta: number | null; onClose: () => void; onSaved: () => void }) {
  const c = useTheme();
  const { hide } = useHide();
  const { problem, busy, run } = useRun(onSaved);
  const what =
    e.kind === 'merit' && e.pctBp != null
      ? `+${e.pctBp / 100}%${e.newBase != null ? `, base ${peso(e.newBase, hide)}` : ''}`
      : e.newBase != null
        ? `Base ${peso(e.newBase, hide)} a month`
        : e.kind === 'adjustment' && e.oneOffAmount != null
          ? `${peso(e.oneOffAmount, hide)} once${e.oneOffTaxable ? ', taxed' : ''}`
          : '';
  return (
    <Sheet title={`${KIND[e.kind] ?? e.kind} · ${label(e.effectiveMonth)}`} onClose={onClose}>
      {what ? <Text style={{ color: c.ink, fontFamily: fonts.bodyBold, fontSize: 15 }}>{what}</Text> : null}
      {delta !== null ? <Text style={{ color: delta >= 0 ? c.accentText : c.err, fontFamily: fonts.bodyBold, fontSize: 15 }}>{peso(money(delta), hide)} a month</Text> : null}
      {e.status === 'expected' ? <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 13 }}>Expected, not confirmed yet.</Text> : null}
      {problem ? <Text style={{ color: c.err, fontFamily: fonts.body, fontSize: 14 }}>{problem}</Text> : null}
      {e.status === 'expected' ? <Button label={busy ? 'Saving…' : 'Confirm it happened'} tone="accent" onPress={() => run(() => confirmEvent(supabase, e.id))} /> : null}
      {e.kind !== 'start' ? (
        <Button label="Remove event" tone="danger" onPress={() => ask('Remove this event?', 'Its top-ups on the budget go with it.', () => run(() => deleteEvent(supabase, e.id)))} />
      ) : null}
      <Button label="Close" onPress={onClose} />
    </Sheet>
  );
}

/** One allowance: which payslip it lands on, taxed or not, or remove it. */
export function AllowanceSheet({ a, onClose, onSaved }: { a: Allowance; onClose: () => void; onSaved: () => void }) {
  const c = useTheme();
  const { hide } = useHide();
  const [cutoff, setCutoff] = useState<PayCutoff>(a.payslipCutoff);
  const [taxable, setTaxable] = useState(a.taxable);
  const { problem, busy, run } = useRun(onSaved);
  return (
    <Sheet title={a.name} onClose={onClose}>
      <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 13 }}>
        {peso(a.amount, hide)} · {a.frequency === 'monthly' ? 'every month' : `once a year, in ${MON[(a.payMonth ?? 1) - 1]}`} · from {label(a.startsOn)}
        {a.endsOn ? ` to ${label(a.endsOn)}` : ''}
      </Text>
      <Field label="On the payslip of">
        <View style={s.chips}>
          <Chip label="1st" on={cutoff === 'first'} onPress={() => setCutoff('first')} />
          <Chip label="2nd" on={cutoff === 'second'} onPress={() => setCutoff('second')} />
        </View>
      </Field>
      <View style={s.between}>
        <Text style={{ color: c.ink, fontFamily: fonts.bodyBold, fontSize: 15 }}>Payroll taxes it</Text>
        <Switch value={taxable} onValueChange={setTaxable} trackColor={{ true: c.accent, false: c.line }} thumbColor={c.ink} accessibilityLabel="Payroll taxes it" />
      </View>
      <SheetActions onClose={onClose} onSave={() => run(() => setAllowance(supabase, a.id, { cutoff, taxable }))} busy={busy} problem={problem} />
      <Button label="Remove allowance" tone="danger" onPress={() => ask(`Remove ${a.name}?`, 'It stops adding to your pay.', () => run(() => deleteAllowance(supabase, a.id)))} />
    </Sheet>
  );
}

/** "Assume a raise every year": on or off, the percent, and the month it lands. Used only after your last dated event. */
export function ProjectedSheet({ on: onIn, pctBp, month: monthIn, onClose, onSaved }: { on: boolean; pctBp: number; month: number; onClose: () => void; onSaved: () => void }) {
  const c = useTheme();
  const [on, setOn] = useState(onIn);
  const [pct, setPct] = useState(String(pctBp / 100));
  const [month, setMonth] = useState(monthIn);
  const { problem, busy, run } = useRun(onSaved);
  return (
    <Sheet title="Projected raises" onClose={onClose}>
      <View style={s.between}>
        <Text style={{ color: c.ink, fontFamily: fonts.body, fontSize: 15, flex: 1 }}>Assume a raise every year</Text>
        <Switch value={on} onValueChange={setOn} trackColor={{ true: c.accent, false: c.line }} thumbColor={c.ink} accessibilityLabel="Assume a raise every year" />
      </View>
      {on ? (
        <>
          <Field label="Percent">
            <Input value={pct} onChangeText={setPct} keyboardType="decimal-pad" placeholder="5" />
          </Field>
          <Field label="Month it lands">
            <View style={s.chips}>
              {MON.map((m, i) => (
                <Chip key={m} label={m} on={month === i + 1} onPress={() => setMonth(i + 1)} />
              ))}
            </View>
          </Field>
        </>
      ) : null}
      <SheetActions onClose={onClose} onSave={() => run(() => saveAssumptions(supabase, { on, pctBp: Math.round(Number(pct) * 100), month }))} busy={busy} problem={problem} />
    </Sheet>
  );
}

/**
 * An amount box that shows what the line really comes to: your typed amount, else the computed one. Clearing it, or typing the
 * computed amount, goes back to computed so the line keeps following your pay.
 */
/** What a contribution line is worked from, so it reads as based on your salary rather than "default". */
const BASIS: Partial<Record<PayslipLineSpec['source'], string>> = {
  sss: 'SSS table, from your salary',
  pagibig: 'Pag-IBIG: 2% of your salary, up to ₱10,000',
  philhealth: 'PhilHealth: 2.5% of your base pay',
  penboost: 'PenBoost: your usual amount, not from salary',
  income_tax: "Tax on this cutoff's taxable pay",
};

function AmountField({ override, fallback, placeholder, onChange }: { override: Money | null; fallback: Money | null; placeholder: string; onChange: (v: Money | null) => void }) {
  const show = (v: Money | null) => (v == null ? '' : formatPesos(v, { symbol: false }));
  const [text, setText] = useState(show(override ?? fallback));
  return (
    <Input
      value={text}
      onChangeText={(t) => {
        setText(t);
        if (t.trim() === '') return onChange(null);
        const v = parsePesos(t.trim());
        if (v !== undefined) onChange(money(v));
      }}
      onBlur={() => {
        const v = text.trim() === '' ? null : parsePesos(text.trim());
        if (v === null || v === undefined || (fallback !== null && money(v) === fallback)) {
          onChange(null);
          setText(show(fallback));
        }
      }}
      keyboardType="decimal-pad"
      placeholder={placeholder}
    />
  );
}

interface Draft {
  key: string;
  spec: PayslipLineSpec;
}
let counter = 0;
const fresh = (input: SalaryInput, month: YearMonth): Record<PayCutoff, Draft[]> => ({
  first: templateFor(input.templates, 'first', month).lines.map((spec) => ({ key: `d${counter++}`, spec: { ...spec } })),
  second: templateFor(input.templates, 'second', month).lines.map((spec) => ({ key: `d${counter++}`, spec: { ...spec } })),
});

/** The payslip layout from a month on: what each cutoff shows, splits and overrides, plus your own custom lines. */
export function PayslipSheet({ input, thisMonth, onClose, onSaved }: { input: SalaryInput; thisMonth: YearMonth; onClose: () => void; onSaved: () => void }) {
  const c = useTheme();
  const { hide } = useHide();
  const months = useMemo(() => monthRange(thisMonth, 24), [thisMonth]);
  const [month, setMonth] = useState<YearMonth>(thisMonth);
  const [drafts, setDrafts] = useState(() => fresh(input, thisMonth));
  const [newLabel, setNewLabel] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newKind, setNewKind] = useState<'earning' | 'deduction'>('deduction');
  const [newCutoff, setNewCutoff] = useState<PayCutoff>('second');
  const { problem, busy, run } = useRun(onSaved);

  const pick = (m: YearMonth) => {
    setMonth(m);
    setDrafts(fresh(input, m));
  };
  const patch = (cutoff: PayCutoff, key: string, change: Partial<PayslipLineSpec>) =>
    setDrafts((d) => ({ ...d, [cutoff]: d[cutoff].map((x) => (x.key === key ? { ...x, spec: { ...x.spec, ...change } } : x)) }));
  const drop = (cutoff: PayCutoff, key: string) => setDrafts((d) => ({ ...d, [cutoff]: d[cutoff].filter((x) => x.key !== key) }));
  const move = (cutoff: PayCutoff, key: string) =>
    setDrafts((d) => {
      const other: PayCutoff = cutoff === 'first' ? 'second' : 'first';
      const item = d[cutoff].find((x) => x.key === key);
      return item ? ({ ...d, [cutoff]: d[cutoff].filter((x) => x.key !== key), [other]: [...d[other], item] } as typeof d) : d;
    });
  const addCustom = () => {
    const amt = parsePesos(newAmount.trim());
    if (!newLabel.trim() || amt === undefined || amt < 0) return;
    const spec: PayslipLineSpec = { kind: newKind, label: newLabel.trim(), source: 'custom', amountOverride: amt };
    setDrafts((d) => ({ ...d, [newCutoff]: [...d[newCutoff], { key: `d${counter++}`, spec }] }));
    setNewLabel('');
    setNewAmount('');
  };
  // What the contribution lines come to with nothing typed: SSS and Pag-IBIG from the official tables, PhilHealth from the base, PenBoost's usual amount.
  const defaults = useMemo(() => {
    const pay = buildMonthPay(salaryAt(input, month), input.settings, [], []);
    const out: Partial<Record<PayslipLineSpec['source'], Money>> = {};
    for (const l of [...pay.first.lines, ...pay.second.lines]) if (['sss', 'philhealth', 'pagibig', 'penboost'].includes(l.source) && !(l.source in out)) out[l.source as PayslipLineSpec['source']] = l.amount;
    return out;
  }, [input, month]);
  const lines = (cutoff: PayCutoff) => drafts[cutoff].map((d) => ({ kind: d.spec.kind, label: d.spec.label, source: d.spec.source, shareBp: d.spec.shareBp ?? null, amountOverride: d.spec.amountOverride ?? null }));

  return (
    <Sheet title="Payslip layout" onClose={onClose}>
      <Field label="From this month on">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {months.map((m) => (
            <Chip key={m} label={label(m)} on={month === m} onPress={() => pick(m)} />
          ))}
        </ScrollView>
      </Field>

      {(['first', 'second'] as const).map((cutoff) => (
        <View key={cutoff} style={{ gap: 8 }}>
          <Text style={{ color: c.ink, fontFamily: fonts.display, fontSize: 16 }}>{cutoff === 'first' ? '1st cutoff' : '2nd cutoff'}</Text>
          {drafts[cutoff].map((d) => {
            const sp = d.spec;
            const shared = sp.source === 'base_share' || sp.source === 'income_tax';
            return (
              <View key={d.key} style={[s.line, { borderColor: c.line }]}>
                <View style={s.between}>
                  <Text style={{ color: c.ink, fontFamily: fonts.bodyBold, fontSize: 14, flex: 1 }}>{sp.label}</Text>
                  <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 12 }}>{sp.kind === 'earning' ? 'earning' : 'deduction'}</Text>
                </View>
                {shared ? (
                  <Field label="Share of the month (%)">
                    <Input value={String((sp.shareBp ?? 5000) / 100)} onChangeText={(t) => patch(cutoff, d.key, { shareBp: Math.round(Math.min(100, Math.max(0, Number(t) || 0)) * 100) })} keyboardType="decimal-pad" />
                  </Field>
                ) : null}
                <Field label={sp.source === 'custom' ? 'Amount (₱)' : `${BASIS[sp.source] ?? 'Computed'} · type your own to override (₱)`}>
                  <AmountField
                    key={d.key}
                    override={sp.amountOverride ?? null}
                    fallback={defaults[sp.source] ?? null}
                    placeholder={hide ? '' : 'computed'}
                    onChange={(v) => patch(cutoff, d.key, { amountOverride: v })}
                  />
                </Field>
                <View style={s.chips}>
                  <Pressable onPress={() => move(cutoff, d.key)} accessibilityRole="button" style={[s.small, { backgroundColor: c.soft }]}>
                    <Text style={{ color: c.ink, fontFamily: fonts.bodyBold, fontSize: 13 }}>Move to {cutoff === 'first' ? '2nd' : '1st'}</Text>
                  </Pressable>
                  <Pressable onPress={() => drop(cutoff, d.key)} accessibilityRole="button" style={[s.small, { backgroundColor: c.errTint }]}>
                    <Text style={{ color: c.err, fontFamily: fonts.bodyBold, fontSize: 13 }}>Remove</Text>
                  </Pressable>
                </View>
              </View>
            );
          })}
        </View>
      ))}

      <View style={[s.line, { borderColor: c.line }]}>
        <Text style={{ color: c.ink, fontFamily: fonts.bodyBold, fontSize: 14 }}>Add your own line</Text>
        <Input value={newLabel} onChangeText={setNewLabel} placeholder="Name" maxLength={60} />
        <Input value={newAmount} onChangeText={setNewAmount} keyboardType="decimal-pad" placeholder="Amount (₱)" />
        <View style={s.chips}>
          <Chip label="Earning" on={newKind === 'earning'} onPress={() => setNewKind('earning')} />
          <Chip label="Deduction" on={newKind === 'deduction'} onPress={() => setNewKind('deduction')} />
          <Chip label="1st" on={newCutoff === 'first'} onPress={() => setNewCutoff('first')} />
          <Chip label="2nd" on={newCutoff === 'second'} onPress={() => setNewCutoff('second')} />
        </View>
        <Button label="Add line" onPress={addCustom} />
      </View>

      <SheetActions onClose={onClose} onSave={() => run(() => saveTemplates(supabase, { month, first: lines('first'), second: lines('second') }))} busy={busy} saveLabel="Save layout" problem={problem} />
      <Button label="Back to the standard layout" onPress={() => ask('Reset the layout?', `Saved layouts from ${label(month)} on are removed.`, () => run(() => resetTemplates(supabase, month)))} />
    </Sheet>
  );
}


const s = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  btn: { minHeight: 48, borderRadius: 999, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  small: { minHeight: 36, borderRadius: 999, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  line: { borderWidth: 1, borderRadius: 10, padding: 12, gap: 8 },
});
