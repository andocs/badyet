import { StyleSheet, Text, View } from 'react-native';
import { shortDate } from '@/lib/now/format';
import type { IsoDate } from '@/lib/domain/dates';
import { Amount, Body, Card, Label, Notice, Screen } from '~/components/ui';
import { loadAccounts, type AccountCard } from '~/lib/accounts';
import { supabase } from '~/lib/supabase';
import { fonts, useTheme } from '~/lib/theme';
import { useLoad } from '~/lib/useLoad';

function Row({ a }: { a: AccountCard }) {
  const c = useTheme();
  const dot = a.color ?? c.blue;
  const sub = [a.institution, a.last4 ? `•••• ${a.last4}` : null, a.fund ? `for ${a.fund}` : null].filter(Boolean).join(' · ');
  return (
    <View style={s.row}>
      <View style={[s.dot, { backgroundColor: dot }]} />
      <View style={{ flex: 1 }}>
        <Body bold>{a.name}</Body>
        {sub ? <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 13 }}>{sub}</Text> : null}
        <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 12 }}>
          {a.confirmedOn ? `Confirmed ${shortDate(a.confirmedOn.slice(0, 10) as IsoDate)}` : 'Balance not confirmed yet'}
        </Text>
      </View>
      <Amount value={a.balance} style={{ color: a.balance < 0 ? c.err : c.ink }} />
    </View>
  );
}

export default function Accounts() {
  const c = useTheme();
  const { data, error, refreshing, reload } = useLoad(() => loadAccounts(supabase));

  return (
    <Screen title="Accounts" subtitle="Balances move when you confirm a transaction." refreshing={refreshing} onRefresh={reload}>
      {error ? <Notice tone="error">{error}</Notice> : null}
      {!data && !error ? <Notice>Loading…</Notice> : null}
      {data ? (
        <>
          <Card>
            <Label>You own</Label>
            <Amount value={data.total} style={{ fontFamily: fonts.display, fontSize: 32, lineHeight: 38, color: c.ink }} />
          </Card>
          {data.spending.length > 0 ? (
            <Card>
              <Label>Spending</Label>
              {data.spending.map((a) => (
                <Row key={a.id} a={a} />
              ))}
            </Card>
          ) : null}
          {data.funds.length > 0 ? (
            <Card>
              <Label>Set aside</Label>
              {data.funds.map((a) => (
                <Row key={a.id} a={a} />
              ))}
            </Card>
          ) : null}
          {data.spending.length + data.funds.length === 0 ? <Notice>No accounts yet. Add them on the web app.</Notice> : null}
        </>
      ) : null}
    </Screen>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56 },
  dot: { width: 12, height: 12, borderRadius: 6 },
});
