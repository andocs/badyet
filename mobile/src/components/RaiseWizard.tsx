import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { addMonths, type YearMonth } from '@/lib/domain/dates';
import { money, mulBp, parsePesos, sub } from '@/lib/domain/money';
import { monthRange } from '@/lib/engine/months';
import { buildMonthPay } from '@/lib/engine/payslip';
import type { Allowance, PayCutoff, SalaryEvent } from '@/lib/engine/types';
import type { RaisePayload } from '@/lib/salary/event-input';
import type { PlaceableLine } from '@/lib/salary/load';
import { eventEffect, salaryAt, type SalaryInput } from '@/lib/salary/view';
import { Chip } from '~/components/ui';
import { Field, Input, Sheet } from '~/components/Sheet';
import { useHide } from '~/lib/hide';
import { peso } from '~/lib/money';
import { addSalaryEvent } from '~/lib/salaryEvents';
import { supabase } from '~/lib/supabase';
import { fonts, useTheme } from '~/lib/theme';

export type RaiseKind = 'merit' | 'promotion' | 'allowance' | 'adjustment';
const KINDS: [RaiseKind, string][] = [
  ['merit', 'Merit raise'],
  ['promotion', 'Promotion'],
  ['allowance', 'Allowance'],
  ['adjustment', 'One-off'],
];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const label = (m: YearMonth) => `${MON[Number(m.slice(5)) - 1]} ${m.slice(0, 4)}`;
const STEPS = ['What happened', 'The numbers', 'The extra', 'Check the tax', 'Save'];

interface Alloc {
  lineId: string;
  mode: 'amount' | 'percent';
  value: string;
}

/**
 * Add a raise, promotion, allowance or one-off in five steps, in a sheet. The numbers are worked out here by the same engine the
 * web uses; the shared validator checks them again before anything is saved.
 */
export function RaiseWizard({
  input, thisMonth, placeable, initialKind, onClose, onSaved,
}: {
  input: SalaryInput;
  thisMonth: YearMonth;
  placeable: PlaceableLine[];
  initialKind: RaiseKind | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const c = useTheme();
  const { hide } = useHide();
  const [step, setStep] = useState(0);
  const [kind, setKind] = useState<RaiseKind>(initialKind ?? 'merit');
  const months = useMemo(() => (kind === 'allowance' ? monthRange(addMonths(thisMonth, -36), 97) : monthRange(addMonths(thisMonth, 1), 60)), [thisMonth, kind]);
  const [status, setStatus] = useState<'confirmed' | 'expected'>(initialKind === 'allowance' ? 'confirmed' : 'confirmed');
  const [month, setMonth] = useState<YearMonth>(addMonths(thisMonth, 1));
  const [mode, setMode] = useState<'pct' | 'amt'>('pct');
  const [pct, setPct] = useState('3.5');
  const [newBase, setNewBase] = useState('');
  const [title, setTitle] = useState('');
  const [grade, setGrade] = useState('');
  const [alName, setAlName] = useState('');
  const [alAmount, setAlAmount] = useState('');
  const [alFreq, setAlFreq] = useState<'monthly' | 'yearly'>('monthly');
  const [alMonth, setAlMonth] = useState(6);
  const [alCutoff, setAlCutoff] = useState<PayCutoff>('second');
  const [taxable, setTaxable] = useState(false);
  const [adj, setAdj] = useState('');
  const [allocs, setAllocs] = useState<Alloc[]>([]);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const parsed = useMemo(() => {
    const pctNum = Number(pct);
    const base = parsePesos(newBase);
    const alAmt = parsePesos(alAmount);
    const adjAmt = parsePesos(adj);
    return {
      pctBp: Number.isFinite(pctNum) && pctNum > 0 && pctNum <= 1000 ? Math.round(pctNum * 100) : null,
      base: base !== undefined && base > 0 ? base : null,
      alAmt: alAmt !== undefined && alAmt > 0 ? alAmt : null,
      adjAmt: adjAmt !== undefined && adjAmt !== 0 ? adjAmt : null,
    };
  }, [pct, newBase, alAmount, adj]);

  const numbersOk =
    kind === 'merit' ? (mode === 'pct' ? parsed.pctBp !== null : parsed.base !== null) : kind === 'promotion' ? parsed.base !== null : kind === 'allowance' ? parsed.alAmt !== null && alName.trim() !== '' : parsed.adjAmt !== null;

  const after = useMemo<SalaryInput | null>(() => {
    if (!numbersOk) return null;
    const base = { id: 'new', effectiveMonth: month, status } as const;
    let event: SalaryEvent;
    let allowances: Allowance[] = [...input.allowances];
    if (kind === 'merit') event = { ...base, kind: 'merit', pctBp: mode === 'pct' ? parsed.pctBp : null, newBase: mode === 'amt' ? parsed.base : null };
    else if (kind === 'promotion') event = { ...base, kind: 'promotion', newBase: parsed.base };
    else if (kind === 'allowance') {
      allowances = [...allowances, { id: 'new-al', payslipCutoff: alCutoff, name: alName.trim(), amount: parsed.alAmt!, frequency: alFreq, payMonth: alFreq === 'yearly' ? alMonth : null, taxable, startsOn: month, endsOn: null }];
      event = { ...base, kind: 'allowance', allowanceId: 'new-al' };
    } else event = { ...base, kind: 'adjustment', oneOffAmount: parsed.adjAmt, oneOffTaxable: taxable };
    return { ...input, events: [...input.events, event], allowances };
  }, [numbersOk, input, month, status, kind, mode, parsed, alCutoff, alName, alFreq, alMonth, taxable]);

  const view = useMemo(() => {
    if (!after) return null;
    const pay = (i: SalaryInput) => buildMonthPay(salaryAt(i, month), i.settings, [], i.templates);
    return { b: pay(input), a: pay(after), effect: eventEffect(input, after, month) };
  }, [after, input, month]);

  const monthly = kind !== 'adjustment' && !(kind === 'allowance' && alFreq === 'yearly');
  const extra = view && monthly ? money(Math.max(0, view.effect.perMonth)) : money(0);
  const canPlace = monthly && month > thisMonth;
  const lineOf = (id: string) => placeable.find((l) => l.id === id);
  const placed = allocs.reduce((t, a) => {
    const v = Number(a.value);
    if (!Number.isFinite(v) || v < 0) return t;
    return t + (a.mode === 'percent' ? mulBp(extra, Math.round(v * 100)) : Math.round(v * 100));
  }, 0);
  const left = sub(extra, money(placed));
  const overPlaced = left < -50;
  const available = placeable.filter((l) => !allocs.some((a) => a.lineId === l.id));

  function payload(): RaisePayload {
    return {
      kind,
      status,
      month,
      pctBp: kind === 'merit' && mode === 'pct' ? (parsed.pctBp ?? undefined) : undefined,
      newBase: (kind === 'merit' && mode === 'amt') || kind === 'promotion' ? (parsed.base ?? undefined) : undefined,
      title: kind === 'promotion' ? title : undefined,
      grade: kind === 'promotion' ? grade : undefined,
      allowance: kind === 'allowance' ? { name: alName.trim(), amount: parsed.alAmt ?? 0, frequency: alFreq, payMonth: alFreq === 'yearly' ? alMonth : undefined, cutoff: alCutoff, taxable } : undefined,
      adjustment: kind === 'adjustment' ? { amount: parsed.adjAmt ?? 0, taxable } : undefined,
      allocations: canPlace
        ? allocs.flatMap((a): RaisePayload['allocations'] => {
            const v = Number(a.value);
            const line = lineOf(a.lineId);
            if (!line || !Number.isFinite(v) || v <= 0) return [];
            return a.mode === 'percent' ? [{ lineId: a.lineId, mode: 'percent' as const, pctBp: Math.round(v * 100) }] : [{ lineId: a.lineId, mode: 'amount' as const, amount: Math.round((v * 100) / line.cutoffs) }];
          })
        : [],
    };
  }

  async function save() {
    setBusy(true);
    setProblem(null);
    const r = await addSalaryEvent(supabase, payload());
    setBusy(false);
    if ('error' in r) setProblem(r.error);
    else onSaved();
  }

  const muted = { color: c.muted, fontFamily: fonts.body, fontSize: 13 } as const;
  const bold = { color: c.ink, fontFamily: fonts.bodyBold, fontSize: 15 } as const;
  const canNext = step === 1 ? numbersOk : true;

  return (
    <Sheet title="Raise or promotion" onClose={onClose}>
      <View style={s.steps}>
        {STEPS.map((x, i) => (
          <View key={x} style={[s.stepBar, { backgroundColor: i <= step ? c.accent : c.line }]} />
        ))}
      </View>
      <Text style={muted}>
        Step {step + 1} of {STEPS.length}: {STEPS[step]}
      </Text>

      {step === 0 ? (
        <>
          <Field label="What changed at work?">
            <View style={s.chips}>
              {KINDS.map(([v, l]) => (
                <Chip key={v} label={l} on={kind === v} onPress={() => { setKind(v); if (v !== 'allowance' && month <= thisMonth) setMonth(addMonths(thisMonth, 1)); }} />
              ))}
            </View>
          </Field>
          <Field label="How sure is it?">
            <View style={s.chips}>
              <Chip label="It has happened" on={status === 'confirmed'} onPress={() => setStatus('confirmed')} />
              <Chip label="I am expecting it" on={status === 'expected'} onPress={() => setStatus('expected')} />
            </View>
          </Field>
        </>
      ) : null}

      {step === 1 ? (
        <>
          {kind === 'merit' ? (
            <View style={s.chips}>
              <Chip label="A percent" on={mode === 'pct'} onPress={() => setMode('pct')} />
              <Chip label="A new base" on={mode === 'amt'} onPress={() => setMode('amt')} />
            </View>
          ) : null}
          {kind === 'merit' && mode === 'pct' ? (
            <Field label="Raise %">
              <Input value={pct} onChangeText={setPct} keyboardType="decimal-pad" />
            </Field>
          ) : null}
          {(kind === 'merit' && mode === 'amt') || kind === 'promotion' ? (
            <Field label="New base per month (₱)">
              <Input value={newBase} onChangeText={setNewBase} keyboardType="decimal-pad" placeholder="80,000" />
            </Field>
          ) : null}
          {kind === 'promotion' ? (
            <>
              <Field label="New title">
                <Input value={title} onChangeText={setTitle} maxLength={60} />
              </Field>
              <Field label="Grade">
                <Input value={grade} onChangeText={setGrade} maxLength={30} />
              </Field>
            </>
          ) : null}
          {kind === 'allowance' ? (
            <>
              <Field label="Name">
                <Input value={alName} onChangeText={setAlName} maxLength={60} placeholder="Transport allowance" />
              </Field>
              <Field label="Amount (₱)">
                <Input value={alAmount} onChangeText={setAlAmount} keyboardType="decimal-pad" />
              </Field>
              <Field label="How often">
                <View style={s.chips}>
                  <Chip label="Every month" on={alFreq === 'monthly'} onPress={() => setAlFreq('monthly')} />
                  <Chip label="Once a year" on={alFreq === 'yearly'} onPress={() => setAlFreq('yearly')} />
                </View>
              </Field>
              {alFreq === 'yearly' ? (
                <Field label="Month it lands">
                  <View style={s.chips}>
                    {MON.map((m, i) => (
                      <Chip key={m} label={m} on={alMonth === i + 1} onPress={() => setAlMonth(i + 1)} />
                    ))}
                  </View>
                </Field>
              ) : null}
              <Field label="Lands in the">
                <View style={s.chips}>
                  <Chip label="1st cutoff" on={alCutoff === 'first'} onPress={() => setAlCutoff('first')} />
                  <Chip label="2nd cutoff" on={alCutoff === 'second'} onPress={() => setAlCutoff('second')} />
                </View>
              </Field>
            </>
          ) : null}
          {kind === 'adjustment' ? (
            <Field label="Amount (₱, negative for a deduction)">
              <Input value={adj} onChangeText={setAdj} keyboardType="numbers-and-punctuation" placeholder="5,000" />
            </Field>
          ) : null}
          <Field label={kind === 'allowance' ? 'Started or starts in' : 'Effective month'}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {months.map((m) => (
                <Chip key={m} label={label(m)} on={month === m} onPress={() => setMonth(m)} />
              ))}
            </ScrollView>
          </Field>
          {kind === 'allowance' || kind === 'adjustment' ? (
            <View style={s.between}>
              <Text style={bold}>Payroll taxes it</Text>
              <Switch value={taxable} onValueChange={setTaxable} trackColor={{ true: c.accent, false: c.line }} thumbColor={c.ink} accessibilityLabel="Payroll taxes it" />
            </View>
          ) : null}
        </>
      ) : null}

      {step === 2 ? (
        !view || !canPlace || extra <= 0 ? (
          <Text style={muted}>{monthly && month <= thisMonth ? 'Already started, so it is part of your take-home.' : 'Nothing monthly to place.'}</Text>
        ) : (
          <>
            <View style={s.between}>
              <Text style={muted}>New take-home each month</Text>
              <Text style={{ color: c.ink, fontFamily: fonts.display, fontSize: 20 }}>{peso(extra, hide)}</Text>
            </View>
            {allocs.map((a, i) => {
              const line = lineOf(a.lineId)!;
              const v = Number(a.value);
              return (
                <View key={a.lineId} style={{ gap: 6 }}>
                  <View style={s.between}>
                    <Text style={bold}>{line.name}</Text>
                    <Pressable onPress={() => setAllocs((x) => x.filter((_, j) => j !== i))} accessibilityRole="button" accessibilityLabel={`Remove ${line.name}`} hitSlop={8}>
                      <Text style={{ color: c.muted, fontSize: 20 }}>×</Text>
                    </Pressable>
                  </View>
                  <View style={s.chips}>
                    <Chip label="₱" on={a.mode === 'amount'} onPress={() => setAllocs((x) => x.map((r, j) => (j === i ? { ...r, mode: 'amount' } : r)))} />
                    <Chip label="%" on={a.mode === 'percent'} onPress={() => setAllocs((x) => x.map((r, j) => (j === i ? { ...r, mode: 'percent' } : r)))} />
                    <View style={{ flex: 1, minWidth: 100 }}>
                      <Input value={a.value} onChangeText={(t) => setAllocs((x) => x.map((r, j) => (j === i ? { ...r, value: t } : r)))} keyboardType="decimal-pad" />
                    </View>
                  </View>
                  {a.mode === 'percent' && Number.isFinite(v) ? <Text style={muted}>{peso(mulBp(extra, Math.round(v * 100)), hide)} a month</Text> : null}
                </View>
              );
            })}
            <View style={s.between}>
              <Text style={{ color: overPlaced ? c.err : c.ink, fontFamily: fonts.bodyBold, fontSize: 14 }}>{overPlaced ? 'Over by' : 'Left to Whatever is left'}</Text>
              <Text style={{ color: overPlaced ? c.err : c.accentText, fontFamily: fonts.bodyBold, fontSize: 14 }}>{peso(money(Math.abs(left)), hide)}</Text>
            </View>
            {available.length > 0 ? (
              <Field label="Add a budget line">
                <View style={s.chips}>
                  {available.map((l) => (
                    <Chip key={l.id} label={l.name} on={false} onPress={() => setAllocs((x) => [...x, { lineId: l.id, mode: 'amount', value: String(Math.max(0, Math.round(left / 100))) }])} />
                  ))}
                </View>
              </Field>
            ) : null}
          </>
        )
      ) : null}

      {step === 3 ? (
        view ? (
          <View style={{ gap: 8 }}>
            {kind === 'adjustment' ? (
              <Text style={muted}>A one-off is taxed on top of your regular year{taxable ? '' : ' (you marked it as not taxed)'}. Your payroll may withhold differently.</Text>
            ) : (
              <Text style={bold}>
                Income tax {view.a.tax >= view.b.tax ? 'up' : 'down'} {peso(money(Math.abs(view.a.tax - view.b.tax)), hide)} a month, to {peso(view.a.tax, hide)}.
              </Text>
            )}
            <Text style={muted}>
              SSS {peso(view.a.sss, hide)} · PhilHealth {peso(view.a.philhealth, hide)} · Pag-IBIG {peso(view.a.pagibig, hide)} a month.
            </Text>
          </View>
        ) : (
          <Text style={muted}>Fill in the details first.</Text>
        )
      ) : null}

      {step === 4 ? (
        <View style={{ gap: 8 }}>
          <View style={s.between}>
            <Text style={bold}>
              {KINDS.find((k) => k[0] === kind)![1]}
              {status === 'expected' ? ' (expected)' : ''}
            </Text>
            <Text style={{ color: c.accentText, fontFamily: fonts.bodyBold, fontSize: 14 }}>{label(month)}</Text>
          </View>
          {view && monthly ? (
            <Text style={muted}>
              {peso(view.effect.perMonth, hide)} a month. 5-year total {peso(view.effect.total, hide)}.
            </Text>
          ) : null}
          {overPlaced ? <Text style={{ color: c.err, fontFamily: fonts.body, fontSize: 14 }}>The budget top-ups are more than the extra take-home. Go back and lower them.</Text> : null}
        </View>
      ) : null}

      {problem ? <Text style={{ color: c.err, fontFamily: fonts.body, fontSize: 14 }}>{problem}</Text> : null}
      <View style={s.two}>
        <Pressable onPress={step === 0 ? onClose : () => setStep(step - 1)} accessibilityRole="button" style={[s.btn, { flex: 1, backgroundColor: c.soft }]}>
          <Text style={{ color: c.ink, fontFamily: fonts.bodyBold, fontSize: 15 }}>{step === 0 ? 'Cancel' : 'Back'}</Text>
        </Pressable>
        {step === 2 ? (
          <Pressable onPress={() => { setAllocs([]); setStep(3); }} accessibilityRole="button" style={[s.btn, { backgroundColor: c.soft }]}>
            <Text style={{ color: c.ink, fontFamily: fonts.bodyBold, fontSize: 15 }}>Skip</Text>
          </Pressable>
        ) : null}
        {step < 4 ? (
          <Pressable onPress={() => setStep(step + 1)} disabled={!canNext} accessibilityRole="button" style={[s.btn, { flex: 1, backgroundColor: c.accent, opacity: canNext ? 1 : 0.5 }]}>
            <Text style={{ color: c.onAccent, fontFamily: fonts.bodyBold, fontSize: 15 }}>Next</Text>
          </Pressable>
        ) : (
          <Pressable onPress={save} disabled={busy || !numbersOk || overPlaced} accessibilityRole="button" style={[s.btn, { flex: 1, backgroundColor: c.accent, opacity: busy || !numbersOk || overPlaced ? 0.5 : 1 }]}>
            <Text style={{ color: c.onAccent, fontFamily: fonts.bodyBold, fontSize: 15 }}>{busy ? 'Saving…' : 'Save event'}</Text>
          </Pressable>
        )}
      </View>
    </Sheet>
  );
}

const s = StyleSheet.create({
  steps: { flexDirection: 'row', gap: 6 },
  stepBar: { flex: 1, height: 4, borderRadius: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  two: { flexDirection: 'row', gap: 10 },
  btn: { minHeight: 48, borderRadius: 999, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
});
