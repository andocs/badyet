import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { money } from '@/lib/domain/money';
import { loadSalary } from '@/lib/salary/load';
import { eventRows, regularRange, yearOf, yearRows } from '@/lib/salary/view';
import type { YearMonth } from '@/lib/domain/dates';
import { SalaryChart } from '~/components/SalaryChart';
import { Amount, Body, Card, Chip, Label, Notice, Screen } from '~/components/ui';
import { useHide } from '~/lib/hide';
import { peso } from '~/lib/money';
import { confirmEvent, deleteAllowance, deleteEvent, saveAssumptions, setAllowance, type Result } from '~/lib/salaryWrite';
import { supabase } from '~/lib/supabase';
import { fonts, useTheme } from '~/lib/theme';
import { useLoad } from '~/lib/useLoad';

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const label = (m: YearMonth) => `${MON[Number(m.slice(5)) - 1]} ${m.slice(0, 4)}`;
const KIND: Record<string, string> = { start: 'Start', merit: 'Merit raise', promotion: 'Promotion', allowance: 'Allowance change', adjustment: 'One-off adjustment' };

export default function Salary() {
  const c = useTheme();
  const router = useRouter();
  const { hide } = useHide();
  const { data, error, refreshing, reload } = useLoad(() => loadSalary(supabase));
  const [problem, setProblem] = useState<string | null>(null);

  async function act(run: () => Promise<Result>) {
    setProblem(null);
    const r = await run();
    if ('error' in r) setProblem(r.error);
    else await reload();
  }
  const ask = (title: string, message: string, onYes: () => void) =>
    Alert.alert(title, message, [{ text: 'Cancel', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: onYes }]);

  const input = data?.input;
  const hasStart = !!input?.events.some((e) => e.kind === 'start');

  return (
    <Screen title="Salary and tax" subtitle="Your pay timeline and allowances. The budget and forecast read from here." refreshing={refreshing} onRefresh={reload}>
      <Pressable onPress={() => router.back()} accessibilityRole="link" style={{ minHeight: 44, justifyContent: 'center' }}>
        <Text style={{ color: c.accentText, fontFamily: fonts.bodyBold, fontSize: 14 }}>‹ Plan</Text>
      </Pressable>
      {error ? <Notice tone="error">{error}</Notice> : null}
      {problem ? <Notice tone="error">{problem}</Notice> : null}
      {!data && !error ? <Notice>Loading…</Notice> : null}

      {data && input && !hasStart ? <Notice>No salary on file yet. Run the setup wizard on the web to set your starting pay.</Notice> : null}

      {data && input && hasStart ? (
        <>
          <Card>
            <Text style={[s.h2, { color: c.ink, fontFamily: fonts.display }]}>Regular take-home per cutoff</Text>
            <View style={s.legend}>
              <LegendItem color={c.accent} text="1st cutoff" />
              <LegendItem color={c.blue} text="2nd cutoff" />
              <LegendItem color={c.muted} dashed text="Assumed raises" />
            </View>
            <SalaryChart
              range={regularRange(input, data.thisMonth, 60)}
              events={input.events.filter((e) => e.kind !== 'start' && e.kind !== 'adjustment').map((e) => ({ month: e.effectiveMonth, expected: e.status === 'expected' }))}
            />
            <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 12 }}>Hollow marker = a raise you expect but have not confirmed. Past the last event, the projected raise takes over.</Text>
          </Card>

          <Card>
            <Text style={[s.h2, { color: c.ink, fontFamily: fonts.display }]}>Events</Text>
            {eventRows(input).map(({ event: e, delta }) => (
              <View key={e.id} style={s.event}>
                <View style={s.when}>
                  <Text style={{ color: c.ink, fontFamily: fonts.display, fontSize: 15 }}>{MON[Number(e.effectiveMonth.slice(5)) - 1]}</Text>
                  <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 11 }}>{e.effectiveMonth.slice(0, 4)}</Text>
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <View style={s.row}>
                    <Body bold>{KIND[e.kind] ?? e.kind}</Body>
                    {e.status === 'expected' ? (
                      <View style={[s.pill, { backgroundColor: c.soft }]}>
                        <Text style={{ color: c.muted, fontFamily: fonts.bodyBold, fontSize: 11 }}>expected</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 13 }}>
                    {e.kind === 'merit' && e.pctBp != null ? `+${e.pctBp / 100}%` : ''}
                    {e.newBase != null ? `${e.kind === 'merit' ? ' → ' : ''}base ${peso(e.newBase, hide)} a month` : ''}
                    {e.kind === 'promotion' && e.newBase == null ? 'Promotion' : ''}
                    {e.kind === 'adjustment' && e.oneOffAmount != null ? `${peso(e.oneOffAmount, hide)} once${e.oneOffTaxable ? ', taxed' : ''}` : ''}
                    {e.kind === 'allowance' ? 'A new allowance (see Recurring allowances)' : ''}
                  </Text>
                  {e.status === 'expected' || e.kind !== 'start' ? (
                    <View style={s.row}>
                      {e.status === 'expected' ? <SmallBtn label="Confirm" onPress={() => act(() => confirmEvent(supabase, e.id))} /> : null}
                      {e.kind !== 'start' ? <SmallBtn label="Remove" onPress={() => ask('Remove this event?', 'Its top-ups on the budget go with it.', () => act(() => deleteEvent(supabase, e.id)))} /> : null}
                    </View>
                  ) : null}
                </View>
                {delta !== null ? (
                  <View style={{ alignItems: 'flex-end' }}>
                    <Amount value={delta} signed style={{ color: delta >= 0 ? c.accentText : c.err }} />
                    <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 11 }}>a month</Text>
                  </View>
                ) : (
                  <View style={[s.pill, { backgroundColor: c.soft }]}>
                    <Text style={{ color: c.muted, fontFamily: fonts.bodyBold, fontSize: 11 }}>{e.kind === 'start' ? 'start' : 'once'}</Text>
                  </View>
                )}
              </View>
            ))}
            <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 12 }}>Adding a raise with the wizard, and the payslip builder, are on the web for now.</Text>
          </Card>

          <Card>
            <Text style={[s.h2, { color: c.ink, fontFamily: fonts.display }]}>Recurring allowances</Text>
            {input.allowances.length === 0 ? <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 14 }}>No allowances yet.</Text> : null}
            {input.allowances.map((al) => (
              <View key={al.id} style={{ gap: 6 }}>
                <Body bold>{al.name}</Body>
                <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 13 }}>
                  {peso(al.amount, hide)} · {al.frequency === 'monthly' ? 'every month' : `once a year, in ${MON[(al.payMonth ?? 1) - 1]}`} · from {label(al.startsOn)}
                  {al.endsOn ? ` to ${label(al.endsOn)}` : ''} · {al.taxable ? 'taxed' : 'not taxed'}
                </Text>
                <View style={s.row}>
                  <Label>On the payslip of</Label>
                  <Chip label="1st" on={al.payslipCutoff === 'first'} onPress={() => act(() => setAllowance(supabase, al.id, { cutoff: 'first' }))} />
                  <Chip label="2nd" on={al.payslipCutoff === 'second'} onPress={() => act(() => setAllowance(supabase, al.id, { cutoff: 'second' }))} />
                  <SmallBtn label="Remove" onPress={() => ask(`Remove ${al.name}?`, 'It stops adding to your pay.', () => act(() => deleteAllowance(supabase, al.id)))} />
                </View>
              </View>
            ))}
            <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 12 }}>To change whether one is taxed, remove it and add it again on the web.</Text>
          </Card>

          <ProjectedRaises
            on={input.assumptions.assumedRaiseOn}
            pctBp={input.assumptions.assumedRaiseBp}
            month={input.assumptions.assumedRaiseMonth}
            onSave={(v) => act(() => saveAssumptions(supabase, v))}
          />

          <Card>
            <Text style={[s.h2, { color: c.ink, fontFamily: fonts.display }]}>Year by year</Text>
            {yearRows(input, Array.from({ length: 6 }, (_, i) => yearOf(data.thisMonth) + i)).map((r) => (
              <View key={r.year} style={[s.year, { borderTopColor: c.line }]}>
                <View style={s.between}>
                  <Text style={{ color: c.ink, fontFamily: fonts.display, fontSize: 16 }}>
                    {r.year}
                    {r.assumed ? '  (assumed raise)' : ''}
                  </Text>
                  <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 12 }}>base {peso(r.base, hide)} / mo</Text>
                </View>
                <View style={s.between}>
                  <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 13 }}>1st cutoff</Text>
                  <Amount value={r.first} />
                </View>
                <View style={s.between}>
                  <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 13 }}>2nd cutoff</Text>
                  <Amount value={r.second} />
                </View>
                <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 12 }}>
                  Allowances {r.allowances > 0 ? peso(r.allowances, hide) : '—'} · contributions −{peso(r.contributions, hide)} · tax −{peso(r.tax, hide)}
                  {r.bonusNet > 0 ? ` · bonuses +${peso(r.bonusNet, hide)} net` : ''}
                </Text>
              </View>
            ))}
            <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 12 }}>Regular pay is December of each year. Bonuses are after tax. The current year shows the whole year.</Text>
          </Card>
        </>
      ) : null}
    </Screen>
  );
}

function LegendItem({ color, text, dashed }: { color: string; text: string; dashed?: boolean }) {
  const c = useTheme();
  return (
    <View style={s.row}>
      <View style={dashed ? { width: 16, borderTopWidth: 2, borderStyle: 'dashed', borderColor: color } : { width: 10, height: 10, borderRadius: 5, backgroundColor: color }} />
      <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 13 }}>{text}</Text>
    </View>
  );
}

function SmallBtn({ label: text, onPress }: { label: string; onPress: () => void }) {
  const c = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={[s.small, { backgroundColor: c.soft }]}>
      <Text style={{ color: c.ink, fontFamily: fonts.bodyBold, fontSize: 13 }}>{text}</Text>
    </Pressable>
  );
}

/** The "Assume a raise every year" card: on or off, the percent, and the month. Only used after your last dated event. */
function ProjectedRaises({ on: onIn, pctBp, month: monthIn, onSave }: { on: boolean; pctBp: number; month: number; onSave: (v: { on: boolean; pctBp: number; month: number }) => void }) {
  const c = useTheme();
  const [on, setOn] = useState(onIn);
  const [pct, setPct] = useState(String(pctBp / 100));
  const [month, setMonth] = useState(monthIn);
  return (
    <Card>
      <Text style={[s.h2, { color: c.ink, fontFamily: fonts.display }]}>Projected raises</Text>
      <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 13 }}>Used only after your last dated event, and drawn dashed everywhere.</Text>
      <View style={s.between}>
        <Text style={{ color: c.ink, fontFamily: fonts.body, fontSize: 15, flex: 1 }}>Assume a raise every year</Text>
        <Switch value={on} onValueChange={setOn} trackColor={{ true: c.accent, false: c.line }} thumbColor={c.ink} accessibilityLabel="Assume a raise every year" />
      </View>
      {on ? (
        <>
          <Label>Percent</Label>
          <TextInput value={pct} onChangeText={setPct} keyboardType="decimal-pad" placeholder="5" placeholderTextColor={c.muted} style={[s.input, { color: c.ink, backgroundColor: c.soft, fontFamily: fonts.body }]} />
          <Label>Month it lands</Label>
          <View style={s.chips}>
            {MON.map((m, i) => (
              <Chip key={m} label={m} on={month === i + 1} onPress={() => setMonth(i + 1)} />
            ))}
          </View>
        </>
      ) : null}
      <Pressable
        onPress={() => onSave({ on, pctBp: Math.round(Number(pct) * 100), month })}
        accessibilityRole="button"
        style={[s.btn, { backgroundColor: c.accent }]}
      >
        <Text style={{ color: c.onAccent, fontFamily: fonts.bodyBold, fontSize: 15 }}>Save</Text>
      </Pressable>
    </Card>
  );
}

const s = StyleSheet.create({
  h2: { fontSize: 18 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  event: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 8 },
  when: { width: 44, alignItems: 'center' },
  pill: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  small: { minHeight: 36, borderRadius: 999, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  year: { borderTopWidth: 1, paddingTop: 10, gap: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  input: { minHeight: 48, borderRadius: 10, paddingHorizontal: 14, fontSize: 15 },
  btn: { minHeight: 48, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
});
