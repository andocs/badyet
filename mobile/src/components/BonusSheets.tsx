import { SAVINGS_NAME } from '@/lib/bonuses/view';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import type { BonusCard } from '@/lib/bonuses/view';
import type { SplitInput } from '@/lib/bonuses/input';
import { formatPesos, money, parsePesos } from '@/lib/domain/money';
import type { BonusRule } from '@/lib/engine/types';
import { MonthInput } from '~/components/DateInput';
import { Chip } from '~/components/ui';
import { Field, Input, Sheet, SheetActions } from '~/components/Sheet';
import { archiveRule, saveRule } from '~/lib/bonusRules';
import { saveInstance } from '~/lib/bonusesWrite';
import { useHide } from '~/lib/hide';
import { peso } from '~/lib/money';
import { supabase } from '~/lib/supabase';
import { fonts, useTheme } from '~/lib/theme';

type Result = { ok: true } | { error: string };
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

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

interface DestDraft {
  kind: SplitInput['kind'];
  targetId: string | null;
  label: string;
  amount: string;
  done: boolean;
}

/** Where this bonus goes (funds or your own labelled destinations), and the Low/Base/High pick for CIP. */
export function EditBonusSheet({
  card, baseMultiplier, onClose, onSaved,
}: {
  card: BonusCard;
  baseMultiplier: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const c = useTheme();
  const { hide } = useHide();
  const [mult, setMult] = useState<number | null>(card.multiplierNum);
  const [dests, setDests] = useState<DestDraft[]>(
    card.dests.map((d) => ({ kind: d.kind as SplitInput['kind'], targetId: d.targetId, label: d.kind === 'fund' ? '' : (d.label ?? d.name), amount: formatPesos(d.amount, { symbol: false }), done: d.done })),
  );
  const [newLabel, setNewLabel] = useState('');
  const { problem, busy, run } = useRun(onSaved);
  const picks = [['Low', 0.5], ['Base', 1], ['High', 1.5]] as const;
  const effective = mult ?? baseMultiplier;
  const nameOf = (d: DestDraft) => (d.kind === 'fund' ? SAVINGS_NAME : d.label);
  const hasSavings = dests.some((d) => d.kind === 'fund');
  const placed = dests.reduce((t, d) => t + (parsePesos(d.amount.trim()) ?? 0), 0);

  const submit = () =>
    run(() =>
      saveInstance(supabase, {
        ruleId: card.ruleId,
        year: card.year,
        multiplierNum: mult,
        splits: dests.map((d) => ({ kind: d.kind, targetId: d.targetId, label: d.kind === 'fund' ? null : d.label.trim() || null, amount: parsePesos(d.amount.trim()) ?? 0, done: d.done })),
        received: null,
      }),
    );

  return (
    <Sheet title={`Edit ${card.name}`} onClose={onClose}>
      {card.kind === 'cip' ? (
        <Field label="Multiplier">
          <View style={s.chips}>
            {picks.map(([l, f]) => {
              const value = Math.max(1, Math.round(baseMultiplier * f));
              return <Chip key={l} label={l} on={effective === value} onPress={() => setMult(value)} />;
            })}
          </View>
        </Field>
      ) : null}
      <Field label="Where it goes">
        {dests.length === 0 ? <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 14 }}>Nothing placed yet.</Text> : null}
        {dests.map((d, i) => (
          <View key={`${d.kind}-${d.targetId}-${i}`} style={s.line}>
            <View style={s.between}>
              <Text style={{ color: c.ink, fontFamily: fonts.bodyBold, fontSize: 15, flex: 1 }}>{nameOf(d)}</Text>
              <Pressable onPress={() => setDests((x) => x.filter((_, j) => j !== i))} accessibilityRole="button" accessibilityLabel={`Remove ${nameOf(d)}`} hitSlop={8}>
                <Text style={{ color: c.muted, fontSize: 20 }}>×</Text>
              </Pressable>
            </View>
            <Input value={d.amount} onChangeText={(t) => setDests((x) => x.map((r, j) => (j === i ? { ...r, amount: t } : r)))} keyboardType="decimal-pad" placeholder="Amount (₱)" />
          </View>
        ))}
      </Field>
      <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 13 }}>
        Placed {peso(money(placed), hide)} of {peso(card.net, hide)}
      </Text>
      {!hasSavings ? (
        <Field label="Add savings">
          <View style={s.chips}>
            <Chip label={SAVINGS_NAME} on={false} onPress={() => setDests((x) => [...x, { kind: 'fund', targetId: null, label: '', amount: '', done: false }])} />
          </View>
          <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 12 }}>Fills your funds in priority order; each takes up to its cap.</Text>
        </Field>
      ) : null}
      <Field label="Add something else">
        <View style={s.chips}>
          <View style={{ flex: 1, minWidth: 140 }}>
            <Input value={newLabel} onChangeText={setNewLabel} placeholder="Gift, trip, loan…" maxLength={60} />
          </View>
          <Chip
            label="Add"
            on={false}
            onPress={() => {
              if (!newLabel.trim()) return;
              setDests((x) => [...x, { kind: 'purchase', targetId: null, label: newLabel.trim(), amount: '', done: false }]);
              setNewLabel('');
            }}
          />
        </View>
      </Field>
      <SheetActions onClose={onClose} onSave={submit} busy={busy} problem={problem} />
    </Sheet>
  );
}

/** What actually arrived. Marks the bonus received; the plan keeps its history. */
export function ReceivedSheet({ card, onClose, onSaved }: { card: BonusCard; onClose: () => void; onSaved: () => void }) {
  const [gross, setGross] = useState(formatPesos(card.gross, { symbol: false }));
  const [dm, setDm] = useState(formatPesos(card.deMinimis, { symbol: false }));
  const [net, setNet] = useState(formatPesos(card.net, { symbol: false }));
  const { problem, busy, run } = useRun(onSaved);
  const splits = card.dests.map((d) => ({ kind: d.kind, targetId: d.targetId, label: d.kind === 'fund' ? null : (d.label ?? d.name), amount: d.amount, done: d.done }));
  return (
    <Sheet title={`${card.name} received`} onClose={onClose}>
      <Field label="Gross (₱)">
        <Input value={gross} onChangeText={setGross} keyboardType="decimal-pad" />
      </Field>
      <Field label="De minimis (₱)">
        <Input value={dm} onChangeText={setDm} keyboardType="decimal-pad" />
      </Field>
      <Field label="Net you got (₱)">
        <Input value={net} onChangeText={setNet} keyboardType="decimal-pad" />
      </Field>
      <SheetActions
        onClose={onClose}
        onSave={() =>
          run(() =>
            saveInstance(supabase, {
              ruleId: card.ruleId,
              year: card.year,
              multiplierNum: card.multiplierNum,
              splits,
              received: { gross: parsePesos(gross.trim()) ?? -1, deMinimis: parsePesos(dm.trim()) ?? -1, net: parsePesos(net.trim()) ?? -1 },
            }),
          )
        }
        busy={busy}
        saveLabel="Mark received"
        problem={problem}
      />
    </Sheet>
  );
}

/** Add or edit a bonus rule (yearly, or a one-off), and archive it. */
export function RuleSheet({ rule, onClose, onSaved }: { rule: BonusRule | null; onClose: () => void; onSaved: () => void }) {
  const c = useTheme();
  const [name, setName] = useState(rule?.name ?? '');
  const [recurrence, setRecurrence] = useState<'yearly' | 'once'>(rule?.recurrence ?? 'yearly');
  const [kind, setKind] = useState<BonusRule['kind']>(rule?.kind ?? 'custom');
  const [payMonth, setPayMonth] = useState(rule?.payMonth ?? 12);
  const [onceOn, setOnceOn] = useState(rule?.onceOn ?? '');
  const [cutoff, setCutoff] = useState<'first' | 'second'>(rule?.payslipCutoff ?? 'second');
  const [formula, setFormula] = useState<BonusRule['formula']>(rule?.formula ?? 'fixed');
  const [months, setMonths] = useState(rule?.baseMultipleBp ? String(rule.baseMultipleBp / 10_000) : '1');
  const [fixed, setFixed] = useState(rule?.fixedAmount ? formatPesos(rule.fixedAmount, { symbol: false }) : '');
  const [eligible, setEligible] = useState(rule?.eligibleAmount ? formatPesos(rule.eligibleAmount, { symbol: false }) : '');
  const [component, setComponent] = useState(rule?.componentNum ? String(rule.componentNum / 1_000_000) : '');
  const [dm, setDm] = useState(rule?.deMinimis ? formatPesos(rule.deMinimis, { symbol: false }) : '');
  const { problem, busy, run } = useRun(onSaved);

  const payload = () => ({
    id: rule?.id,
    name,
    recurrence,
    kind,
    payMonth,
    onceOn: recurrence === 'once' ? onceOn.trim() : null,
    cutoff,
    formula,
    baseMultipleBp: formula === 'base_multiple' ? Math.round(Number(months) * 10_000) : null,
    eligibleAmount: formula === 'eligible_x_component_x_multiplier' ? (parsePesos(eligible.trim()) ?? null) : null,
    componentNum: formula === 'eligible_x_component_x_multiplier' ? Math.round(Number(component) * 1_000_000) : null,
    fixedAmount: formula === 'fixed' ? (parsePesos(fixed.trim()) ?? null) : null,
    deMinimis: dm.trim() === '' ? 0 : (parsePesos(dm.trim()) ?? -1),
  });

  return (
    <Sheet title={rule ? 'Edit bonus' : 'Add a bonus'} onClose={onClose}>
      <Field label="Name">
        <Input value={name} onChangeText={setName} maxLength={60} placeholder="13th month" />
      </Field>
      <Field label="How often">
        <View style={s.chips}>
          <Chip label="Yearly" on={recurrence === 'yearly'} onPress={() => setRecurrence('yearly')} />
          <Chip label="One-off" on={recurrence === 'once'} onPress={() => { setRecurrence('once'); if (kind === 'thirteenth') setKind('oneoff'); }} />
        </View>
      </Field>
      <Field label="Kind">
        <View style={s.chips}>
          {(['thirteenth', 'cip', 'custom', 'oneoff'] as const).map((k) => (
            <Chip key={k} label={{ thirteenth: '13th month', cip: 'CIP', custom: 'Custom', oneoff: 'One-off' }[k]} on={kind === k} onPress={() => setKind(k)} />
          ))}
        </View>
      </Field>
      {recurrence === 'once' ? (
        <Field label="Month it lands">
          <MonthInput label="Month it lands" value={onceOn} onChange={setOnceOn} />
        </Field>
      ) : (
        <Field label="Month it lands">
          <View style={s.chips}>
            {MON.map((m, i) => (
              <Chip key={m} label={m} on={payMonth === i + 1} onPress={() => setPayMonth(i + 1)} />
            ))}
          </View>
        </Field>
      )}
      <Field label="On the payslip of">
        <View style={s.chips}>
          <Chip label="1st" on={cutoff === 'first'} onPress={() => setCutoff('first')} />
          <Chip label="2nd" on={cutoff === 'second'} onPress={() => setCutoff('second')} />
        </View>
      </Field>
      <Field label="Worked out as">
        <View style={s.chips}>
          <Chip label="Months of base" on={formula === 'base_multiple'} onPress={() => setFormula('base_multiple')} />
          <Chip label="Fixed amount" on={formula === 'fixed'} onPress={() => setFormula('fixed')} />
          <Chip label="Eligible × component" on={formula === 'eligible_x_component_x_multiplier'} onPress={() => setFormula('eligible_x_component_x_multiplier')} />
        </View>
      </Field>
      {formula === 'base_multiple' ? (
        <Field label="Months of base pay">
          <Input value={months} onChangeText={setMonths} keyboardType="decimal-pad" />
        </Field>
      ) : null}
      {formula === 'fixed' ? (
        <Field label="Amount (₱)">
          <Input value={fixed} onChangeText={setFixed} keyboardType="decimal-pad" />
        </Field>
      ) : null}
      {formula === 'eligible_x_component_x_multiplier' ? (
        <>
          <Field label="Eligible earnings (₱)">
            <Input value={eligible} onChangeText={setEligible} keyboardType="decimal-pad" />
          </Field>
          <Field label="Your component (%)">
            <Input value={component} onChangeText={setComponent} keyboardType="decimal-pad" placeholder="13.81505" />
          </Field>
        </>
      ) : null}
      {kind !== 'thirteenth' ? (
        <Field label="De minimis (₱, tax-free part)">
          <Input value={dm} onChangeText={setDm} keyboardType="decimal-pad" placeholder="0" />
        </Field>
      ) : null}
      <SheetActions onClose={onClose} onSave={() => run(() => saveRule(supabase, payload()))} busy={busy} problem={problem} />
      {rule ? (
        <Pressable
          onPress={() => Alert.alert('Remove this bonus?', 'It leaves every future plan. Years already received keep their history.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: () => void run(() => archiveRule(supabase, rule.id)) }])}
          accessibilityRole="button"
          style={[s.btn, { backgroundColor: c.errTint }]}
        >
          <Text style={{ color: c.err, fontFamily: fonts.bodyBold, fontSize: 15 }}>Remove bonus</Text>
        </Pressable>
      ) : null}
    </Sheet>
  );
}

const s = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  line: { gap: 6, marginBottom: 8 },
  btn: { minHeight: 48, borderRadius: 999, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
});
