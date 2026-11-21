import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { money } from '@/lib/domain/money';
import { shortDate, rangeLabel } from '@/lib/now/format';
import { loadNow } from '@/lib/now/load';
import { Amount, Bar, Body, Card, Label, Notice, Screen } from '~/components/ui';
import { supabase } from '~/lib/supabase';
import { fonts, useTheme } from '~/lib/theme';
import { useLoad } from '~/lib/useLoad';

export default function Now() {
  const c = useTheme();
  const router = useRouter();
  const { data, error, refreshing, reload } = useLoad(() => loadNow(supabase));
  const palette = [c.accent, c.blue, c.gold, c.violet, c.teal, c.pink];

  if (!data) {
    return (
      <Screen title="Now" refreshing={refreshing} onRefresh={reload}>
        {error ? <Notice tone="error">{error}</Notice> : <Notice>Loading…</Notice>}
      </Screen>
    );
  }
  if (data.kind === 'setup') {
    return (
      <Screen title="Now" refreshing={refreshing} onRefresh={reload}>
        <Notice>
          {data.reason === 'no-salary'
            ? 'Add your salary on the web app first, then pull down to refresh.'
            : 'Build this cutoff’s budget on the web app first, then pull down to refresh.'}
        </Notice>
      </Screen>
    );
  }

  const { view } = data;
  const over = view.overPace > 0;
  return (
    <Screen
      title="Now"
      subtitle={`${rangeLabel(view.period.start, view.period.end)} · ${view.daysLeft} days left`}
      refreshing={refreshing}
      onRefresh={reload}
    >
      <LinearGradient colors={[c.heroA, c.heroB]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.hero}>
        <Text style={[s.heroLabel, { fontFamily: fonts.bodyBold }]}>SAFE TO SPEND TODAY</Text>
        <Amount value={view.today} style={s.heroAmount} />
        <Text style={[s.heroSub, { fontFamily: fonts.body }]}>
          <Amount value={view.perDay} style={s.heroSubAmt} /> a day · <Amount value={view.left} style={s.heroSubAmt} /> left · payday {shortDate(view.nextPayday)}
        </Text>
      </LinearGradient>

      {view.pendingCount > 0 ? (
        <Pressable onPress={() => router.push('/inbox')} accessibilityRole="button">
          <Card style={{ borderColor: c.accent }}>
            <Body bold style={{ color: c.accentText }}>
              {view.pendingCount} to confirm in Inbox
            </Body>
          </Card>
        </Pressable>
      ) : null}

      <Card>
        <Label>Pace</Label>
        <View style={s.row}>
          <Body>{over ? 'Over the plan’s pace by' : 'Under the plan’s pace by'}</Body>
          <Amount value={money(Math.abs(view.overPace))} style={{ color: over ? c.err : c.accentText }} />
        </View>
      </Card>

      {view.envelopes.length > 0 ? (
        <Card>
          <Label>Envelopes</Label>
          {view.envelopes.map((e, i) => (
            <View key={e.categoryId} style={{ gap: 6, marginTop: 6 }}>
              <View style={s.row}>
                <Body bold>{e.name}</Body>
                <Body>
                  <Amount value={e.left} style={{ color: e.left < 0 ? c.err : c.ink }} /> left
                </Body>
              </View>
              <Bar fraction={e.plan > 0 ? e.spent / e.plan : 0} color={palette[i % palette.length]!} over={e.left < 0} />
            </View>
          ))}
        </Card>
      ) : null}

      {view.bills.length > 0 ? (
        <Card>
          <Label>Bills</Label>
          {view.bills.map((b) => (
            <View key={b.lineId} style={s.row}>
              <Body>
                {b.sent ? '✓ ' : ''}
                {b.name}
              </Body>
              <Amount value={b.amount} style={{ color: b.sent ? c.muted : c.ink }} />
            </View>
          ))}
        </Card>
      ) : null}

      {view.recent.length > 0 ? (
        <Card>
          <Label>Recent</Label>
          {view.recent.map((t) => (
            <View key={t.id} style={s.row}>
              <View style={{ flex: 1 }}>
                <Body>{t.merchant ?? 'Unnamed'}</Body>
                <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 13 }}>
                  {t.accountName}
                  {t.status === 'pending' ? ' · pending' : ''}
                </Text>
              </View>
              <Amount value={t.amount} style={{ color: t.amount > 0 ? c.accentText : c.ink }} />
            </View>
          ))}
        </Card>
      ) : null}
    </Screen>
  );
}

const s = StyleSheet.create({
  hero: { borderRadius: 14, padding: 18, gap: 6 },
  heroLabel: { color: '#bfe9dc', fontSize: 12, letterSpacing: 0.8 },
  heroAmount: { color: '#ffffff', fontFamily: fonts.display, fontSize: 40, lineHeight: 46 },
  heroSub: { color: '#d3efe6', fontSize: 14 },
  heroSubAmt: { color: '#ffffff', fontSize: 14, fontFamily: fonts.bodyBold },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, minHeight: 36 },
});
