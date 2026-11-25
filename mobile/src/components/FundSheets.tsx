import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { formatPesos, money, parsePesos } from '@/lib/domain/money';
import type { Fund } from '@/lib/engine/types';
import type { ForecastRow } from '@/lib/funds/forecast';
import { Chip } from '~/components/ui';
import { Field, Input, Sheet, SheetActions } from '~/components/Sheet';
import { archiveFund, bulkOverride, resetMonths, saveFund, saveOverride } from '~/lib/fundsWrite';
import { useHide } from '~/lib/hide';
import { peso } from '~/lib/money';
import { supabase } from '~/lib/supabase';
import { fonts, useTheme } from '~/lib/theme';

type Result = { ok: true } | { error: string };
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const COLORS = ['#34D399', '#7FA8FF', '#F6C453', '#C4A0FF', '#5CD0E6', '#F28BC8', '#FF8A8A', '#93A5BD'];
const RULES: [Fund['rule'], string][] = [['steps', 'Steps'], ['cap', 'Fill to a target'], ['reset', 'Yearly reset'], ['fixed', 'Fixed a month']];

const pesos = (m: number | null | undefined) => (m == null ? '' : formatPesos(money(m), { symbol: false }));
const parse = (t: string): number | null => (t.trim() === '' ? null : (parsePesos(t.trim()) ?? -1));

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

/** Create or edit a fund, and archive it. */
export function FundSheet({ fund, color, accounts, planFund, onClose, onSaved }: { fund: Fund | null; color: string | null; accounts: { id: string; name: string }[]; /** The fund the payroll savings plan feeds now, if any. */ planFund: { id: string; name: string } | null; onClose: () => void; onSaved: () => void }) {
  const c = useTheme();
  const [name, setName] = useState(fund?.name ?? '');
  const [col, setCol] = useState<string | null>(color);
  const [rule, setRule] = useState<Fund['rule']>(fund?.rule ?? 'cap');
  const [target, setTarget] = useState(pesos(fund?.target));
  const [tranches, setTranches] = useState((fund?.tranches ?? []).map((t) => formatPesos(t, { symbol: false })).join(', '));
  const [maxPer, setMaxPer] = useState(pesos(fund?.maxPerMonth));
  const [fixed, setFixed] = useState(pesos(fund?.fixedAmount));
  const [resetMonth, setResetMonth] = useState(fund?.resetMonth ?? 1);
  const [linked, setLinked] = useState<string | null>(fund?.linkedAccountId ?? null);
  const [share, setShare] = useState(fund?.shareBp ? String(fund.shareBp / 100) : '');
  const [start, setStart] = useState(pesos(fund?.startBalance));
  // "The payroll savings plan goes into this fund": only one fund can have it.
  const [linkPlan, setLinkPlan] = useState(!!fund && planFund?.id === fund.id);
  const { problem, busy, run } = useRun(onSaved);

  const payload = () => ({
    id: fund?.id,
    name,
    color: col,
    rule,
    target: parse(target),
    tranches: rule === 'steps' ? tranches.split(',').map((t) => parsePesos(t.trim()) ?? -1) : null,
    maxPerMonth: parse(maxPer),
    fixedAmount: rule === 'fixed' ? parse(fixed) : null,
    resetMonth: rule === 'reset' ? resetMonth : null,
    linkedAccountId: linked,
    shareBp: share.trim() === '' ? null : Math.round(Number(share) * 100),
    startBalance: linked ? null : parse(start),
    linkPlan,
  });

  return (
    <Sheet title={fund ? `Edit ${fund.name}` : 'New fund'} onClose={onClose}>
      <Field label="Name">
        <Input value={name} onChangeText={setName} maxLength={40} />
      </Field>
      <Field label="Colour">
        <View style={s.chips}>
          {COLORS.map((x) => (
            <Pressable key={x} onPress={() => setCol(x)} accessibilityRole="button" accessibilityLabel={`Colour ${x}`} style={[s.swatch, { backgroundColor: x, borderColor: col === x ? c.ink : 'transparent' }]} />
          ))}
        </View>
      </Field>
      <Field label="How it fills">
        <View style={s.chips}>
          {RULES.map(([k, l]) => (
            <Chip key={k} label={l} on={rule === k} onPress={() => setRule(k)} />
          ))}
        </View>
      </Field>
      {rule === 'steps' ? (
        <Field label="Tranches (₱, comma separated; the last repeats)">
          <Input value={tranches} onChangeText={setTranches} placeholder="100,000, 50,000" />
        </Field>
      ) : null}
      {rule !== 'fixed' ? (
        <Field label={rule === 'steps' ? 'Hard cap (₱, optional)' : rule === 'cap' ? 'Cap (₱, empty = no cap)' : 'Target (₱)'}>
          <Input value={target} onChangeText={setTarget} keyboardType="decimal-pad" />
        </Field>
      ) : (
        <Field label="Fixed amount a month (₱)">
          <Input value={fixed} onChangeText={setFixed} keyboardType="decimal-pad" />
        </Field>
      )}
      {rule === 'reset' ? (
        <Field label="Starts again in">
          <View style={s.chips}>
            {MON.map((m, i) => (
              <Chip key={m} label={m} on={resetMonth === i + 1} onPress={() => setResetMonth(i + 1)} />
            ))}
          </View>
        </Field>
      ) : null}
      <Field label="Payroll savings plan">
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 13, flex: 1 }}>
            Goes into this fund, in full, and this fund never resets. Only one fund can have it{planFund && planFund.id !== fund?.id && linkPlan ? `; this moves it from ${planFund.name}` : ''}.
          </Text>
          <Switch value={linkPlan} onValueChange={setLinkPlan} trackColor={{ true: c.accent, false: c.line }} thumbColor={c.ink} accessibilityLabel="Payroll savings plan goes into this fund" />
        </View>
      </Field>
      <Field label="Up to a month (₱, optional)">
        <Input value={maxPer} onChangeText={setMaxPer} keyboardType="decimal-pad" />
      </Field>
      <Field label="Linked account">
        <View style={s.chips}>
          <Chip label="None" on={linked === null} onPress={() => setLinked(null)} />
          {accounts.map((a) => (
            <Chip key={a.id} label={a.name} on={linked === a.id} onPress={() => setLinked(a.id)} />
          ))}
        </View>
      </Field>
      {linked ? (
        <Field label="Share of that account (%, optional)">
          <Input value={share} onChangeText={setShare} keyboardType="decimal-pad" />
        </Field>
      ) : (
        <Field label="Starting balance (₱, optional)">
          <Input value={start} onChangeText={setStart} keyboardType="decimal-pad" />
        </Field>
      )}
      <SheetActions onClose={onClose} onSave={() => run(() => saveFund(supabase, payload()))} busy={busy} saveLabel={fund ? 'Save' : 'Create'} problem={problem} />
      {fund ? (
        <Pressable
          onPress={() => Alert.alert('Archive this fund?', 'It leaves the forecast.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Archive', style: 'destructive', onPress: () => void run(() => archiveFund(supabase, fund.id)) }])}
          accessibilityRole="button"
          style={[s.btn, { backgroundColor: c.errTint }]}
        >
          <Text style={{ color: c.err, fontFamily: fonts.bodyBold, fontSize: 15 }}>Archive fund</Text>
        </Pressable>
      ) : null}
    </Sheet>
  );
}

/** Change one month: the order funds fill in, amounts pinned, funds skipped, and a note. Or put it back to the default. */
export function OverrideSheet({
  row, funds, order: orderIn, pins: pinsIn, skips: skipsIn, note: noteIn, onClose, onSaved,
}: {
  row: ForecastRow;
  funds: { id: string; name: string }[];
  order: string[] | null;
  pins: Record<string, number>;
  skips: string[];
  note: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const c = useTheme();
  const { hide } = useHide();
  const [order, setOrder] = useState<string[]>(orderIn ?? funds.map((f) => f.id));
  const [custom, setCustom] = useState(orderIn !== null);
  const [pins, setPins] = useState<Record<string, string>>(Object.fromEntries(Object.entries(pinsIn).map(([k, v]) => [k, pesos(v)])));
  const [skips, setSkips] = useState<string[]>(skipsIn);
  const [note, setNote] = useState(noteIn);
  const { problem, busy, run } = useRun(onSaved);
  const name = (id: string) => funds.find((f) => f.id === id)?.name ?? 'Fund';
  const move = (i: number, d: -1 | 1) =>
    setOrder((o) => {
      const j = i + d;
      if (j < 0 || j >= o.length) return o;
      const n = [...o];
      [n[i], n[j]] = [n[j]!, n[i]!];
      setCustom(true);
      return n;
    });

  const save = () => {
    const pinMap: Record<string, number> = {};
    for (const [id, t] of Object.entries(pins)) {
      const v = t.trim() === '' ? undefined : parsePesos(t.trim());
      if (v !== undefined && !skips.includes(id)) pinMap[id] = v;
    }
    return run(() => saveOverride(supabase, { months: [row.month], order: custom ? order : null, pins: pinMap, skips, note }));
  };

  return (
    <Sheet title={`Change ${MON[Number(row.month.slice(5)) - 1]} ${row.month.slice(0, 4)}`} onClose={onClose}>
      <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 13 }}>Pool {peso(row.pool, hide)} this month</Text>
      <Field label="Fill order">
        {order.map((id, i) => (
          <View key={id} style={s.line}>
            <Text style={{ color: c.muted, fontFamily: fonts.bodyBold, fontSize: 13, width: 18 }}>{i + 1}</Text>
            <Text style={{ flex: 1, color: c.ink, fontFamily: fonts.bodyBold, fontSize: 15 }}>{name(id)}</Text>
            <Pressable onPress={() => move(i, -1)} accessibilityRole="button" accessibilityLabel={`Move ${name(id)} up`} style={[s.ib, { backgroundColor: c.soft }]}>
              <Text style={{ color: c.ink }}>↑</Text>
            </Pressable>
            <Pressable onPress={() => move(i, 1)} accessibilityRole="button" accessibilityLabel={`Move ${name(id)} down`} style={[s.ib, { backgroundColor: c.soft }]}>
              <Text style={{ color: c.ink }}>↓</Text>
            </Pressable>
          </View>
        ))}
      </Field>
      <Field label="Pin an amount or skip a fund">
        {funds.map((f) => (
          <View key={f.id} style={{ gap: 6, marginBottom: 6 }}>
            <View style={s.between}>
              <Text style={{ color: c.ink, fontFamily: fonts.bodyBold, fontSize: 15 }}>{f.name}</Text>
              <Chip label="Skip" on={skips.includes(f.id)} onPress={() => setSkips((x) => (x.includes(f.id) ? x.filter((y) => y !== f.id) : [...x, f.id]))} />
            </View>
            {!skips.includes(f.id) ? <Input value={pins[f.id] ?? ''} onChangeText={(t) => setPins((p) => ({ ...p, [f.id]: t }))} keyboardType="decimal-pad" placeholder="Pin ₱ (empty = by the rule)" /> : null}
          </View>
        ))}
      </Field>
      <Field label="Note (optional)">
        <Input value={note} onChangeText={setNote} maxLength={200} />
      </Field>
      <SheetActions onClose={onClose} onSave={save} busy={busy} problem={problem} />
      {row.override ? (
        <Pressable onPress={() => void run(() => resetMonths(supabase, [row.month]))} accessibilityRole="button" style={[s.btn, { backgroundColor: c.soft }]}>
          <Text style={{ color: c.ink, fontFamily: fonts.bodyBold, fontSize: 15 }}>Back to the default</Text>
        </Pressable>
      ) : null}
    </Sheet>
  );
}

/** One change across several months: put a fund first, pin an amount, skip it, or clear its pin. */
export function BulkSheet({ months, funds, onClose, onSaved }: { months: string[]; funds: { id: string; name: string }[]; onClose: () => void; onSaved: () => void }) {
  const [picked, setPicked] = useState<string[]>([]);
  const [op, setOp] = useState<'first' | 'pin' | 'skip' | 'unpin'>('first');
  const [fundId, setFundId] = useState(funds[0]?.id ?? '');
  const [amount, setAmount] = useState('');
  const { problem, busy, run } = useRun(onSaved);
  const toggle = (m: string) => setPicked((p) => (p.includes(m) ? p.filter((x) => x !== m) : [...p, m]));
  return (
    <Sheet title="Change many months" onClose={onClose}>
      <Field label="Months">
        <View style={s.chips}>
          <Chip label="All" on={picked.length === months.length} onPress={() => setPicked(picked.length === months.length ? [] : [...months])} />
          {months.map((m) => (
            <Chip key={m} label={MON[Number(m.slice(5)) - 1]!} on={picked.includes(m)} onPress={() => toggle(m)} />
          ))}
        </View>
      </Field>
      <Field label="Fund">
        <View style={s.chips}>
          {funds.map((f) => (
            <Chip key={f.id} label={f.name} on={fundId === f.id} onPress={() => setFundId(f.id)} />
          ))}
        </View>
      </Field>
      <Field label="Do this">
        <View style={s.chips}>
          <Chip label="Put it first" on={op === 'first'} onPress={() => setOp('first')} />
          <Chip label="Pin an amount" on={op === 'pin'} onPress={() => setOp('pin')} />
          <Chip label="Skip it" on={op === 'skip'} onPress={() => setOp('skip')} />
          <Chip label="Clear pin or skip" on={op === 'unpin'} onPress={() => setOp('unpin')} />
        </View>
      </Field>
      {op === 'pin' ? (
        <Field label="Amount (₱)">
          <Input value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
        </Field>
      ) : null}
      <SheetActions
        onClose={onClose}
        onSave={() => run(() => (picked.length === 0 ? Promise.resolve({ error: 'Pick the months.' }) : bulkOverride(supabase, { months: picked.sort(), op, fundId, amount: op === 'pin' ? (parsePesos(amount.trim()) ?? -1) : undefined })))}
        busy={busy}
        saveLabel="Apply"
        problem={problem}
      />
      <Pressable onPress={() => void run(() => (picked.length === 0 ? Promise.resolve({ error: 'Pick the months.' }) : resetMonths(supabase, picked)))} accessibilityRole="button" style={[s.btn, { backgroundColor: 'transparent' }]}>
        <Text style={{ color: '#93a5bd', fontFamily: fonts.bodyBold, fontSize: 14 }}>Reset the picked months to the default</Text>
      </Pressable>
    </Sheet>
  );
}

const s = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 },
  ib: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  btn: { minHeight: 48, borderRadius: 999, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  swatch: { width: 36, height: 36, borderRadius: 18, borderWidth: 3 },
});
