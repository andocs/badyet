import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { destColors, destKey } from '@/lib/bonuses/colors';
import { loadBonuses } from '@/lib/bonuses/load';
import { bonusCards, yearSummary, type BonusCard } from '@/lib/bonuses/view';
import { money } from '@/lib/domain/money';
import { EXEMPTION_CAP } from '@/lib/windfall/compute';
import { Amount, Body, Card, Chip, Notice, Screen } from '~/components/ui';
import { saveInstance } from '~/lib/bonusesWrite';
import { useHide } from '~/lib/hide';
import { peso } from '~/lib/money';
import { supabase } from '~/lib/supabase';
import { fonts, useTheme } from '~/lib/theme';
import { useLoad } from '~/lib/useLoad';

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const ymLabel = (m: string) => `${MON[Number(m.slice(5)) - 1]} ${m.slice(0, 4)}`;

function Row({ left, right, hint, strong }: { left: string; right: React.ReactNode; hint?: string; strong?: boolean }) {
  const c = useTheme();
  return (
    <View style={s.between}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: strong ? c.ink : c.ink, fontFamily: strong ? fonts.bodyBold : fonts.body, fontSize: 15 }}>{left}</Text>
        {hint ? <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 12 }}>{hint}</Text> : null}
      </View>
      {right}
    </View>
  );
}

function CardView({
  card, colors, baseMultiplier, onSave,
}: {
  card: BonusCard;
  colors: Record<string, string>;
  baseMultiplier: number;
  onSave: (card: BonusCard, patch: { multiplierNum?: number | null; doneIndex?: number }) => void;
}) {
  const c = useTheme();
  const { hide } = useHide();
  const [open, setOpen] = useState(card.status !== 'received');
  const received = card.status === 'received';
  const usedBefore = EXEMPTION_CAP - card.roomBefore + card.exempt;
  const mult = card.multiplierNum ?? baseMultiplier;
  const picks = [['Low ×0.5', 0.5], ['Base ×1.0', 1], ['High ×1.5', 1.5]] as const;
  const placed = card.dests.reduce((t, d) => t + d.amount, 0);
  const left = card.net - placed;
  const allPlaced = Math.abs(left) < 50;

  return (
    <Card>
      <Pressable onPress={() => setOpen((o) => !o)} accessibilityRole="button" accessibilityState={{ expanded: open }} style={s.between}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: c.ink, fontFamily: fonts.display, fontSize: 17 }}>{card.name}</Text>
          <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 12 }}>
            {ymLabel(card.month)} · {received ? 'received' : `lands in the ${card.cutoff === 'first' ? '1st' : '2nd'} cutoff · ${card.recurrence === 'once' ? 'one-off' : 'yearly'} · planned`}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Amount value={card.net} style={{ fontSize: 16 }} />
          <Text style={{ color: allPlaced ? c.accentText : c.gold, fontFamily: fonts.bodyBold, fontSize: 11 }}>{allPlaced ? 'All placed' : 'Not placed'}</Text>
        </View>
      </Pressable>

      {open ? (
        <>
          {card.kind === 'cip' && !received ? (
            <View style={{ gap: 6 }}>
              <Text style={{ color: c.muted, fontFamily: fonts.bodyBold, fontSize: 12 }}>MULTIPLIER</Text>
              <View style={s.chips}>
                {picks.map(([label, f]) => {
                  const value = Math.max(1, Math.round(baseMultiplier * f));
                  return <Chip key={label} label={label} on={mult === value} onPress={() => onSave(card, { multiplierNum: value })} />;
                })}
              </View>
            </View>
          ) : null}

          <Row left="Gross" hint={card.kind === 'cip' ? 'Eligible earnings × your component × the multiplier' : card.kind === 'thirteenth' ? '1 month of base' : 'As planned'} right={<Amount value={card.gross} />} />
          <Row left="De minimis" hint={card.kind === 'thirteenth' ? 'None for the 13th month' : 'Tax-free slice for this bonus'} right={<Text style={{ color: c.ink, fontFamily: fonts.bodyBold, fontSize: 15 }}>− {peso(card.deMinimis, hide)}</Text>} />
          <Row
            left="Counts toward the cap"
            hint={`Room before this one: ${peso(card.roomBefore, hide)} of ${peso(money(EXEMPTION_CAP), hide)}`}
            right={<Amount value={card.exempt} />}
          />
          <View style={[s.track, { backgroundColor: c.soft }]}>
            <View style={{ width: `${Math.min(100, (usedBefore / EXEMPTION_CAP) * 100)}%`, height: 6, borderRadius: 3, backgroundColor: card.over > 0 ? c.gold : c.accent }} />
          </View>
          <Row
            left="Over the cap, taxed"
            hint={card.over > 0 ? `${peso(card.over, hide)} goes past the cap` : 'Nothing goes past the cap'}
            right={<Text style={{ color: card.tax ? c.gold : c.ink, fontFamily: fonts.bodyBold, fontSize: 15 }}>− {peso(card.tax, hide)}</Text>}
          />
          <View style={[s.between, { borderTopWidth: 1, borderTopColor: c.line, paddingTop: 8 }]}>
            <Body bold>Net to you</Body>
            <Amount value={card.net} style={{ color: c.accentText }} />
          </View>
          {received && card.plannedNet !== null ? (
            <Text style={{ color: card.net >= card.plannedNet ? c.accentText : c.gold, fontFamily: fonts.body, fontSize: 13 }}>
              Planned {peso(card.plannedNet, hide)} · got {peso(card.net, hide)} ({peso(money(card.net - card.plannedNet), hide)})
            </Text>
          ) : null}

          <Text style={{ color: c.ink, fontFamily: fonts.display, fontSize: 16, marginTop: 6 }}>{received ? 'Where it went' : 'Where it goes'}</Text>
          {card.dests.length === 0 ? <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 14 }}>Nothing placed yet.</Text> : null}
          {card.dests.map((d, i) => (
            <Pressable
              key={`${destKey(d)}-${i}`}
              disabled={received}
              onPress={() => onSave(card, { doneIndex: i })}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: d.done, disabled: received }}
              accessibilityLabel={`Mark ${d.name} done`}
              style={[s.between, { minHeight: 44 }]}
            >
              <View style={[s.row, { flex: 1 }]}>
                <View style={[s.check, { backgroundColor: d.done || received ? c.accent : 'transparent', borderColor: d.done || received ? c.accent : c.line }]}>
                  {d.done || received ? <Text style={{ color: c.onAccent, fontSize: 12, fontFamily: fonts.bodyBold }}>✓</Text> : null}
                </View>
                <View style={[s.dot, { backgroundColor: colors[destKey(d)] ?? c.muted }]} />
                <Text style={{ color: c.ink, fontFamily: fonts.bodyBold, fontSize: 15, flexShrink: 1 }}>{d.name}</Text>
              </View>
              <Amount value={d.amount} />
            </Pressable>
          ))}
          {!received ? (
            <View style={s.between}>
              <Text style={{ color: allPlaced ? c.accentText : c.gold, fontFamily: fonts.bodyBold, fontSize: 14 }}>{allPlaced ? 'All placed' : left > 0 ? 'Not placed yet' : 'Over by'}</Text>
              <Text style={{ color: allPlaced ? c.accentText : c.gold, fontFamily: fonts.bodyBold, fontSize: 14 }}>{peso(money(Math.round(left)), hide)}</Text>
            </View>
          ) : null}
          {!received ? <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 12 }}>Adding or changing destinations, and marking a bonus received, are on the web for now.</Text> : null}
        </>
      ) : null}
    </Card>
  );
}

export default function Bonuses() {
  const c = useTheme();
  const router = useRouter();
  const { hide } = useHide();
  const { data, error, refreshing, reload } = useLoad(() => loadBonuses(supabase));
  const [year, setYear] = useState<number | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const input = data?.salary.input;
  const hasStart = !!input?.events.some((e) => e.kind === 'start');
  const years = data ? Array.from({ length: 6 }, (_, i) => data.thisYear + i) : [];
  const shownYear = data && year !== null && years.includes(year) ? year : (data?.thisYear ?? 0);
  const funds = data ? new Map(data.funds.map((f) => [f.id, f.name])) : new Map<string, string>();
  const cards = data && input && hasStart ? bonusCards(shownYear, input, data.saved, funds) : [];
  const sum = yearSummary(cards);
  const prev = data && input && hasStart && shownYear > data.thisYear ? yearSummary(bonusCards(shownYear - 1, input, data.saved, funds)) : null;
  const total = Math.max(1, sum.net);
  const colors = data ? destColors(data.funds, cards.flatMap((x) => x.dests)) : {};

  /** Ticks one destination, or sets the CIP multiplier. Sends the whole year's choices for that bonus, like the web does. */
  async function save(card: BonusCard, patch: { multiplierNum?: number | null; doneIndex?: number }) {
    setProblem(null);
    const r = await saveInstance(supabase, {
      ruleId: card.ruleId,
      year: card.year,
      multiplierNum: patch.multiplierNum !== undefined ? patch.multiplierNum : card.multiplierNum,
      splits: card.dests.map((d, i) => ({ kind: d.kind, targetId: d.targetId, label: d.kind === 'fund' ? null : (d.label ?? d.name), amount: d.amount, done: i === patch.doneIndex ? !d.done : d.done })),
      received: null,
    });
    if ('error' in r) setProblem(r.error);
    else await reload();
  }

  return (
    <Screen title="Bonuses" refreshing={refreshing} onRefresh={reload}>
      {error ? <Notice tone="error">{error}</Notice> : null}
      {problem ? <Notice tone="error">{problem}</Notice> : null}
      {!data && !error ? <Notice>Loading…</Notice> : null}

      {data ? (
        <>
          <View style={s.chips}>
            {years.map((y) => (
              <Chip key={y} label={`${y}${y === data.thisYear ? ' · this year' : ''}`} on={y === shownYear} onPress={() => setYear(y)} />
            ))}
          </View>

          {!hasStart ? (
            <Notice>No salary on file yet. Bonuses follow your pay, so add your salary under Salary and tax first.</Notice>
          ) : (
            <>
              <LinearGradient colors={[c.heroA, c.heroB]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.hero}>
                <Text style={[s.heroLabel, { fontFamily: fonts.bodyBold }]}>BONUS MONEY IN {shownYear}, AFTER TAX</Text>
                <Amount value={sum.net} style={{ color: '#fff', fontFamily: fonts.display, fontSize: 38, lineHeight: 44 }} />
                <Text style={{ color: '#d3efe6', fontFamily: fonts.body, fontSize: 14 }}>
                  {peso(sum.gross, hide)} gross · {peso(sum.tax, hide)} tax · {sum.count} bonus{sum.count === 1 ? '' : 'es'}
                  {prev ? ` · ${peso(money(sum.net - prev.net), hide)} vs ${shownYear - 1}` : ''}
                </Text>
                {sum.net > 0 ? (
                  <>
                    <View style={s.stack}>
                      {sum.byDest.map((d) => (
                        <View key={d.key} style={{ width: `${(d.amount / total) * 100}%`, backgroundColor: colors[d.key] ?? c.muted }} />
                      ))}
                      {sum.unplaced > 50 ? <View style={{ width: `${(sum.unplaced / total) * 100}%`, backgroundColor: c.gold }} /> : null}
                    </View>
                    {sum.byDest.map((d) => (
                      <View key={d.key} style={s.between}>
                        <View style={s.row}>
                          <View style={[s.dot, { backgroundColor: colors[d.key] ?? c.muted }]} />
                          <Text style={{ color: '#fff', fontFamily: fonts.body, fontSize: 14 }}>{d.name}</Text>
                        </View>
                        <Text style={{ color: '#fff', fontFamily: fonts.bodyBold, fontSize: 14 }}>{peso(d.amount, hide)}</Text>
                      </View>
                    ))}
                    {sum.unplaced > 50 ? (
                      <View style={s.between}>
                        <View style={s.row}>
                          <View style={[s.dot, { backgroundColor: c.gold }]} />
                          <Text style={{ color: '#fff', fontFamily: fonts.body, fontSize: 14 }}>Not placed yet</Text>
                        </View>
                        <Text style={{ color: '#fff', fontFamily: fonts.bodyBold, fontSize: 14 }}>{peso(sum.unplaced, hide)}</Text>
                      </View>
                    ) : null}
                  </>
                ) : null}
              </LinearGradient>

              {cards.length === 0 ? <Notice>No bonuses land in {shownYear}. Add a yearly rule or a one-off on the web.</Notice> : null}
              {cards.map((card) => (
                <CardView key={`${card.key}-${card.status}-${card.net}-${card.dests.map((d) => `${d.name}${d.amount}${d.done}`).join(',')}`} card={card} colors={colors} baseMultiplier={input!.assumptions.cipMultiplierNum} onSave={save} />
              ))}

              <Card>
                <Text style={{ color: c.ink, fontFamily: fonts.display, fontSize: 16 }}>Rules</Text>
                {input!.bonusRules.length === 0 ? <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 14 }}>No bonus rules yet.</Text> : null}
                {input!.bonusRules.map((r) => (
                  <View key={r.id} style={s.between}>
                    <Body bold>{r.name}</Body>
                    <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 13 }}>
                      {r.recurrence === 'once' ? 'one-off' : `yearly, ${MON[r.payMonth - 1]}`} · {r.payslipCutoff === 'first' ? '1st' : '2nd'} cutoff
                    </Text>
                  </View>
                ))}
                <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 12 }}>
                  Shared ₱90,000 cap: the part of each bonus left after its de minimis counts toward one cap per year. Past it, the excess is taxed. Adding and editing rules is on the web for now.
                </Text>
              </Card>
            </>
          )}
        </>
      ) : null}
    </Screen>
  );
}

const s = StyleSheet.create({
  hero: { borderRadius: 14, padding: 18, gap: 8 },
  heroLabel: { color: '#bfe9dc', fontSize: 12, letterSpacing: 0.8 },
  stack: { flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.15)', marginTop: 6 },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  check: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
});
