import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KIND_LABEL, KIND_ORDER } from '@/lib/accounts/order';
import { creditAvailable, creditOwed } from '@/lib/accounts/v13';
import { money } from '@/lib/domain/money';
import { shortDate } from '@/lib/now/format';
import { manilaDate } from '@/lib/now/summary';
import { AccountTile, TileSkeleton } from '~/components/AccountTile';
import { AddAccountSheet, EditAccountSheet, MoveSheet, ReconcileSheet } from '~/components/AccountSheets';
import { Amount, Body, Card, Label, Notice, Screen } from '~/components/ui';
import { loadAccounts, type AccountCard } from '~/lib/accounts';
import { moveAccount } from '~/lib/accountsWrite';
import { useHide } from '~/lib/hide';
import { MASK, peso } from '~/lib/money';
import { supabase } from '~/lib/supabase';
import { fonts, useTheme } from '~/lib/theme';
import { useLoad } from '~/lib/useLoad';

const KIND: Record<string, string> = { ewallet: 'E-wallet', debit: 'Debit', savings: 'Savings', credit: 'Credit', cash: 'Cash' };
const kindLabel = (a: AccountCard) => `${KIND[a.kind] ?? a.kind}${a.last4 ? ` ·· ${a.last4}` : ''}`;

/** One coloured card, like the web: name, kind, balance, and when it was last confirmed. */
function Tile({ a, onPress }: { a: AccountCard; onPress: () => void }) {
  const { hide } = useHide();
  const owed = a.kind === 'credit';
  const avail = owed ? creditAvailable(a.balance, a.credit_limit === null ? null : money(a.credit_limit)) : null;
  let sub = 'No balance set yet';
  if (owed) sub = avail !== null ? 'Available ' + peso(avail, hide) : 'owed';
  else if (a.latest) sub = 'Confirmed ' + shortDate(manilaDate(a.latest.asOf));
  const balance = peso(owed ? creditOwed(a.balance) : a.balance, hide) + (owed && !hide ? ' owed' : '');
  return <AccountTile name={a.name} kind={kindLabel(a)} color={a.color} fund={!!a.fund} balanceText={balance} sub={sub} onPress={onPress} />;
}

/** The cards of one list, in a group for each kind of account (e-wallets, debit, savings, credit cards, cash). */
function Grouped({ list, onOpen }: { list: AccountCard[]; onOpen: (id: string) => void }) {
  const c = useTheme();
  return (
    <View style={{ gap: 24 }}>
      {KIND_ORDER.map((k) => {
        const inKind = list.filter((a) => a.kind === k);
        if (inKind.length === 0) return null;
        return (
          <View key={k} style={{ gap: 10 }}>
            <Text style={{ color: c.muted, fontFamily: fonts.bodyBold, fontSize: 12, letterSpacing: 0.5 }}>
              {(KIND_LABEL[k] ?? k).toUpperCase()} · {inKind.length}
            </Text>
            <View style={s.grid}>
              {inKind.map((a) => (
                <Tile key={a.id} a={a} onPress={() => onOpen(a.id)} />
              ))}
            </View>
          </View>
        );
      })}
    </View>
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

function Detail({ a, onClose, onAction, onMove, moving }: { a: AccountCard; onClose: () => void; onAction: (kind: 'reconcile' | 'move' | 'edit') => void; onMove: (dir: 'earlier' | 'later') => void; moving: boolean }) {
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
          <View style={s.actions}>
            <Pressable onPress={() => onAction('reconcile')} accessibilityRole="button" style={[s.close, { flex: 1, backgroundColor: c.accent }]}>
              <Text style={{ color: c.onAccent, fontFamily: fonts.bodyBold, fontSize: 15 }}>Reconcile</Text>
            </Pressable>
            <Pressable onPress={() => onAction('move')} accessibilityRole="button" style={[s.close, { flex: 1, backgroundColor: c.soft }]}>
              <Text style={{ color: c.ink, fontFamily: fonts.bodyBold, fontSize: 15 }}>Move money</Text>
            </Pressable>
          </View>
          <View style={s.actions}>
            <Pressable onPress={() => onMove('earlier')} disabled={moving} accessibilityRole="button" accessibilityLabel={`Move ${a.name} earlier in the list`} style={[s.close, { flex: 1, backgroundColor: c.soft }]}>
              <Text style={{ color: c.ink, fontFamily: fonts.bodyBold, fontSize: 15, opacity: moving ? 0.5 : 1 }}>{moving ? 'Saving…' : '← Earlier'}</Text>
            </Pressable>
            <Pressable onPress={() => onMove('later')} disabled={moving} accessibilityRole="button" accessibilityLabel={`Move ${a.name} later in the list`} style={[s.close, { flex: 1, backgroundColor: c.soft }]}>
              <Text style={{ color: c.ink, fontFamily: fonts.bodyBold, fontSize: 15 }}>Later →</Text>
            </Pressable>
          </View>
          <Pressable onPress={() => onAction('edit')} accessibilityRole="button" style={[s.close, { backgroundColor: c.soft }]}>
            <Text style={{ color: c.ink, fontFamily: fonts.bodyBold, fontSize: 15 }}>Edit account</Text>
          </Pressable>
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
  const [moveError, setMoveError] = useState<string | null>(null);
  const [moving, setMoving] = useState(false);
  const [sheet, setSheet] = useState<'reconcile' | 'move' | 'edit' | 'add' | null>(null);
  const all = data ? [...data.spending, ...data.funds] : [];
  const open = all.find((a) => a.id === openId) ?? null;
  const move = async (dir: 'earlier' | 'later') => {
    if (!open || moving) return;
    setMoving(true);
    try {
      const r = await moveAccount(supabase, { accountId: open.id, dir });
      if ('error' in r) setMoveError(r.error);
      else setMoveError(null);
      await reload();
    } finally {
      setMoving(false);
    }
  };
  const done = () => {
    setSheet(null);
    setOpenId(null);
    void reload();
  };

  return (
    <Screen title="Accounts" refreshing={refreshing} onRefresh={reload}>
      {error ? <Notice tone="error">{error}</Notice> : null}
      {moveError ? <Notice tone="error">{moveError}</Notice> : null}
      {moving ? <Notice>Saving order…</Notice> : null}
      {!data && !error ? (
        <View style={s.grid} accessibilityLabel="Loading accounts" accessibilityRole="progressbar">
          {[0, 1, 2].map((i) => (
            <TileSkeleton key={i} color={c.soft} />
          ))}
        </View>
      ) : null}
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
            <View style={{ gap: 12 }}>
              <Text style={{ color: c.ink, fontFamily: fonts.display, fontSize: 18 }}>Spending accounts</Text>
              <Grouped list={data.spending} onOpen={setOpenId} />
            </View>
          ) : null}

          {data.funds.length > 0 ? (
            <View style={{ gap: 12 }}>
              <Text style={{ color: c.ink, fontFamily: fonts.display, fontSize: 18 }}>Fund accounts</Text>
              <Body style={{ color: c.muted, fontSize: 13 }}>Linked to a fund, so the fund balance updates itself.</Body>
              <Grouped list={data.funds} onOpen={setOpenId} />
            </View>
          ) : null}

          {data.spending.length + data.funds.length === 0 ? <Notice>No accounts yet. Add your first one with the button below.</Notice> : null}
          <Pressable onPress={() => setSheet('add')} accessibilityRole="button" style={[s.close, { backgroundColor: c.soft }]}>
            <Text style={{ color: c.ink, fontFamily: fonts.bodyBold, fontSize: 15 }}>+ Add account</Text>
          </Pressable>
        </>
      ) : null}
      {open && !sheet ? <Detail a={open} onClose={() => setOpenId(null)} onAction={setSheet} onMove={move} moving={moving} /> : null}
      {open && sheet === 'reconcile' ? <ReconcileSheet a={open} onClose={() => setSheet(null)} onSaved={done} /> : null}
      {open && sheet === 'move' ? <MoveSheet accounts={all} from={open} onClose={() => setSheet(null)} onSaved={done} /> : null}
      {open && sheet === 'edit' ? <EditAccountSheet a={open} onClose={() => setSheet(null)} onSaved={done} /> : null}
      {sheet === 'add' ? <AddAccountSheet onClose={() => setSheet(null)} onSaved={done} /> : null}
    </Screen>
  );
}

const s = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  actions: { flexDirection: 'row', gap: 10 },
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
