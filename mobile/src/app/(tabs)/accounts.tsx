import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { creditAvailable, creditOwed } from '@/lib/accounts/v13';
import { money } from '@/lib/domain/money';
import { shortDate } from '@/lib/now/format';
import { manilaDate } from '@/lib/now/summary';
import { Amount, Body, Card, Label, Notice, Screen } from '~/components/ui';
import { loadAccounts, type AccountCard } from '~/lib/accounts';
import { useHide } from '~/lib/hide';
import { MASK, peso } from '~/lib/money';
import { supabase } from '~/lib/supabase';
import { fonts, useTheme } from '~/lib/theme';
import { useLoad } from '~/lib/useLoad';

const KIND: Record<string, string> = { ewallet: 'E-wallet', debit: 'Debit', savings: 'Savings', credit: 'Credit', cash: 'Cash' };
const kindLabel = (a: AccountCard) => `${KIND[a.kind] ?? a.kind}${a.last4 ? ` ·· ${a.last4}` : ''}`;

/** One coloured card, like the web: name, kind, balance, and when it was last confirmed. */
function AccountTile({ a, onPress }: { a: AccountCard; onPress: () => void }) {
  const { hide } = useHide();
  const owed = a.kind === 'credit';
  const avail = owed ? creditAvailable(a.balance, a.credit_limit === null ? null : money(a.credit_limit)) : null;
  const sub = owed
    ? avail !== null
      ? `Available ${peso(avail, hide)}`
      : 'owed'
    : a.latest
      ? `Confirmed ${shortDate(manilaDate(a.latest.asOf))}`
      : 'No balance set yet';
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${a.name}, ${kindLabel(a)}`}
      style={[s.tile, { backgroundColor: a.color }]}
    >
      <View style={s.circleA} />
      <View style={s.circleB} />
      <View style={s.tileTop}>
        <Text style={[s.tileName, { fontFamily: fonts.display }]} numberOfLines={1}>
          {a.name}
        </Text>
        {a.fund ? (
          <View style={s.tag}>
            <Text style={[s.tagText, { fontFamily: fonts.bodyBold }]}>Fund</Text>
          </View>
        ) : null}
      </View>
      <Text style={[s.tileKind, { fontFamily: fonts.bodyBold }]}>{kindLabel(a)}</Text>
      <Text style={[s.tileBal, { fontFamily: fonts.display }]}>
        {peso(owed ? creditOwed(a.balance) : a.balance, hide)}
        {owed && !hide ? ' owed' : ''}
      </Text>
      <Text style={[s.tileSub, { fontFamily: fonts.bodyBold }]}>{sub}</Text>
    </Pressable>
  );
}

/** "The sum that proves it": last confirmed balance, confirmed rows after it, balance now, pending not counted. */
function Calc({ a }: { a: AccountCard }) {
  const c = useTheme();
  const row = (key: string, left: string, right: React.ReactNode, bold?: boolean, sub?: string) => (
    <View key={key} style={s.calcRow}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: bold ? c.ink : c.muted, fontFamily: bold ? fonts.bodyBold : fonts.body, fontSize: 14 }}>{left}</Text>
        {sub ? <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 12 }}>{sub}</Text> : null}
      </View>
      {right}
    </View>
  );
  return (
    <View style={[s.calc, { backgroundColor: c.soft }]}>
      {row(
        'last',
        `Last confirmed balance${a.latest ? ` · ${shortDate(manilaDate(a.latest.asOf))}` : ''}`,
        <Amount value={a.latest?.amount ?? money(0)} style={{ fontSize: 14 }} />,
      )}
      {a.after.map((t) =>
        row(
          t.id,
          t.merchant ?? (t.kind === 'transfer' ? 'Transfer' : 'Transaction'),
          <Amount value={money(t.amount)} signed style={{ fontSize: 14 }} />,
          false,
          shortDate(manilaDate(t.occurred_at)),
        ),
      )}
      <View style={[s.calcTotal, { borderTopColor: c.line }]}>
        {row('now', 'Balance now', <Amount value={a.balance} style={{ fontSize: 15 }} />, true)}
      </View>
      {a.pending.length > 0
        ? row('pend', 'Pending, not counted yet', <Amount value={a.pendingTotal} signed style={{ fontSize: 14, color: c.gold }} />)
        : null}
    </View>
  );
}

function Detail({ a, onClose }: { a: AccountCard; onClose: () => void }) {
  const c = useTheme();
  const { hide } = useHide();
  const insets = useSafeAreaInsets();
  const owed = a.kind === 'credit';
  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={s.scrim} onPress={onClose} accessibilityLabel="Close details" />
      <View style={[s.sheet, { backgroundColor: c.surface, borderColor: c.line, paddingBottom: insets.bottom + 16 }]}>
        <View style={[s.grab, { backgroundColor: c.line }]} />
        <ScrollView contentContainerStyle={{ gap: 12 }}>
          <View style={s.detailHead}>
            <View style={[s.avatar, { backgroundColor: a.color }]}>
              <Text style={{ color: '#fff', fontFamily: fonts.display, fontSize: 16 }}>{a.name[0]?.toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: c.ink, fontFamily: fonts.display, fontSize: 20 }}>{a.name}</Text>
              <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 13 }}>{kindLabel(a)}</Text>
            </View>
            <Text style={{ color: c.ink, fontFamily: fonts.display, fontSize: 20 }}>
              {hide ? MASK : peso(owed ? creditOwed(a.balance) : a.balance, false)}
              {owed && !hide ? ' owed' : ''}
            </Text>
          </View>
          <Calc a={a} />
          {a.fund ? (
            <View style={[s.pill, { backgroundColor: c.tint }]}>
              <Text style={{ color: c.accentText, fontFamily: fonts.bodyBold, fontSize: 13 }}>Linked to {a.fund} fund</Text>
            </View>
          ) : null}
          <Pressable onPress={onClose} accessibilityRole="button" style={[s.close, { backgroundColor: c.soft }]}>
            <Text style={{ color: c.ink, fontFamily: fonts.bodyBold, fontSize: 15 }}>Close</Text>
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
}

export default function Accounts() {
  const c = useTheme();
  const router = useRouter();
  const { data, error, refreshing, reload } = useLoad(() => loadAccounts(supabase));
  const [openId, setOpenId] = useState<string | null>(null);
  const open = data ? [...data.spending, ...data.funds].find((a) => a.id === openId) ?? null : null;

  return (
    <Screen title="Accounts" subtitle="Balances move when you confirm a transaction." refreshing={refreshing} onRefresh={reload}>
      {error ? <Notice tone="error">{error}</Notice> : null}
      {!data && !error ? <Notice>Loading…</Notice> : null}
      {data ? (
        <>
          <Card>
            <Label>You own</Label>
            <Amount value={data.total} style={{ fontFamily: fonts.display, fontSize: 32, lineHeight: 38, color: c.ink }} />
            {data.pendingCount > 0 ? (
              <Pressable onPress={() => router.push('/inbox')} accessibilityRole="button" style={[s.pill, { backgroundColor: c.soft, alignSelf: 'flex-start' }]}>
                <Text style={{ color: c.gold, fontFamily: fonts.bodyBold, fontSize: 13 }}>{data.pendingCount} pending in Inbox</Text>
              </Pressable>
            ) : null}
          </Card>

          {data.spending.length > 0 ? (
            <View style={{ gap: 8 }}>
              <Text style={{ color: c.ink, fontFamily: fonts.display, fontSize: 18 }}>Spending accounts</Text>
              <View style={s.grid}>
                {data.spending.map((a) => (
                  <AccountTile key={a.id} a={a} onPress={() => setOpenId(a.id)} />
                ))}
              </View>
            </View>
          ) : null}

          {data.funds.length > 0 ? (
            <View style={{ gap: 8 }}>
              <Text style={{ color: c.ink, fontFamily: fonts.display, fontSize: 18 }}>Fund accounts</Text>
              <Body style={{ color: c.muted, fontSize: 13 }}>Linked to a fund, so the fund balance updates itself.</Body>
              <View style={s.grid}>
                {data.funds.map((a) => (
                  <AccountTile key={a.id} a={a} onPress={() => setOpenId(a.id)} />
                ))}
              </View>
            </View>
          ) : null}

          {data.spending.length + data.funds.length === 0 ? <Notice>No accounts yet. Add your first one on the web app.</Notice> : null}
        </>
      ) : null}
      {open ? <Detail a={open} onClose={() => setOpenId(null)} /> : null}
    </Screen>
  );
}

const s = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { flexGrow: 1, flexBasis: '46%', minWidth: 150, minHeight: 118, borderRadius: 12, padding: 14, overflow: 'hidden', gap: 2 },
  circleA: { position: 'absolute', right: -30, top: -34, width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(255,255,255,0.09)' },
  circleB: { position: 'absolute', right: 30, bottom: -60, width: 110, height: 110, borderRadius: 55, backgroundColor: 'rgba(255,255,255,0.06)' },
  tileTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  tileName: { color: '#fff', fontSize: 15, flexShrink: 1 },
  tag: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 1 },
  tagText: { color: '#fff', fontSize: 11 },
  tileKind: { color: 'rgba(255,255,255,0.92)', fontSize: 12 },
  tileBal: { color: '#fff', fontSize: 22, marginTop: 'auto', paddingTop: 10 },
  tileSub: { color: 'rgba(255,255,255,0.92)', fontSize: 12 },
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { maxHeight: '85%', borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1, padding: 16, gap: 12 },
  grab: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2 },
  detailHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  calc: { borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10 },
  calcRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, paddingVertical: 4 },
  calcTotal: { borderTopWidth: 1, marginTop: 6, paddingTop: 6 },
  pill: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, minHeight: 32, justifyContent: 'center' },
  close: { minHeight: 48, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
});
