import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { applyMoves, type MovedBudget, type MoveNote } from '@/lib/budget/moves';
import { setReimbursementMark, type ReimbursementStatus } from '@/lib/budget/reimburse';
import { payrollOnLines, withPayroll, type PayrollRow } from '@/lib/budget/payroll';
import { loadBudget, type BudgetData } from '@/lib/budget/load';
import { buildBudgetScreen, monthLabel } from '@/lib/budget/screen';
import { addMonths, type YearMonth } from '@/lib/domain/dates';
import { cutoffRefLabel, type PlanSpan } from '@/lib/budget/plans';
import { MonthInput } from '~/components/DateInput';
import { PlanSheet } from '~/components/PlanSheet';
import { cutoffText, groupsForCutoff, ruleText, type GroupView, type LineView } from '@/lib/budget/view';
import type { LineInput } from '@/lib/budget/line-input';
import { formatPesos, money, parsePesos } from '@/lib/domain/money';
import { BudgetSide } from '~/components/BudgetSide';
import { Amount, Body, Card, Chip, Label, Notice, Screen } from '~/components/ui';
import { deleteLine, saveLine } from '~/lib/budgetWrite';
import { useHide } from '~/lib/hide';
import { peso } from '~/lib/money';
import { supabase } from '~/lib/supabase';
import { fonts, useTheme } from '~/lib/theme';
import { useLoad } from '~/lib/useLoad';

type Draft = {
  id?: string;
  name: string;
  categoryId: string;
  rule: LineInput['rule'];
  amount: string;
  /** The 2nd cutoff's amount (fixed line on both cutoffs); empty = the same as the first. */
  amountSecond: string;
  /** Reimbursement: how much is paid back each month, the cutoff it lands in, and the day. */
  rbAmount: string;
  rbCutoff: 'first' | 'second';
  rbDay: string;
  percent: string;
  cutoff: LineInput['cutoff'];
  accountId: string | null;
  startsOn: string;
  endsOn: string;
  isDraft: boolean;
  countsToDaily: boolean;
  kind: LineInput['kind'];
};

const draftOf = (l: LineView): Draft => ({
  id: l.id,
  name: l.name,
  categoryId: l.categoryId,
  rule: l.rule,
  amount: l.fixed === null ? '' : formatPesos(l.fixed, { symbol: false }),
  amountSecond: l.fixedSecond === null ? '' : formatPesos(l.fixedSecond, { symbol: false }),
  rbAmount: l.reimburse ? formatPesos(l.reimburse.amount, { symbol: false }) : '',
  rbCutoff: l.reimburse?.cutoff ?? 'first',
  rbDay: l.reimburse?.day ? String(l.reimburse.day) : '',
  percent: l.pctBp === null ? '' : String(l.pctBp / 100),
  cutoff: l.cutoff,
  accountId: l.accountId,
  startsOn: l.startsOn ?? '',
  endsOn: l.endsOn ?? '',
  isDraft: l.isDraft,
  countsToDaily: l.countsToDaily,
  kind: l.kind,
});

const blankDraft = (categoryId: string): Draft => ({
  name: '', categoryId, rule: 'fixed', amount: '', amountSecond: '', rbAmount: '', rbCutoff: 'first', rbDay: '', percent: '', cutoff: 'both', accountId: null, startsOn: '', endsOn: '', isDraft: false, countsToDaily: false, kind: 'normal',
});

/** The editor's fields become the shape the shared validator checks. Typed pesos and percents are converted here. */
function toInput(d: Draft): unknown {
  const pesos = d.amount.trim() === '' ? undefined : parsePesos(d.amount.trim());
  const pct = d.percent.trim() === '' ? NaN : Math.round(Number(d.percent) * 100);
  // Typed amounts that cannot be read are passed on as text so the shared validator says what is wrong.
  const second = d.amountSecond.trim() === '' ? null : (parsePesos(d.amountSecond.trim()) ?? 'x');
  const rb = d.rbAmount.trim() === '' ? null : (parsePesos(d.rbAmount.trim()) ?? 'x');
  const rbDay = d.rbDay.trim() === '' ? null : Number(d.rbDay);
  return {
    id: d.id,
    name: d.name,
    categoryId: d.categoryId,
    rule: d.rule,
    amount: d.rule === 'fixed' ? (pesos ?? null) : null,
    amountSecond: d.rule === 'fixed' && d.cutoff === 'both' ? second : null,
    reimburse: rb === null || rb === 0 ? null : { amount: rb, cutoff: d.rbCutoff, day: rbDay },
    pctBp: d.rule === 'pct' ? (Number.isFinite(pct) ? pct : null) : null,
    cutoff: d.cutoff,
    accountId: d.accountId,
    startsOn: d.startsOn.trim() || null,
    endsOn: d.endsOn.trim() || null,
    isDraft: d.isDraft,
    countsToDaily: d.countsToDaily,
    kind: d.kind,
  };
}

function LineEditor({
  start, data, onClose, onSaved, planId,
}: {
  start: Draft;
  data: BudgetData;
  /** The plan a new line goes into (null = the normal budget). */
  planId: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const [d, setD] = useState<Draft>(start);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));
  const input = [s.input, { color: c.ink, backgroundColor: c.soft, fontFamily: fonts.body }];

  async function save() {
    setBusy(true);
    setProblem(null);
    const r = await saveLine(supabase, Object.assign({}, toInput(d) as object, { planId }));
    setBusy(false);
    if ('error' in r) setProblem(r.error);
    else onSaved();
  }

  function remove() {
    Alert.alert('Delete this line?', `${d.name || 'This line'} will leave the budget. Transactions stay; they just lose the link.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const r = await deleteLine(supabase, d.id!);
          if ('error' in r) setProblem(r.error);
          else onSaved();
        },
      },
    ]);
  }

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={s.scrim} onPress={onClose} accessibilityLabel="Close" />
      <View style={[s.sheet, { backgroundColor: c.surface, borderColor: c.line, paddingBottom: insets.bottom + 16 }]}>
        <View style={[s.grab, { backgroundColor: c.line }]} />
        <ScrollView contentContainerStyle={{ gap: 14 }} keyboardShouldPersistTaps="handled">
          <Text style={{ color: c.ink, fontFamily: fonts.display, fontSize: 20 }}>{d.id ? 'Edit line' : 'Add a line'}</Text>

          <Field label="Name">
            <TextInput value={d.name} onChangeText={(v) => set('name', v)} maxLength={60} placeholder="Groceries" placeholderTextColor={c.muted} style={input} />
          </Field>

          <Field label="Category">
            <View style={s.chips}>
              {data.categories.map((x) => (
                <Chip key={x.id} label={x.name} on={d.categoryId === x.id} onPress={() => set('categoryId', x.id)} />
              ))}
            </View>
          </Field>

          <Field label="Rule">
            <View style={s.chips}>
              <Chip label="Fixed" on={d.rule === 'fixed'} onPress={() => set('rule', 'fixed')} />
              <Chip label="% of take-home" on={d.rule === 'pct'} onPress={() => set('rule', 'pct')} />
              <Chip label="Whatever is left" on={d.rule === 'rest'} onPress={() => setD((x) => ({ ...x, rule: 'rest', kind: 'normal' }))} />
            </View>
            {d.rule === 'fixed' ? (
              <TextInput value={d.amount} onChangeText={(v) => set('amount', v)} keyboardType="decimal-pad" placeholder={d.cutoff === 'both' ? '1st cutoff amount, like 5,000' : 'Amount, like 1,250.50'} placeholderTextColor={c.muted} style={input} />
            ) : null}
            {d.rule === 'fixed' && d.cutoff === 'both' ? (
              <TextInput value={d.amountSecond} onChangeText={(v) => set('amountSecond', v)} keyboardType="decimal-pad" placeholder="2nd cutoff amount (empty = same as the 1st)" placeholderTextColor={c.muted} style={input} />
            ) : null}
            {d.rule === 'pct' ? (
              <TextInput value={d.percent} onChangeText={(v) => set('percent', v)} keyboardType="decimal-pad" placeholder="Percent, like 13" placeholderTextColor={c.muted} style={input} />
            ) : null}
          </Field>

          <Field label="Cutoff">
            <View style={s.chips}>
              <Chip label="1st" on={d.cutoff === 'first'} onPress={() => set('cutoff', 'first')} />
              <Chip label="2nd" on={d.cutoff === 'second'} onPress={() => set('cutoff', 'second')} />
              <Chip label="Both" on={d.cutoff === 'both'} onPress={() => set('cutoff', 'both')} />
            </View>
          </Field>

          <Field label="Paid back to you each month (optional)">
            <TextInput value={d.rbAmount} onChangeText={(v) => set('rbAmount', v)} keyboardType="decimal-pad" placeholder="Reimbursed amount, like 2,099" placeholderTextColor={c.muted} style={input} />
            <View style={s.chips}>
              <Chip label="Deposited in the 1st cutoff" on={d.rbCutoff === 'first'} onPress={() => set('rbCutoff', 'first')} />
              <Chip label="Deposited in the 2nd" on={d.rbCutoff === 'second'} onPress={() => set('rbCutoff', 'second')} />
            </View>
            <TextInput value={d.rbDay} onChangeText={(v) => set('rbDay', v)} keyboardType="number-pad" maxLength={2} placeholder="Deposit day, like 17 (optional)" placeholderTextColor={c.muted} style={input} />
          </Field>

          <Field label="Goes to an account (a bill or transfer)">
            <View style={s.chips}>
              <Chip label="No, it is spending" on={d.accountId === null} onPress={() => set('accountId', null)} />
              {data.accounts.map((a) => (
                <Chip key={a.id} label={a.name} on={d.accountId === a.id} onPress={() => set('accountId', a.id)} />
              ))}
            </View>
          </Field>

          <View style={s.two}>
            <View style={{ flex: 1 }}>
              <Field label="Starts">
                <MonthInput label="Starts" value={d.startsOn} onChange={(v) => set('startsOn', v)} clearable placeholder="No start" />
              </Field>
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Ends">
                <MonthInput label="Ends" value={d.endsOn} onChange={(v) => set('endsOn', v)} clearable placeholder="No end" />
              </Field>
            </View>
          </View>

          <Field label="Counts toward">
            <View style={s.chips}>
              <Chip label="Normal" on={d.kind === 'normal'} onPress={() => set('kind', 'normal')} />
              {d.rule !== 'rest' ? <Chip label="Office days" on={d.kind === 'rto'} onPress={() => set('kind', 'rto')} /> : null}
              {d.rule !== 'rest' ? <Chip label="Office-day contingency" on={d.kind === 'rto_contingency'} onPress={() => set('kind', 'rto_contingency')} /> : null}
            </View>
          </Field>

          <Toggle label="Counts toward the daily amount" value={d.countsToDaily} onChange={(v) => set('countsToDaily', v)} />
          <Toggle label="Draft (not in the budget yet)" value={d.isDraft} onChange={(v) => set('isDraft', v)} />

          {problem ? <Text style={{ color: c.err, fontFamily: fonts.body, fontSize: 14 }}>{problem}</Text> : null}
          <View style={s.two}>
            <Pressable onPress={onClose} accessibilityRole="button" style={[s.btn, { flex: 1, backgroundColor: c.soft }]}>
              <Text style={{ color: c.ink, fontFamily: fonts.bodyBold, fontSize: 15 }}>Cancel</Text>
            </Pressable>
            <Pressable onPress={save} disabled={busy} accessibilityRole="button" style={[s.btn, { flex: 1, backgroundColor: c.accent, opacity: busy ? 0.6 : 1 }]}>
              <Text style={{ color: c.onAccent, fontFamily: fonts.bodyBold, fontSize: 15 }}>{busy ? 'Saving…' : 'Save'}</Text>
            </Pressable>
          </View>
          {d.id ? (
            <Pressable onPress={remove} accessibilityRole="button" style={[s.btn, { backgroundColor: c.errTint }]}>
              <Text style={{ color: c.err, fontFamily: fonts.bodyBold, fontSize: 15 }}>Delete line</Text>
            </Pressable>
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 6 }}>
      <Label>{label}</Label>
      {children}
    </View>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  const c = useTheme();
  return (
    <View style={s.between}>
      <Text style={{ color: c.ink, fontFamily: fonts.body, fontSize: 15, flex: 1 }}>{label}</Text>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: c.accent, false: c.line }} thumbColor={c.ink} accessibilityLabel={label} />
    </View>
  );
}

function LineRow({ l, moves, status, onMark, onPress }: { l: LineView; moves: MoveNote[]; status?: ReimbursementStatus; onMark: (input: MarkInput) => void; onPress: () => void }) {
  const c = useTheme();
  const { hide } = useHide();
  const sub = [ruleText(l), cutoffText(l.cutoff), l.accountName ? `to ${l.accountName}` : null, l.isDraft ? 'draft' : null].filter(Boolean).join(' · ');
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`Edit ${l.name}`} style={s.line}>
      <View style={{ flex: 1 }}>
        <Body bold>{l.name}</Body>
        <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 12 }}>{sub}</Text>
        {moves.map((n) => (
          <Text key={`${n.text}${n.counted}`} style={{ color: n.amount < 0 ? c.err : c.accentText, fontFamily: fonts.bodyBold, fontSize: 12 }}>
            {n.amount < 0 ? '−' : '+'}
            {peso(money(Math.abs(n.amount)), hide)} {n.text}
            {n.counted ? '' : ' (saved balance)'}
          </Text>
        ))}
        {l.spent ? (
          <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 12 }}>
            {peso(l.spent.amount, hide)} {l.spent.word}
          </Text>
        ) : null}
        {l.perCutoff && l.cutoff === 'both' && l.perCutoff.first !== l.perCutoff.second ? (
          <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 12 }}>
            1st {peso(l.perCutoff.first, hide)} · 2nd {peso(l.perCutoff.second, hide)}
          </Text>
        ) : null}
        {status && status.state !== 'expected' ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Text style={{ color: status.state === 'received' ? c.accentText : c.gold, fontFamily: fonts.bodyBold, fontSize: 12 }}>
              {status.state === 'received' ? 'Received' : status.state === 'postponed' ? 'Postponed' : 'Waiting for'} {peso(money(status.amount), hide)}
              {status.state === 'postponed' ? ' to next month' : status.carried > 0 ? ' (incl. postponed)' : ''}
            </Text>
            {(status.state === 'waiting'
              ? [['Mark received', true, false], ['Postponed?', false, true]] as const
              : [[status.state === 'received' ? 'Not yet' : 'Undo', false, false]] as const
            ).map(([text, received, postponed]) => (
              <Pressable
                key={text}
                onPress={() => onMark({ lineId: status.lineId, month: status.month, cutoff: status.cutoff, received, postponed })}
                accessibilityRole="button"
                style={{ minHeight: 36, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 999, backgroundColor: c.soft }}
              >
                <Text style={{ color: c.ink, fontFamily: fonts.bodyBold, fontSize: 12 }}>{text}</Text>
              </Pressable>
            ))}
          </View>
        ) : l.reimburse ? (
          <Text style={{ color: c.accentText, fontFamily: fonts.body, fontSize: 12 }}>
            paid back {peso(l.reimburse.amount, hide)}
            {l.reimburse.day ? ` on the ${l.reimburse.day}` : ` in the ${l.reimburse.cutoff === 'first' ? '1st' : '2nd'} cutoff`}
          </Text>
        ) : null}
        {l.topUps.length > 0 ? <Text style={{ color: c.accentText, fontFamily: fonts.body, fontSize: 12 }}>includes a raise top-up</Text> : null}
      </View>
      {l.amount !== null ? <Amount value={l.amount} /> : <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 13 }}>off this month</Text>}
    </Pressable>
  );
}

type MarkInput = { lineId: string; month: string; cutoff: 'first' | 'second'; received: boolean; postponed: boolean };

function Board({ reimbursements, onMark, moved, groups, data, payroll, cut, onEdit, onAdd }: { reimbursements: ReimbursementStatus[]; onMark: (input: MarkInput) => void; moved: MovedBudget; cut: 'first' | 'second' | null; payroll: Record<string, PayrollRow[]>; groups: GroupView[]; data: BudgetData; onEdit: (l: LineView) => void; onAdd: (categoryId: string) => void }) {
  const c = useTheme();
  const { hide } = useHide();
  return (
    <>
      {groups.map((g) => {
        const firstCategory = data.categories.find((x) => x.groupId === g.id)?.id;
        return (
          <Card key={g.id}>
            <View style={s.between}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: c.ink, fontFamily: fonts.display, fontSize: 18 }}>{g.name}</Text>
                <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 12 }}>
                  {g.feedsSavings ? 'feeds savings · ' : ''}
                  {Math.round(g.share)}% of take-home
                </Text>
              </View>
              <Text style={{ color: c.ink, fontFamily: fonts.bodyBold, fontSize: 16 }}>{peso(g.total, hide)}</Text>
            </View>
            <View style={[s.track, { backgroundColor: c.soft }]}>
              <View style={{ width: `${g.share}%`, height: 6, borderRadius: 3, backgroundColor: c.accent }} />
            </View>
            {g.lines.map((l) => (
              <LineRow key={l.id} l={l} moves={moved.notes[l.id] ?? []} status={reimbursements.find((x) => x.lineId === l.id)} onMark={onMark} onPress={() => onEdit(l)} />
            ))}
            {(moved.rows[g.id] ?? []).map((r) => (
              <View key={r.key} style={[s.between, { minHeight: 44 }]}>
                <View style={{ flex: 1 }}>
                  <Body bold>{r.label}</Body>
                  <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 12 }}>
                    {[r.counted ? 'office-day money you moved' : "from a pool's saved balance, not in the total", cutoffText(r.cutoff)].join(' · ')}
                  </Text>
                </View>
                <Text style={{ color: r.amount < 0 ? c.err : c.accentText, fontFamily: fonts.bodyBold, fontSize: 15 }}>
                  {r.amount < 0 ? '−' : '+'}
                  {peso(money(Math.abs(r.amount)), hide)}
                </Text>
              </View>
            ))}
            {(payroll[g.id] ?? []).filter((d) => !cut || d[cut] > 0).map((d) => (
              <View key={`${d.kind}-${d.label}`} style={[s.between, { minHeight: 44 }]}>
                <View style={{ flex: 1 }}>
                  <Body bold>{d.label}</Body>
                  <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 12 }}>{['from your payslip', cutoffText(d.cutoff)].join(' · ')}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ color: c.muted, fontFamily: fonts.bodyBold, fontSize: 15 }}>{peso(money(cut ? d[cut] : d.amount), hide)}</Text>
                  {!cut && d.cutoff === 'both' && d.first !== d.second ? (
                    <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 12 }}>1st {peso(money(d.first), hide)} · 2nd {peso(money(d.second), hide)}</Text>
                  ) : null}
                </View>
              </View>
            ))}
            {firstCategory ? (
              <Pressable onPress={() => onAdd(firstCategory)} accessibilityRole="button" style={[s.add, { backgroundColor: c.soft }]}>
                <Text style={{ color: c.ink, fontFamily: fonts.bodyBold, fontSize: 14 }}>+ Add a line to {g.name}</Text>
              </Pressable>
            ) : null}
          </Card>
        );
      })}
    </>
  );
}

export default function Budget() {
  const c = useTheme();
  const { hide } = useHide();
  const { data, error, refreshing, reload } = useLoad(() => loadBudget(supabase));
  const [month, setMonth] = useState<string | null>(null);
  const [editing, setEditing] = useState<Draft | null>(null);
  // The whole month, or one cutoff of it.
  const [cut, setCut] = useState<'first' | 'second' | null>(null);

  const fut = !!data && month !== null && month !== data.period.month;
  // Which budget the board shows: undefined = the one in force this cutoff, null = the normal one, else a plan's id.
  const [plan, setPlan] = useState<string | null | undefined>(undefined);
  // Making or changing a plan: 'new', the plan being edited, or nothing.
  const [planEdit, setPlanEdit] = useState<'new' | PlanSpan | null>(null);
  const screen = data ? buildBudgetScreen(data, { fut, month, plan }) : null;

  return (
    <Screen
      title="Budget"
      refreshing={refreshing}
      onRefresh={reload}
    >
      {error ? <Notice tone="error">{error}</Notice> : null}
      {!data && !error ? <Notice>Loading…</Notice> : null}

      {data && screen ? (
        <>
          <Card>
            <View style={s.between}>
              <Pressable onPress={() => setMonth(addMonths(screen.month as YearMonth, -1))} accessibilityRole="button" accessibilityLabel="Previous month" style={s.yearBtn}>
                <Text style={{ color: c.ink, fontSize: 20 }}>‹</Text>
              </Pressable>
              <View style={{ alignItems: 'center' }}>
                <Text style={{ color: c.ink, fontFamily: fonts.display, fontSize: 18 }}>{monthLabel(screen.month)}</Text>
                {!fut ? <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 12 }}>this month</Text> : null}
              </View>
              <Pressable onPress={() => setMonth(addMonths(screen.month as YearMonth, 1))} accessibilityRole="button" accessibilityLabel="Next month" style={s.yearBtn}>
                <Text style={{ color: c.ink, fontSize: 20 }}>›</Text>
              </Pressable>
            </View>
          </Card>

          {!screen.hasStart || !screen.shown ? (
            <Notice>No salary on file yet. The budget needs your take-home. Add your salary under Salary and tax first.</Notice>
          ) : (
            <>
              <LinearGradient colors={[c.heroA, c.heroB]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.hero}>
                <Text style={[s.heroLabel, { fontFamily: fonts.bodyBold }]}>
                  LEFT OF TAKE-HOME, {monthLabel(screen.shown.month).toUpperCase()}
                  {screen.shown.assumed ? ' (ASSUMED RAISE)' : ''}
                </Text>
                <Text style={{ color: '#fff', fontFamily: fonts.display, fontSize: 30, lineHeight: 36 }}>
                  {peso(money(Math.max(0, screen.rest)), hide)}
                  <Text style={{ color: '#d3efe6', fontFamily: fonts.bodyBold, fontSize: 18 }}> / {peso(money(screen.takeHome + screen.payrollTotal), hide)}</Text>
                </Text>
                {screen.payrollTotal > 0 ? (
                  <Text style={{ color: '#d3efe6', fontFamily: fonts.body, fontSize: 12 }}>Includes {peso(screen.payrollTotal, hide)} from your payslip</Text>
                ) : null}
                            </LinearGradient>

              {screen.flag === 'over' ? (
                <Notice tone="error">Fixed and percent lines are over take-home in {monthLabel(screen.shown.month)}. Trim a line or move a start date.</Notice>
              ) : screen.flag === 'tight' ? (
                <Notice>
                  Tight month: only {peso(screen.rest, hide)} left after every line.
                </Notice>
              ) : null}

              {!fut ? (
                <Card>
                  <View style={s.between}>
                    <Label>Budget plans</Label>
                    <Pressable onPress={() => setPlanEdit('new')} accessibilityRole="button" style={{ minHeight: 36, justifyContent: 'center' }}>
                      <Text style={{ color: c.accentText, fontFamily: fonts.bodyBold, fontSize: 13 }}>+ New plan</Text>
                    </Pressable>
                  </View>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    <Chip label={`Normal${screen.plan.activeNow === null ? ' · in force' : ''}`} on={screen.plan.selected === null} onPress={() => setPlan(null)} />
                    {screen.plan.list.map((p) => (
                      <Chip key={p.id} label={`${p.name}${screen.plan.activeNow === p.id ? ' · in force' : ''}`} on={screen.plan.selected === p.id} onPress={() => setPlan(p.id)} />
                    ))}
                  </View>
                  <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 12 }}>
                    {(() => {
                      const sel = screen.plan.list.find((p) => p.id === screen.plan.selected);
                      return sel ? `${cutoffRefLabel(sel.from)} to ${cutoffRefLabel(sel.to)}. Changes here only change this plan.` : screen.plan.list.length > 0 ? 'Applies to every cutoff no plan covers.' : 'A plan is a whole budget for a range of cutoffs, such as a trip. It starts as a copy of this one.';
                    })()}
                  </Text>
                  {(() => {
                    const sel = screen.plan.list.find((p) => p.id === screen.plan.selected);
                    return sel ? (
                      <Pressable onPress={() => setPlanEdit(sel)} accessibilityRole="button" style={{ minHeight: 36, justifyContent: 'center' }}>
                        <Text style={{ color: c.accentText, fontFamily: fonts.bodyBold, fontSize: 13 }}>Edit or delete this plan</Text>
                      </Pressable>
                    ) : null;
                  })()}
                </Card>
              ) : null}
              {planEdit ? (
                <PlanSheet
                  plan={planEdit === 'new' ? null : planEdit}
                  thisMonth={data.salary.thisMonth}
                  onClose={() => setPlanEdit(null)}
                  onSaved={(id) => {
                    setPlanEdit(null);
                    setPlan(id ?? null);
                    void reload();
                  }}
                />
              ) : null}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                <Chip label="Whole month" on={cut === null} onPress={() => setCut(null)} />
                <Chip label="1st cutoff" on={cut === 'first'} onPress={() => setCut('first')} />
                <Chip label="2nd cutoff" on={cut === 'second'} onPress={() => setCut('second')} />
              </View>
              <Board
                moved={applyMoves(cut ? groupsForCutoff(screen.groups, cut, screen.shown.pay[cut].takeHome) : screen.groups, screen.moves, cut)}
                groups={withPayroll(
                  applyMoves(cut ? groupsForCutoff(screen.groups, cut, screen.shown.pay[cut].takeHome) : screen.groups, screen.moves, cut).groups,
                  payrollOnLines(screen.shown.pay, screen.groups),
                  cut ? screen.shown.pay[cut].takeHome : screen.takeHome,
                  cut,
                )}
                cut={cut}
                reimbursements={screen.reimbursements}
                onMark={async (input) => {
                  const r = await setReimbursementMark(supabase, input);
                  if ('error' in r) Alert.alert('Reimbursement', r.error);
                  else void reload();
                }}
                data={data}
                payroll={payrollOnLines(screen.shown.pay, screen.groups)}
                onEdit={(l) => setEditing(draftOf(l))}
                onAdd={(cat) => setEditing(blankDraft(cat))}
              />

              {screen.nowRun ? <BudgetSide data={data} nowRun={screen.nowRun} onChanged={() => void reload()} /> : null}

              {screen.topUpRaises.length > 0 ? (
                <Notice>
                  Top-ups come from raises: {screen.topUpRaises.join(', ')}. Change or remove the raise and they follow.
                </Notice>
              ) : null}
            </>
          )}

          {editing ? (
            <LineEditor
              start={editing}
              data={data}
              planId={screen?.plan.selected ?? null}
              onClose={() => setEditing(null)}
              onSaved={() => {
                setEditing(null);
                void reload();
              }}
            />
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}

const s = StyleSheet.create({
  hero: { borderRadius: 14, padding: 18, gap: 8 },
  heroLabel: { color: '#bfe9dc', fontSize: 12, letterSpacing: 0.8 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pill: { backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  seg: { flexDirection: 'row', borderRadius: 999, padding: 4 },
  segBtn: { flex: 1, minHeight: 44, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  yearBtn: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  line: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 56, paddingVertical: 4 },
  add: { minHeight: 44, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  input: { minHeight: 48, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15 },
  two: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  btn: { minHeight: 48, borderRadius: 999, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { maxHeight: '92%', borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1, padding: 16, gap: 12 },
  grab: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2 },
});
