import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { money, sum } from '@/lib/domain/money';
import { runProjection } from '@/lib/engine/projection';
import { forecastInput, forecastRows, savedThisMonth, totalBalance, yearEnds, type ForecastRow } from '@/lib/funds/forecast';
import { loadFunds, type FundsData } from '@/lib/funds/load';
import { ForecastChart, type FundMeta } from '~/components/ForecastChart';
import { BulkSheet, OverrideSheet } from '~/components/FundSheets';
import { Amount, Body, Card, Chip, Notice, Screen } from '~/components/ui';
import { useHide } from '~/lib/hide';
import { peso } from '~/lib/money';
import { supabase } from '~/lib/supabase';
import { fonts, useTheme } from '~/lib/theme';
import { useLoad } from '~/lib/useLoad';

const PALETTE = ['#34D399', '#7FA8FF', '#F6C453', '#C4A0FF', '#5CD0E6', '#F28BC8'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const label = (m: string) => `${MON[Number(m.slice(5)) - 1]} ${m.slice(0, 4)}`;
const WHY = (r: string) =>
  r.startsWith('priority') ? `Priority ${r.slice(9)}` : r === 'cap hit' ? 'Cap reached' : r === 'pool ran out' ? 'Pool ran out' : r === 'takes the rest' ? 'Takes the rest' : r === 'pinned' ? 'Pinned' : r === 'skipped' ? 'Skipped' : r;

function MonthSheet({ row, funds, onClose, onChange }: { row: ForecastRow; funds: FundMeta[]; onClose: () => void; onChange: () => void }) {
  const c = useTheme();
  const { hide } = useHide();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={s.scrim} onPress={onClose} accessibilityLabel="Close" />
      <View style={[s.sheet, { backgroundColor: c.surface, borderColor: c.line, paddingBottom: insets.bottom + 16 }]}>
        <View style={[s.grab, { backgroundColor: c.line }]} />
        <ScrollView contentContainerStyle={{ gap: 10 }}>
          <View>
            <Text style={{ color: c.ink, fontFamily: fonts.display, fontSize: 20 }}>{label(row.month)}</Text>
            <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 12 }}>{row.override ? 'Overridden month' : 'Following the default order'}</Text>
          </View>
          <View style={s.chips}>
            <Pill text={`Pool ${peso(row.pool, hide)}`} />
            {row.bonuses.map((b) => (
              <Pill key={b.name} text={`${b.name} ${peso(b.net, hide)}`} good />
            ))}
            {row.assumed ? <Pill text="assumed raise" /> : null}
            {row.expected ? <Pill text="expected raise" /> : null}
          </View>
          {funds.map((f) => {
            const cell = row.funds[f.id];
            if (!cell) return null;
            return (
              <View key={f.id} style={[s.between, { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: c.line }]}>
                <View style={{ flex: 1 }}>
                  <View style={s.row}>
                    <View style={[s.dot, { backgroundColor: f.color }]} />
                    <Body bold>{f.name}</Body>
                  </View>
                  <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 12 }}>{cell.reasons.map(WHY).join(' · ') || 'Nothing this month'}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Amount value={money(cell.amount + cell.bonus)} />
                  <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 12 }}>balance {peso(cell.balance, hide)}</Text>
                </View>
              </View>
            );
          })}
          {row.unplaced > 50 ? (
              <View style={s.between}>
                <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 13 }}>Pool not placed (every fund is full)</Text>
                <Amount value={row.unplaced} />
              </View>
            ) : null}
          <Pressable onPress={onChange} accessibilityRole="button" style={[s.btn, { backgroundColor: c.accent }]}>
            <Text style={{ color: c.onAccent, fontFamily: fonts.bodyBold, fontSize: 15 }}>Change this month</Text>
          </Pressable>
          <Pressable onPress={onClose} accessibilityRole="button" style={[s.btn, { backgroundColor: c.soft }]}>
            <Text style={{ color: c.ink, fontFamily: fonts.bodyBold, fontSize: 15 }}>Close</Text>
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
}

function Pill({ text, good }: { text: string; good?: boolean }) {
  const c = useTheme();
  return (
    <View style={[s.pill, { backgroundColor: good ? c.tint : c.soft }]}>
      <Text style={{ color: good ? c.accentText : c.muted, fontFamily: fonts.bodyBold, fontSize: 12 }}>{text}</Text>
    </View>
  );
}

function build(d: FundsData) {
  const start = d.budget.salary.thisMonth;
  const input = forecastInput(d, start, 60);
  const run = runProjection(input, { includeExpected: true });
  const hasExpected = run.some((m) => m.expected);
  const without = hasExpected ? runProjection(input, { includeExpected: false }) : null;
  return {
    rows: forecastRows(run, new Set(d.overrides.map((o) => o.month))),
    withoutTotal: without ? totalBalance(forecastRows(without, new Set())[59]!) : null,
  };
}

export default function Forecast() {
  const c = useTheme();
  const { hide } = useHide();
  const { data, error, refreshing, reload } = useLoad(() => loadFunds(supabase));
  const [view, setView] = useState<'chart' | 'years'>('chart');
  const [stacked, setStacked] = useState(true);
  const [vis, setVis] = useState<Set<string> | null>(null);
  const [year, setYear] = useState<number | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [bulk, setBulk] = useState(false);

  const hasStart = !!data?.budget.salary.input.events.some((e) => e.kind === 'start');
  const ready = !!data && hasStart && data.funds.length > 0;
  const built = ready ? build(data) : null;
  const rows = built?.rows ?? [];
  const funds: FundMeta[] = data ? data.funds.map((f, i) => ({ id: f.id, name: f.name, color: data.colors.get(f.id) ?? PALETTE[i % PALETTE.length]! })) : [];
  const shownIds = vis ?? new Set(funds.map((f) => f.id));
  const shown = funds.filter((f) => shownIds.has(f.id));
  const last = rows[rows.length - 1];
  const total = last ? totalBalance(last) : money(0);
  const startTotal = data ? sum(data.funds.map((f) => data.fundStart[f.id] ?? money(0))) : money(0);
  const years = [...new Set(rows.map((r) => r.year))];
  const shownYear = year ?? rows[Math.min(11, rows.length - 1)]?.year ?? new Date().getFullYear();
  const row = sel ? (rows.find((r) => r.month === sel) ?? null) : null;
  const name = new Map((data?.funds ?? []).map((f) => [f.id, f.name]));

  const toggle = (id: string) => {
    setVis((v) => {
      const cur = v ?? new Set(funds.map((f) => f.id));
      if (cur.size === funds.length) return new Set([id]);
      const n = new Set(cur);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n.size ? n : null;
    });
  };

  return (
    <Screen title="Forecast" refreshing={refreshing} onRefresh={reload}>
      {error ? <Notice tone="error">{error}</Notice> : null}
      {!data && !error ? <Notice>Loading…</Notice> : null}
      {data && !hasStart ? <Notice>The forecast needs your salary. Add it under Salary and tax.</Notice> : null}
      {data && hasStart && data.funds.length === 0 ? <Notice>The forecast needs at least one fund to fill from your savings pool. Add one on the web.</Notice> : null}

      {ready && last ? (
        <>
          <View style={[s.seg, { backgroundColor: c.soft }]}>
            {(['chart', 'years'] as const).map((v) => (
              <Pressable key={v} onPress={() => setView(v)} accessibilityRole="tab" accessibilityState={{ selected: view === v }} style={[s.segBtn, view === v && { backgroundColor: c.surface }]}>
                <Text style={{ color: view === v ? c.ink : c.muted, fontFamily: fonts.bodyBold, fontSize: 14 }}>{v === 'chart' ? 'Chart' : 'Year by year'}</Text>
              </Pressable>
            ))}
          </View>

          <LinearGradient colors={[c.heroA, c.heroB]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.hero}>
            <Text style={[s.heroLabel, { fontFamily: fonts.bodyBold }]}>{label(last.month).toUpperCase()}, ALL MY FUNDS TOGETHER</Text>
            <Amount value={total} style={{ color: '#fff', fontFamily: fonts.display, fontSize: 36, lineHeight: 42 }} />
            <Text style={{ color: '#d3efe6', fontFamily: fonts.body, fontSize: 14 }}>
              up {peso(money(total - startTotal), hide)} from {peso(startTotal, hide)} today
            </Text>
            {built?.withoutTotal != null && Math.abs(total - built.withoutTotal) > 50 ? (
              <Text style={{ color: '#fff', fontFamily: fonts.body, fontSize: 13 }}>
                Without your expected raises: {peso(money(built.withoutTotal), hide)} ({peso(money(built.withoutTotal - total), hide)}).
              </Text>
            ) : null}
            {funds.map((f) => (
              <View key={f.id} style={s.between}>
                <Text style={{ color: '#B9C9DD', fontFamily: fonts.body, fontSize: 13 }}>{f.name}</Text>
                <Text style={{ color: '#fff', fontFamily: fonts.bodyBold, fontSize: 14 }}>{peso(last.funds[f.id]?.balance ?? money(0), hide)}</Text>
              </View>
            ))}
          </LinearGradient>

          {view === 'chart' ? (
            <Card>
              <View style={s.between}>
                <Text style={[s.h2, { color: c.ink, fontFamily: fonts.display }]}>Fund balances</Text>
                <View style={s.chips}>
                  <Chip label="Stacked" on={stacked} onPress={() => setStacked(true)} />
                  <Chip label="Lines" on={!stacked} onPress={() => setStacked(false)} />
                </View>
              </View>
              <View style={s.chips}>
                <Chip label="All funds" on={shownIds.size === funds.length} onPress={() => setVis(null)} />
                {funds.map((f) => (
                  <Chip key={f.id} label={f.name} on={shownIds.has(f.id)} onPress={() => toggle(f.id)} />
                ))}
              </View>
              <ForecastChart rows={rows} funds={shown} stacked={stacked} onPick={setSel} sel={sel} />
              <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 12 }}>▼ marks a month with an override.</Text>
              
            </Card>
          ) : (
            <>
              <Text style={[s.h2, { color: c.ink, fontFamily: fonts.display }]}>Year by year</Text>
              {yearEnds(rows).map((e) => {
                const t = totalBalance(e);
                return (
                  <Pressable key={e.year} onPress={() => setYear(e.year)} accessibilityRole="button" accessibilityState={{ expanded: e.year === shownYear }}>
                    <Card style={e.year === shownYear ? { borderColor: c.accent } : undefined}>
                      <View style={s.between}>
                        <View>
                          <Text style={{ color: c.ink, fontFamily: fonts.display, fontSize: 18 }}>
                            {e.year}
                            {e.assumed ? '*' : ''}
                          </Text>
                          <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 12 }}>end of year</Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Amount value={t} style={{ fontFamily: fonts.display, fontSize: 18 }} />
                          <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 12 }}>{peso(e.take, hide)} take-home a month</Text>
                        </View>
                      </View>
                      <View style={s.stack}>
                        {[...funds].reverse().map((f) => (
                          <View key={f.id} style={{ width: `${t > 0 ? ((e.funds[f.id]?.balance ?? 0) / t) * 100 : 0}%`, backgroundColor: f.color }} />
                        ))}
                      </View>
                    </Card>
                  </Pressable>
                );
              })}

              <Card>
                <Text style={[s.h2, { color: c.ink, fontFamily: fonts.display }]}>{shownYear} month by month</Text>
                <View style={s.grid}>
                  {rows
                    .filter((r) => r.year === shownYear)
                    .map((r) => {
                      const parts = funds.map((f) => savedThisMonth(r, f.id));
                      const tt = parts.reduce((a, b) => a + b, 0) || 1;
                      return (
                        <Pressable key={r.month} onPress={() => setSel(r.month)} accessibilityRole="button" accessibilityLabel={`${label(r.month)}${r.override ? ', overridden' : ''}`} style={[s.month, { backgroundColor: c.soft, borderColor: r.override ? c.ink : 'transparent' }]}>
                          <Text style={{ color: c.ink, fontFamily: fonts.bodyBold, fontSize: 13 }}>
                            {MON[Number(r.month.slice(5)) - 1]}
                            {r.bonuses.length ? ' 🎁' : ''}
                          </Text>
                          <Amount value={money(parts.reduce((a, b) => a + b, 0))} style={{ fontSize: 13 }} />
                          <View style={s.stackSm}>
                            {funds.map((f, i) => (
                              <View key={f.id} style={{ width: `${(parts[i]! / tt) * 100}%`, backgroundColor: f.color }} />
                            ))}
                          </View>
                          <Text style={{ color: r.tight ? c.gold : c.muted, fontFamily: fonts.body, fontSize: 10 }}>
                            {[r.override ? 'changed' : null, r.tight ? 'tight' : null, r.assumed ? 'assumed' : null].filter(Boolean).join(' · ')}
                          </Text>
                        </Pressable>
                      );
                    })}
                </View>
                </Card>
              <View style={s.chips}>
                {years.map((y) => (
                  <Chip key={y} label={String(y)} on={y === shownYear} onPress={() => setYear(y)} />
                ))}
              </View>
            </>
          )}

          <Card>
            <View style={s.between}>
              <Text style={[s.h2, { color: c.ink, fontFamily: fonts.display }]}>Months that differ</Text>
              <Pressable onPress={() => setBulk(true)} accessibilityRole="button" style={[s.btn, { backgroundColor: c.soft, minHeight: 36, paddingHorizontal: 14 }]}>
                <Text style={{ color: c.ink, fontFamily: fonts.bodyBold, fontSize: 13 }}>Change many</Text>
              </Pressable>
            </View>
            <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 13 }}>Months you changed from the default order.</Text>
            {data!.overrides.length === 0 ? <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 14 }}>None. Every month follows the default.</Text> : null}
            {[...data!.overrides].sort((a, b) => a.month.localeCompare(b.month)).map((o) => {
              const what = [
                o.order && o.order.length ? `New order (${name.get(o.order[0]!) ?? 'a fund'} first)` : '',
                Object.keys(o.pins ?? {}).length ? `Pinned ${Object.entries(o.pins ?? {}).map(([id, a]) => `${name.get(id) ?? 'fund'} ${peso(money(a as number), hide)}`).join(', ')}` : '',
                (o.skips ?? []).length ? `Skipped ${(o.skips ?? []).map((id) => name.get(id) ?? 'fund').join(', ')}` : '',
              ].filter(Boolean).join(' · ');
              const note = data!.notes.get(o.month);
              return (
                <Pressable key={o.month} onPress={() => setSel(o.month)} accessibilityRole="button" style={{ paddingVertical: 6 }}>
                  <Body bold>
                    {label(o.month)}
                    {note ? ` · ${note}` : ''}
                  </Body>
                  <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 13 }}>{what}</Text>
                </Pressable>
              );
            })}
          </Card>
        </>
      ) : null}

      {row && !editing ? <MonthSheet row={row} funds={funds} onClose={() => setSel(null)} onChange={() => setEditing(row.month)} /> : null}
      {data && editing && rows.find((r) => r.month === editing) ? (
        <OverrideSheet
          row={rows.find((r) => r.month === editing)!}
          funds={data.funds.map((f) => ({ id: f.id, name: f.name }))}
          order={data.overrides.find((o) => o.month === editing)?.order ?? null}
          pins={Object.fromEntries(Object.entries(data.overrides.find((o) => o.month === editing)?.pins ?? {}).map(([k, v]) => [k, v as number]))}
          skips={data.overrides.find((o) => o.month === editing)?.skips ?? []}
          note={data.notes.get(editing) ?? ''}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            setSel(null);
            void reload();
          }}
        />
      ) : null}
      {data && bulk ? (
        <BulkSheet
          months={rows.filter((r) => r.year === shownYear).map((r) => r.month)}
          funds={data.funds.map((f) => ({ id: f.id, name: f.name }))}
          onClose={() => setBulk(false)}
          onSaved={() => {
            setBulk(false);
            void reload();
          }}
        />
      ) : null}
    </Screen>
  );
}

const s = StyleSheet.create({
  hero: { borderRadius: 14, padding: 18, gap: 6 },
  heroLabel: { color: '#bfe9dc', fontSize: 12, letterSpacing: 0.8 },
  h2: { fontSize: 18 },
  seg: { flexDirection: 'row', borderRadius: 999, padding: 4 },
  segBtn: { flex: 1, minHeight: 44, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  pill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  stack: { flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', backgroundColor: 'rgba(128,128,128,0.2)' },
  stackSm: { flexDirection: 'row', height: 5, borderRadius: 3, overflow: 'hidden', backgroundColor: 'rgba(128,128,128,0.2)', marginVertical: 3 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  month: { flexBasis: '30%', flexGrow: 1, borderRadius: 10, borderWidth: 1.5, padding: 8, gap: 2, minHeight: 84 },
  btn: { minHeight: 48, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { maxHeight: '85%', borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1, padding: 16, gap: 12 },
  grab: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2 },
});
