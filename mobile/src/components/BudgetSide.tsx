import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import type { BudgetData } from '@/lib/budget/load';
import { poolBalanceNow, poolExcess } from '@/lib/budget/pools';
import type { IsoDate } from '@/lib/domain/dates';
import { cutoffOfficeDays, settleRows } from '@/lib/budget/rto';
import { money, parsePesos, type Money } from '@/lib/domain/money';
import { rtoDayBudget } from '@/lib/engine/budget';
import { cutoffSettingsFromPaydays, usualOfficeDays } from '@/lib/engine/months';
import type { ProjectionMonth } from '@/lib/engine/projection';
import { shortDate, weekdayName } from '@/lib/now/format';
import { Amount, Card, Chip } from '~/components/ui';
import { Field, Input, Sheet, SheetActions } from '~/components/Sheet';
import { archiveCategory, createPool, saveCategory, setOfficeDay, setUsualOfficeDays, settleDay, takeFromPool, undoSettle } from '~/lib/budgetOps';
import { useHide } from '~/lib/hide';
import { peso } from '~/lib/money';
import { supabase } from '~/lib/supabase';
import { fonts, useTheme } from '~/lib/theme';

type Result = { ok: true } | { error: string };
const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const SETTLED_KIND: Record<string, string> = { settle_to_pool: 'pool', settle_to_wants: 'Wants', over_from_wants: 'Wants', over_from_excess: 'pool excess' };
const COLORS = ['#34d399', '#7fa8ff', '#f6c453', '#c4a0ff', '#5cd0e6', '#f28bc8', '#ff8a8a', '#93a5bd'];

type Open =
  | { k: 'settle'; date: string; under: boolean; diff: number }
  | { k: 'usual' }
  | { k: 'take'; poolId: string; name: string; to: 'use' | 'to_wants' }
  | { k: 'newpool' }
  | { k: 'category'; id?: string; name: string; groupId: string; color: string | null };

function Row({ children, onPress, label }: { children: React.ReactNode; onPress?: () => void; label?: string }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} accessibilityRole={onPress ? 'button' : undefined} accessibilityLabel={label} style={s.row}>
      {children}
    </Pressable>
  );
}

function SmallBtn({ label, onPress, accent }: { label: string; onPress: () => void; accent?: boolean }) {
  const c = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={[s.small, { backgroundColor: accent ? c.accent : c.soft }]}>
      <Text style={{ color: accent ? c.onAccent : c.ink, fontFamily: fonts.bodyBold, fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
}

/** What the web shows beside the board: settle office days, the RTO card, pools, categories. Every edit opens in a sheet. */
export function BudgetSide({ data, nowRun, onChanged }: { data: BudgetData; nowRun: ProjectionMonth; onChanged: () => void }) {
  const c = useTheme();
  const { hide } = useHide();
  const [open, setOpen] = useState<Open | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const cutoffKey = data.period.which === 1 ? 'first' : 'second';
  const settings = cutoffSettingsFromPaydays(data.paydays.first, data.paydays.second);
  const period = { start: data.period.start, end: data.period.end };
  const contLine = data.lines.find((l) => l.kind === 'rto_contingency') ?? null;
  const amountOf = (id: string | null) => (id ? (nowRun.budget.lines.find((l) => l.lineId === id)?.[cutoffKey] ?? 0) : 0);
  const days = cutoffOfficeDays(period, data.officeDays, data.overrides);
  const usualCount = usualOfficeDays(period, data.officeDays);
  const dayBudget = rtoDayBudget(nowRun.budget.rtoTotal[cutoffKey], usualCount);

  const pools = data.pools.map((p) => {
    const perCutoff = money(amountOf(p.lineId));
    const balance = poolBalanceNow({ createdOn: p.createdOn, today: data.today, settings, perCutoff, entries: p.entries });
    return { p, perCutoff, balance, excess: poolExcess(balance, p.keepUpTo) };
  });
  const cont = contLine ? pools.find((x) => x.p.lineId === contLine.id) : undefined;
  const settled = new Map<string, string>();
  for (const e of cont?.p.entries ?? []) if (SETTLED_KIND[e.kind]) settled.set(e.occurredOn, SETTLED_KIND[e.kind]!);
  const rows = settleRows({ days, spendByDay: data.spendByDay, dayBudget, settledDays: new Set(settled.keys()), today: data.today });
  const catView = data.categories.map((x) => ({ ...x, lines: data.lines.filter((l) => l.categoryId === x.id).length }));

  async function act(fn: () => Promise<Result>) {
    setProblem(null);
    const r = await fn();
    if ('error' in r) setProblem(r.error);
    else onChanged();
  }
  const done = () => {
    setOpen(null);
    onChanged();
  };

  const h2 = [s.h2, { color: c.ink, fontFamily: fonts.display }];
  const muted = { color: c.muted, fontFamily: fonts.body, fontSize: 13 } as const;

  return (
    <>
      {problem ? <Text style={{ color: c.err, fontFamily: fonts.body, fontSize: 14 }}>{problem}</Text> : null}

      {rows.length > 0 ? (
        <Card>
          <Text style={h2}>Settle office days</Text>
          {rows.map((r) => {
            const where = settled.get(r.date);
            const wd = weekdayName(r.date);
            return (
              <Row key={r.date} onPress={where ? undefined : () => setOpen({ k: 'settle', date: r.date, under: r.diff >= 0, diff: Math.abs(r.diff) })} label={`Settle ${r.date}`}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: c.ink, fontFamily: fonts.bodyBold, fontSize: 15 }}>
                    {wd} {shortDate(r.date)}{r.skipped ? ' (skipped)' : ''}
                  </Text>
                  <Text style={muted}>
                    {r.skipped && r.spent === 0 ? `${peso(r.budget, hide)} unused` : `${peso(r.spent, hide)} of ${peso(r.budget, hide)}`}
                  </Text>
                </View>
                {where ? (
                  <SmallBtn label={`To ${where} · undo`} onPress={() => act(() => undoSettle(supabase, r.date))} />
                ) : (
                  <Text style={{ color: r.diff >= 0 ? c.accentText : c.err, fontFamily: fonts.bodyBold, fontSize: 15 }}>
                    {r.diff >= 0 ? '+' : '−'}
                    {peso(money(Math.abs(r.diff)), hide)}
                  </Text>
                )}
              </Row>
            );
          })}
        </Card>
      ) : null}

      <Card>
        <View style={s.between}>
          <Text style={h2}>Office days</Text>
          <SmallBtn label="Usual days" onPress={() => setOpen({ k: 'usual' })} />
        </View>
        <Text style={muted}>
          {peso(money(dayBudget), hide)} a day · {days.filter((d) => d.office && d.usual).length} planned
        </Text>
        <View style={s.chips}>
          {days.map((d) => (
            <Chip
              key={d.date}
              label={`${weekdayName(d.date)} ${Number(d.date.slice(8))}`}
              on={d.office}
              onPress={() => act(() => setOfficeDay(supabase, { date: d.date, office: !d.office, usual: d.usual, dayBudget }))}
            />
          ))}
        </View>
      </Card>

      <Card>
        <View style={s.between}>
          <Text style={h2}>Pools</Text>
          <SmallBtn label="+ New" onPress={() => setOpen({ k: 'newpool' })} />
        </View>
        {pools.length === 0 ? <Text style={muted}>No pools yet.</Text> : null}
        {pools.map(({ p, perCutoff, balance, excess }) => (
          <View key={p.id} style={{ gap: 6 }}>
            <View style={s.between}>
              <Text style={{ color: c.ink, fontFamily: fonts.bodyBold, fontSize: 15 }}>{p.name}</Text>
              <Amount value={balance} />
            </View>
            <Text style={muted}>
              {peso(perCutoff, hide)} each cutoff{excess > 0 ? ` · ${peso(excess, hide)} over` : ''}
            </Text>
            <View style={s.chips}>
              <SmallBtn label="Take out" onPress={() => setOpen({ k: 'take', poolId: p.id, name: p.name, to: 'use' })} />
              <SmallBtn label="Move to Wants" onPress={() => setOpen({ k: 'take', poolId: p.id, name: p.name, to: 'to_wants' })} />
            </View>
          </View>
        ))}
      </Card>

      <Card>
        <View style={s.between}>
          <Text style={h2}>Categories</Text>
          <SmallBtn label="+ Add" onPress={() => setOpen({ k: 'category', name: '', groupId: data.groups[0]?.id ?? '', color: null })} />
        </View>
        {catView.map((x) => (
          <Row key={x.id} onPress={() => setOpen({ k: 'category', id: x.id, name: x.name, groupId: x.groupId, color: x.color ?? null })} label={`Edit ${x.name}`}>
            <View style={[s.dot, { backgroundColor: x.color ?? c.muted }]} />
            <Text style={{ flex: 1, color: c.ink, fontFamily: fonts.bodyBold, fontSize: 15 }}>{x.name}</Text>
            <Text style={muted}>{x.lines} {x.lines === 1 ? 'line' : 'lines'}</Text>
            <Text style={{ color: c.muted, fontSize: 18 }}>›</Text>
          </Row>
        ))}
      </Card>

      {open?.k === 'settle' ? <SettleSheet {...open} dayBudget={dayBudget} onClose={() => setOpen(null)} onSaved={done} /> : null}
      {open?.k === 'usual' ? <UsualSheet days={data.officeDays} onClose={() => setOpen(null)} onSaved={done} /> : null}
      {open?.k === 'take' ? <TakeSheet {...open} onClose={() => setOpen(null)} onSaved={done} /> : null}
      {open?.k === 'newpool' ? <NewPoolSheet lines={data.lines.filter((l) => l.rule !== 'rest').map((l) => ({ id: l.id, name: l.name }))} onClose={() => setOpen(null)} onSaved={done} /> : null}
      {open?.k === 'category' ? <CategorySheet start={open} groups={data.groups.map((g) => ({ id: g.id, name: g.name }))} onClose={() => setOpen(null)} onSaved={done} /> : null}
    </>
  );
}

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

function SettleSheet({ date, under, diff, onClose, onSaved }: { date: string; under: boolean; diff: number; dayBudget: Money; onClose: () => void; onSaved: () => void }) {
  const c = useTheme();
  const { hide } = useHide();
  const { problem, busy, run } = useRun(onSaved);
  const options: { to: 'pool' | 'wants' | 'excess'; label: string }[] = under
    ? [{ to: 'pool', label: 'Keep it in the pool' }, { to: 'wants', label: 'Move it to Wants' }]
    : [{ to: 'wants', label: 'Take it from Wants' }, { to: 'excess', label: 'Take it from the pool excess' }];
  return (
    <Sheet title={`Settle ${shortDate(date as IsoDate)}`} onClose={onClose}>
      <Text style={{ color: c.ink, fontFamily: fonts.bodyBold, fontSize: 15 }}>
        {under ? 'Under budget by' : 'Over budget by'} {peso(money(diff), hide)}
      </Text>
      {options.map((o) => (
        <Pressable key={o.to} disabled={busy} onPress={() => run(() => settleDay(supabase, { date, under, to: o.to, amount: diff }))} accessibilityRole="button" style={[s.big, { backgroundColor: c.soft }]}>
          <Text style={{ color: c.ink, fontFamily: fonts.bodyBold, fontSize: 15 }}>{o.label}</Text>
        </Pressable>
      ))}
      {problem ? <Text style={{ color: c.err, fontFamily: fonts.body, fontSize: 14 }}>{problem}</Text> : null}
    </Sheet>
  );
}

function UsualSheet({ days, onClose, onSaved }: { days: number[]; onClose: () => void; onSaved: () => void }) {
  const [picked, setPicked] = useState<number[]>(days);
  const { problem, busy, run } = useRun(onSaved);
  return (
    <Sheet title="Usual office days" onClose={onClose}>
      <View style={s.chips}>
        {DOW.map((d, i) => (
          <Chip key={d} label={d} on={picked.includes(i + 1)} onPress={() => setPicked((p) => (p.includes(i + 1) ? p.filter((x) => x !== i + 1) : [...p, i + 1]))} />
        ))}
      </View>
      <SheetActions onClose={onClose} onSave={() => run(() => setUsualOfficeDays(supabase, picked))} busy={busy} problem={problem} />
    </Sheet>
  );
}

function TakeSheet({ poolId, name, to, onClose, onSaved }: { poolId: string; name: string; to: 'use' | 'to_wants'; onClose: () => void; onSaved: () => void }) {
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const { problem, busy, run } = useRun(onSaved);
  const pesos = parsePesos(amount.trim());
  return (
    <Sheet title={to === 'use' ? `Take out of ${name}` : `Move ${name} to Wants`} onClose={onClose}>
      <Field label="Amount (₱)">
        <Input value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0.00" />
      </Field>
      {to === 'use' ? (
        <Field label="What for (optional)">
          <Input value={note} onChangeText={setNote} maxLength={200} />
        </Field>
      ) : null}
      <SheetActions
        onClose={onClose}
        onSave={() => run(() => takeFromPool(supabase, { poolId, amount: pesos ?? 0, to, note: note.trim() || undefined }))}
        busy={busy}
        saveLabel={to === 'use' ? 'Take out' : 'Move'}
        problem={problem}
      />
    </Sheet>
  );
}

function NewPoolSheet({ lines, onClose, onSaved }: { lines: { id: string; name: string }[]; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState('');
  const [lineId, setLineId] = useState<string | null>(null);
  const [keep, setKeep] = useState('');
  const { problem, busy, run } = useRun(onSaved);
  const keepUpTo = keep.trim() === '' ? null : (parsePesos(keep.trim()) ?? NaN);
  return (
    <Sheet title="New pool" onClose={onClose}>
      <Field label="Name">
        <Input value={name} onChangeText={setName} maxLength={40} />
      </Field>
      <Field label="Funded each cutoff by">
        <View style={s.chips}>
          <Chip label="Nothing" on={lineId === null} onPress={() => setLineId(null)} />
          {lines.map((l) => (
            <Chip key={l.id} label={l.name} on={lineId === l.id} onPress={() => setLineId(l.id)} />
          ))}
        </View>
      </Field>
      <Field label="Keep up to (₱, optional)">
        <Input value={keep} onChangeText={setKeep} keyboardType="decimal-pad" />
      </Field>
      <SheetActions onClose={onClose} onSave={() => run(() => createPool(supabase, { name, lineId, keepUpTo: keepUpTo !== null && Number.isNaN(keepUpTo) ? -1 : keepUpTo }))} busy={busy} saveLabel="Create" problem={problem} />
    </Sheet>
  );
}

function CategorySheet({ start, groups, onClose, onSaved }: { start: { id?: string; name: string; groupId: string; color: string | null }; groups: { id: string; name: string }[]; onClose: () => void; onSaved: () => void }) {
  const c = useTheme();
  const [name, setName] = useState(start.name);
  const [groupId, setGroupId] = useState(start.groupId);
  const [color, setColor] = useState<string | null>(start.color);
  const { problem, busy, run } = useRun(onSaved);
  return (
    <Sheet title={start.id ? 'Edit category' : 'Add category'} onClose={onClose}>
      <Field label="Name">
        <Input value={name} onChangeText={setName} maxLength={60} />
      </Field>
      <Field label="Group">
        <View style={s.chips}>
          {groups.map((g) => (
            <Chip key={g.id} label={g.name} on={groupId === g.id} onPress={() => setGroupId(g.id)} />
          ))}
        </View>
      </Field>
      <Field label="Colour">
        <View style={s.chips}>
          {COLORS.map((col) => (
            <Pressable key={col} onPress={() => setColor(col)} accessibilityRole="button" accessibilityLabel={`Colour ${col}`} style={[s.swatch, { backgroundColor: col, borderColor: color === col ? c.ink : 'transparent' }]} />
          ))}
        </View>
      </Field>
      <SheetActions onClose={onClose} onSave={() => run(() => saveCategory(supabase, { id: start.id, name, groupId, color }))} busy={busy} problem={problem} />
      {start.id ? (
        <Pressable
          onPress={() => Alert.alert('Archive this category?', 'It keeps its transactions but leaves the pickers.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Archive', style: 'destructive', onPress: () => void run(() => archiveCategory(supabase, start.id!)) }])}
          accessibilityRole="button"
          style={[s.big, { backgroundColor: c.errTint }]}
        >
          <Text style={{ color: c.err, fontFamily: fonts.bodyBold, fontSize: 15 }}>Archive category</Text>
        </Pressable>
      ) : null}
    </Sheet>
  );
}


const s = StyleSheet.create({
  h2: { fontSize: 16 },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  dot: { width: 12, height: 12, borderRadius: 6 },
  small: { minHeight: 36, borderRadius: 999, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  big: { minHeight: 48, borderRadius: 999, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  swatch: { width: 36, height: 36, borderRadius: 18, borderWidth: 3 },
});
