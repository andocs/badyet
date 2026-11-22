import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import type { SalaryEvent, Allowance } from '@/lib/engine/types';
import { loadSalary } from '@/lib/salary/load';
import { eventRows, regularRange, yearOf, yearRows } from '@/lib/salary/view';
import type { YearMonth } from '@/lib/domain/dates';
import { PayslipSheet, AllowanceSheet, EventSheet, ProjectedSheet } from '~/components/SalarySheets';
import { RaiseWizard, type RaiseKind } from '~/components/RaiseWizard';
import { SavingsPlanCard } from '~/components/SavingsPlanCard';
import { salaryAt } from '@/lib/salary/view';
import { SalaryChart } from '~/components/SalaryChart';
import { Amount, Card, Notice, Screen } from '~/components/ui';
import { useHide } from '~/lib/hide';
import { peso } from '~/lib/money';
import { supabase } from '~/lib/supabase';
import { fonts, useTheme } from '~/lib/theme';
import { useLoad } from '~/lib/useLoad';

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const KIND: Record<string, string> = { start: 'Start', merit: 'Merit raise', promotion: 'Promotion', allowance: 'Allowance', adjustment: 'One-off' };

type Open =
  | { kind: 'event'; e: SalaryEvent; delta: number | null }
  | { kind: 'allowance'; a: Allowance }
  | { kind: 'raise'; initial: RaiseKind | null }
  | { kind: 'projected' }
  | { kind: 'payslip' };

export default function Salary() {
  const c = useTheme();
  const { hide } = useHide();
  const { width } = useWindowDimensions();
  const { data, error, refreshing, reload } = useLoad(async () => {
    const [salary, funds] = await Promise.all([
      loadSalary(supabase),
      supabase.from('funds').select('id, name').is('archived_at', null).order('priority'),
    ]);
    return { ...salary, funds: (funds.data ?? []) as { id: string; name: string }[] };
  });
  const [open, setOpen] = useState<Open | null>(null);
  const [yearIdx, setYearIdx] = useState(0);

  const input = data?.input;
  const hasStart = !!input?.events.some((e) => e.kind === 'start');
  const done = () => {
    setOpen(null);
    void reload();
  };
  const row = [s.row];
  const years = data && input ? yearRows(input, Array.from({ length: 6 }, (_, i) => yearOf(data.thisMonth) + i)) : [];
  const cardW = width - 32 - 28; // screen padding and card padding

  return (
    <Screen title="Salary and tax" refreshing={refreshing} onRefresh={reload}>
      {error ? <Notice tone="error">{error}</Notice> : null}
      {!data && !error ? <Notice>Loading…</Notice> : null}
      {data && input && !hasStart ? <Notice>No salary on file yet. Run the setup wizard on the web to set your starting pay.</Notice> : null}

      {data && input && hasStart ? (
        <>
          <SavingsPlanCard
            plan={{ bp: input.settings.savingsPlanBp, amount: input.settings.savingsPlanAmount ?? null, fundId: input.settings.savingsPlanFundId ?? null }}
            funds={data.funds}
            base={salaryAt(input, data.thisMonth).base}
            onSaved={reload}
          />
          <Card>
            <Text style={[s.h2, { color: c.ink, fontFamily: fonts.display }]}>Take-home per cutoff</Text>
            <View style={s.legend}>
              <Legend color={c.accent} text="1st" />
              <Legend color={c.blue} text="2nd" />
              <Legend color={c.muted} dashed text="Assumed" />
            </View>
            <SalaryChart
              range={regularRange(input, data.thisMonth, 60)}
              events={input.events.filter((e) => e.kind !== 'start' && e.kind !== 'adjustment').map((e) => ({ month: e.effectiveMonth, expected: e.status === 'expected' }))}
            />
          </Card>

          <Card>
            <View style={s.between}>
              <Text style={[s.h2, { color: c.ink, fontFamily: fonts.display }]}>Events</Text>
              <SmallBtn label="+ Raise" accent onPress={() => setOpen({ kind: 'raise', initial: null })} />
            </View>
            {eventRows(input).map(({ event: e, delta }) => (
              <Pressable key={e.id} onPress={() => setOpen({ kind: 'event', e, delta })} accessibilityRole="button" style={row}>
                <View style={s.when}>
                  <Text style={{ color: c.ink, fontFamily: fonts.display, fontSize: 14 }}>{MON[Number(e.effectiveMonth.slice(5)) - 1]}</Text>
                  <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 11 }}>{e.effectiveMonth.slice(0, 4)}</Text>
                </View>
                <Text style={{ flex: 1, color: c.ink, fontFamily: fonts.bodyBold, fontSize: 15 }}>
                  {KIND[e.kind] ?? e.kind}
                  {e.kind === 'merit' && e.pctBp != null ? ` +${e.pctBp / 100}%` : ''}
                  {e.status === 'expected' ? <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 12 }}> expected</Text> : null}
                </Text>
                {delta !== null ? <Amount value={delta} signed style={{ color: delta >= 0 ? c.accentText : c.err }} /> : null}
                <Text style={{ color: c.muted, fontSize: 18 }}>›</Text>
              </Pressable>
            ))}
          </Card>

          <Card>
            <View style={s.between}>
              <Text style={[s.h2, { color: c.ink, fontFamily: fonts.display }]}>Allowances</Text>
              <SmallBtn label="+ Add" accent onPress={() => setOpen({ kind: 'raise', initial: 'allowance' })} />
            </View>
            {input.allowances.length === 0 ? <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 14 }}>None yet.</Text> : null}
            {input.allowances.map((al) => (
              <Pressable key={al.id} onPress={() => setOpen({ kind: 'allowance', a: al })} accessibilityRole="button" style={row}>
                <Text style={{ flex: 1, color: c.ink, fontFamily: fonts.bodyBold, fontSize: 15 }}>{al.name}</Text>
                <Amount value={al.amount} />
                <Text style={{ color: c.muted, fontSize: 18 }}>›</Text>
              </Pressable>
            ))}
          </Card>

          <Pressable onPress={() => setOpen({ kind: 'projected' })} accessibilityRole="button">
            <Card>
              <View style={s.between}>
                <Text style={[s.h2, { color: c.ink, fontFamily: fonts.display }]}>Projected raises</Text>
                <Text style={{ color: c.muted, fontFamily: fonts.bodyBold, fontSize: 14 }}>
                  {input.assumptions.assumedRaiseOn ? `${input.assumptions.assumedRaiseBp / 100}% · ${MON[input.assumptions.assumedRaiseMonth - 1]}` : 'Off'} ›
                </Text>
              </View>
            </Card>
          </Pressable>

          <Card>
            <Text style={[s.h2, { color: c.ink, fontFamily: fonts.display }]}>Year by year</Text>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              snapToInterval={cardW + 10}
              decelerationRate="fast"
              onMomentumScrollEnd={(ev) => setYearIdx(Math.round(ev.nativeEvent.contentOffset.x / (cardW + 10)))}
              contentContainerStyle={{ gap: 10 }}
            >
              {years.map((r) => (
                <View key={r.year} style={[s.year, { width: cardW, backgroundColor: c.soft }]}>
                  <View style={s.between}>
                    <Text style={{ color: c.ink, fontFamily: fonts.display, fontSize: 18 }}>
                      {r.year}
                      {r.assumed ? '*' : ''}
                    </Text>
                    <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 12 }}>base {peso(r.base, hide)}</Text>
                  </View>
                  <View style={s.between}>
                    <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 13 }}>1st cutoff</Text>
                    <Amount value={r.first} />
                  </View>
                  <View style={s.between}>
                    <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 13 }}>2nd cutoff</Text>
                    <Amount value={r.second} />
                  </View>
                  <View style={s.between}>
                    <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 12 }}>Tax −{peso(r.tax, hide)}</Text>
                    {r.bonusNet > 0 ? <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 12 }}>Bonuses +{peso(r.bonusNet, hide)}</Text> : null}
                  </View>
                </View>
              ))}
            </ScrollView>
            <View style={s.dots}>
              {years.map((r, i) => (
                <View key={r.year} style={[s.dot, { backgroundColor: i === yearIdx ? c.accent : c.line }]} />
              ))}
            </View>
          </Card>

          <Pressable onPress={() => setOpen({ kind: 'payslip' })} accessibilityRole="button">
            <Card>
              <View style={s.between}>
                <Text style={[s.h2, { color: c.ink, fontFamily: fonts.display }]}>Payslip builder</Text>
                <Text style={{ color: c.muted, fontSize: 18 }}>›</Text>
              </View>
            </Card>
          </Pressable>
        </>
      ) : null}

      {data && input && open?.kind === 'event' ? <EventSheet e={open.e} delta={open.delta} onClose={() => setOpen(null)} onSaved={done} /> : null}
      {data && input && open?.kind === 'allowance' ? <AllowanceSheet a={open.a} onClose={() => setOpen(null)} onSaved={done} /> : null}
      {data && input && open?.kind === 'raise' ? (
        <RaiseWizard input={input} thisMonth={data.thisMonth as YearMonth} placeable={data.placeable} initialKind={open.initial} onClose={() => setOpen(null)} onSaved={done} />
      ) : null}
      {data && input && open?.kind === 'projected' ? (
        <ProjectedSheet on={input.assumptions.assumedRaiseOn} pctBp={input.assumptions.assumedRaiseBp} month={input.assumptions.assumedRaiseMonth} onClose={() => setOpen(null)} onSaved={done} />
      ) : null}
      {data && input && open?.kind === 'payslip' ? <PayslipSheet input={input} thisMonth={data.thisMonth as YearMonth} onClose={() => setOpen(null)} onSaved={done} /> : null}
    </Screen>
  );
}

function Legend({ color, text, dashed }: { color: string; text: string; dashed?: boolean }) {
  const c = useTheme();
  return (
    <View style={s.legendItem}>
      <View style={dashed ? { width: 16, borderTopWidth: 2, borderStyle: 'dashed', borderColor: color } : { width: 10, height: 10, borderRadius: 5, backgroundColor: color }} />
      <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 12 }}>{text}</Text>
    </View>
  );
}

function SmallBtn({ label: text, onPress, accent }: { label: string; onPress: () => void; accent?: boolean }) {
  const c = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={[s.small, { backgroundColor: accent ? c.accent : c.soft }]}>
      <Text style={{ color: accent ? c.onAccent : c.ink, fontFamily: fonts.bodyBold, fontSize: 13 }}>{text}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  h2: { fontSize: 16 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52 },
  when: { width: 44, alignItems: 'center' },
  small: { minHeight: 36, borderRadius: 999, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  year: { borderRadius: 10, padding: 12, gap: 6 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3 },
});
