import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FUND_COLORS } from '@/lib/bonuses/colors';
import { money } from '@/lib/domain/money';
import { loadFunds } from '@/lib/funds/load';
import { Amount, Body, Card, Notice, Screen } from '~/components/ui';
import { useHide } from '~/lib/hide';
import { peso } from '~/lib/money';
import { supabase } from '~/lib/supabase';
import { fonts, useTheme } from '~/lib/theme';
import { useLoad } from '~/lib/useLoad';

const RULE: Record<string, { label: string; effect: string }> = {
  steps: { label: 'Fill in steps', effect: 'Takes up to your monthly limit until the current tranche is full, then moves on to the next.' },
  cap: { label: 'Fill to cap', effect: 'Takes what the pool allows, in priority order, until it hits the cap. Then it drops out.' },
  reset: { label: 'Reset each year', effect: 'Resets every January: the balance returns to zero and filling starts over.' },
  fixed: { label: 'Fixed monthly', effect: 'The same amount each month if the pool can cover it, until the cap.' },
};
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function Funds() {
  const c = useTheme();
  const router = useRouter();
  const { hide } = useHide();
  const { data, error, refreshing, reload } = useLoad(() => loadFunds(supabase));
  const accounts = new Map((data?.budget.accounts ?? []).map((a) => [a.id, a.name]));

  return (
    <Screen title="Savings funds" refreshing={refreshing} onRefresh={reload}>
      <Pressable onPress={() => router.back()} accessibilityRole="link" style={{ minHeight: 44, justifyContent: 'center' }}>
        <Text style={{ color: c.accentText, fontFamily: fonts.bodyBold, fontSize: 14 }}>‹ Plan</Text>
      </Pressable>
      {error ? <Notice tone="error">{error}</Notice> : null}
      {!data && !error ? <Notice>Loading…</Notice> : null}
      {data && data.funds.length === 0 ? <Notice>No funds yet. Add them on the web, and they appear here in priority order.</Notice> : null}

      {data?.funds.map((f, i) => {
        const color = data.colors.get(f.id) ?? FUND_COLORS[i % FUND_COLORS.length]!;
        const balance = data.fundStart[f.id] ?? money(0);
        const target = f.target ?? null;
        const pct = target && target > 0 ? Math.min(100, (balance / target) * 100) : null;
        const rule = RULE[f.rule];
        const bits = [
          f.linkedAccountId ? `linked to ${accounts.get(f.linkedAccountId) ?? 'an account'}` : null,
          f.maxPerMonth ? `up to ${peso(f.maxPerMonth, hide)} a month` : null,
          f.fixedAmount ? `${peso(f.fixedAmount, hide)} a month` : null,
          f.rule === 'reset' && f.resetMonth ? `resets in ${MON[f.resetMonth - 1]}` : null,
          f.shareBp ? `${f.shareBp / 100}% share` : null,
        ].filter(Boolean);
        return (
          <Card key={f.id}>
            <View style={s.between}>
              <View style={[s.row, { flex: 1 }]}>
                <Text style={{ color: c.muted, fontFamily: fonts.bodyBold, fontSize: 13 }}>{i + 1}</Text>
                <View style={[s.dot, { backgroundColor: color }]} />
                <Text style={{ color: c.ink, fontFamily: fonts.display, fontSize: 17, flexShrink: 1 }}>{f.name}</Text>
              </View>
              <Amount value={balance} style={{ fontSize: 17 }} />
            </View>
            {pct !== null ? (
              <View style={{ gap: 4 }}>
                <View style={[s.track, { backgroundColor: c.soft }]}>
                  <View style={{ width: `${pct}%`, height: 8, borderRadius: 4, backgroundColor: color }} />
                </View>
                <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 12 }}>
                  {Math.round(pct)}% of {peso(target!, hide)}
                </Text>
              </View>
            ) : null}
            <Body bold>{rule?.label ?? f.rule}</Body>
            <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 13 }}>{rule?.effect}</Text>
            {f.tranches && f.tranches.length > 0 ? (
              <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 13 }}>Tranches: {f.tranches.map((t) => peso(t, hide)).join(', ')}</Text>
            ) : null}
            {bits.length > 0 ? <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 13 }}>{bits.join(' · ')}</Text> : null}
          </Card>
        );
      })}
      {data && data.funds.length > 0 ? <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 12 }}>Creating, editing and reordering funds is on the web for now.</Text> : null}
    </Screen>
  );
}

const s = StyleSheet.create({
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
});
