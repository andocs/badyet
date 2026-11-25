import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { isoDate } from '@/lib/domain/dates';
import { money } from '@/lib/domain/money';
import { relativeDay, timeLabel } from '@/lib/now/format';
import { manilaDate } from '@/lib/now/summary';
import { todayManila } from '@/lib/plans/validate';
import { GmailBanner } from '~/components/GmailBanner';
import { HeldCard, useHeldAccounts } from '~/components/HeldCards';
import { InboxEditSheet } from '~/components/InboxEditSheet';
import { Amount, Body, Card, Label, Notice, Screen } from '~/components/ui';
import { useHeldItems } from '~/lib/CaptureRunner';
import { confirmTransaction, ignoreTransaction, loadInbox, type Category, type InboxTxn } from '~/lib/inbox';
import { supabase } from '~/lib/supabase';
import { fonts, useTheme } from '~/lib/theme';
import { useLoad } from '~/lib/useLoad';

const when = (iso: string, today: ReturnType<typeof isoDate>) => `${relativeDay(manilaDate(iso), today)} ${timeLabel(iso)}`;

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  const c = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      style={[s.chip, { backgroundColor: on ? c.accent : c.soft }]}
    >
      <Text
        style={{
          color: on ? c.onAccent : c.ink,
          fontFamily: fonts.bodyBold,
          fontSize: 14,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function PendingCard({
  t,
  categories,
  bills,
  today,
  onConfirm,
  onIgnore,
  onEdit,
}: {
  t: InboxTxn;
  categories: Category[];
  bills: { id: string; name: string }[];
  today: ReturnType<typeof isoDate>;
  onConfirm: (t: InboxTxn, categoryId: string | null, rule: boolean, note: string, billId: string | null, asTransfer: boolean) => void;
  onIgnore: (t: InboxTxn) => void;
  onEdit: (t: InboxTxn) => void;
}) {
  const c = useTheme();
  const [categoryId, setCategoryId] = useState<string | null>(t.categoryId);
  const [rule, setRule] = useState(t.guess === 'rule');
  const [note, setNote] = useState(t.note ?? '');
  const [billId, setBillId] = useState<string | null>(null);
  // "Transfer" is a button, not a category: a move between your own accounts.
  const [asT, setAsT] = useState(false);
  const isTransfer = t.kind === 'transfer';
  const chosen = categories.find((x) => x.id === categoryId)?.name;
  // A transfer-looking item waits a few minutes for its other side; meanwhile it can only be filed as a Transfer.
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    if (!t.holdUntil) return;
    const timer = setInterval(() => setNowMs(Date.now()), 15_000);
    return () => clearInterval(timer);
  }, [t.holdUntil]);
  const holding = t.holdUntil !== null && Date.parse(t.holdUntil) > nowMs;
  const canConfirm = isTransfer || asT || (categoryId !== null && !holding);

  return (
    <Card>
      <View style={s.row}>
        <View style={{ flex: 1 }}>
          <Body bold>{t.who}</Body>
          <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 13 }}>
            {isTransfer && t.peerAccount ? `${t.account} → ${t.peerAccount}` : t.account} · {when(t.occurredAt, today)} · {t.source}
          </Text>
        </View>
        <Amount value={money(t.amount)} signed style={{ color: t.amount > 0 ? c.accentText : c.ink, fontSize: 17 }} />
      </View>

      {isTransfer ? (
        <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 14 }}>A move between your accounts. It needs no category.</Text>
      ) : (
        <>
          <View style={s.chips}>
            <Chip label="↔ Transfer" on={asT} onPress={() => setAsT((v) => !v)} />
            {categories.map((x) => (
              <Chip key={x.id} label={x.name} on={!asT && x.id === categoryId} onPress={() => { setAsT(false); setCategoryId(x.id); }} />
            ))}
          </View>
          {holding ? (
            <Text accessibilityRole="alert" style={{ color: c.ink, fontFamily: fonts.body, fontSize: 13 }}>
              May be a transfer: waiting for the other side until {timeLabel(t.holdUntil!)}. Tap Transfer now, or confirm it as {t.amount < 0 ? 'spending' : 'income'} after that.
            </Text>
          ) : null}
          {t.guess && categoryId === t.categoryId ? (
            <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 12 }}>
              Suggested from {t.guess === 'rule' ? 'your rule' : 'what you did before'}.
            </Text>
          ) : null}
          {chosen && t.who !== 'Expense' ? (
            <View style={s.row}>
              <Text
                style={{
                  color: c.ink,
                  fontFamily: fonts.body,
                  fontSize: 14,
                  flex: 1,
                }}
              >
                Always put {t.who} under {chosen}
              </Text>
              <Switch
                value={rule}
                onValueChange={setRule}
                trackColor={{ true: c.accent, false: c.line }}
                thumbColor={c.ink}
                accessibilityLabel={`Always put ${t.who} under ${chosen}`}
              />
            </View>
          ) : null}
        </>
      )}

      {!isTransfer && t.amount < 0 && bills.length > 0 ? (
        <View style={{ gap: 6 }}>
          <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 12 }}>Pays a bill? It will show as sent on Now.</Text>
          <View style={s.chips}>
            <Chip label="No" on={billId === null} onPress={() => setBillId(null)} />
            {bills.map((b) => (
              <Chip key={b.id} label={b.name} on={billId === b.id} onPress={() => setBillId(b.id)} />
            ))}
          </View>
        </View>
      ) : null}

      <TextInput
        value={note}
        onChangeText={setNote}
        placeholder="Note (optional)"
        placeholderTextColor={c.muted}
        maxLength={200}
        style={[s.input, { color: c.ink, backgroundColor: c.soft, fontFamily: fonts.body }]}
      />

      <View style={s.row}>
        <Pressable
          onPress={() => onConfirm(t, isTransfer || asT ? null : categoryId, rule && !isTransfer && !asT, note, isTransfer || asT ? null : billId, asT)}
          disabled={!canConfirm}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canConfirm }}
          style={[s.btn, { flex: 1, backgroundColor: canConfirm ? c.accent : c.soft }]}
        >
          <Text
            style={{
              color: canConfirm ? c.onAccent : c.muted,
              fontFamily: fonts.bodyBold,
              fontSize: 15,
            }}
          >
            {canConfirm ? 'Confirm' : holding && categoryId !== null ? 'Waiting for the other side' : 'Pick a category'}
          </Text>
        </Pressable>
        <Pressable onPress={() => onIgnore(t)} accessibilityRole="button" style={[s.btn, { backgroundColor: c.soft }]}>
          <Text style={{ color: c.ink, fontFamily: fonts.bodyBold, fontSize: 15 }}>Not mine</Text>
        </Pressable>
        <Pressable onPress={() => onEdit(t)} accessibilityRole="button" accessibilityLabel={`Edit ${t.who}`} style={[s.btn, { backgroundColor: c.soft }]}>
          <Text style={{ color: c.ink, fontFamily: fonts.bodyBold, fontSize: 15 }}>Edit</Text>
        </Pressable>
      </View>
    </Card>
  );
}

export default function Inbox() {
  const c = useTheme();
  const { data, error, refreshing, reload } = useLoad(() => loadInbox(supabase));
  const [view, setView] = useState<'check' | 'all'>('check');
  // Rows you just ignored leave at once; rows you just confirmed turn confirmed at once. Both clear when the fresh data arrives.
  const [ignored, setIgnored] = useState<Set<string>>(new Set());
  const [confirmed, setConfirmed] = useState<Set<string>>(new Set());
  const [problem, setProblem] = useState<string | null>(null);
  const [editing, setEditing] = useState<InboxTxn | null>(null);
  const today = useMemo(() => isoDate(todayManila()), []);

  const txns = (data?.txns ?? [])
    .filter((t) => !ignored.has(t.id))
    .map((t) => (confirmed.has(t.id) ? { ...t, status: 'confirmed' as const } : t));
  const pending = txns.filter((t) => t.status === 'pending');
  // Captures no account has claimed sit in the same list, among the others by time, and ask which account they belong to.
  const held = useHeldItems();
  const heldAccounts = useHeldAccounts();
  const toCheck = [
    ...pending.map((t) => ({
      at: Date.parse(t.occurredAt),
      t,
      h: null as null,
    })),
    ...(heldAccounts ? held.map((h) => ({ at: h.postTime, t: null as null, h })) : []),
  ].sort((a, b) => b.at - a.at);

  // The row changes the moment you tap (leaves To check, and shows as confirmed in All activity); if the save fails it changes back
  // with the reason, and once it has saved the fresh data replaces it.
  async function act(t: InboxTxn, kind: 'confirm' | 'ignore', run: () => Promise<{ ok: true } | { error: string }>) {
    const set = kind === 'confirm' ? setConfirmed : setIgnored;
    const without = (cur: Set<string>) => {
      const n = new Set(cur);
      n.delete(t.id);
      return n;
    };
    setProblem(null);
    set((cur) => new Set(cur).add(t.id));
    const r = await run();
    if ('error' in r) {
      set(without);
      setProblem(r.error);
    } else {
      await reload();
      set(without);
    }
  }

  return (
    <Screen title="Inbox" refreshing={refreshing} onRefresh={reload}>
      <GmailBanner />
      <View style={[s.seg, { backgroundColor: c.soft }]}>
        {(['check', 'all'] as const).map((v) => (
          <Pressable
            key={v}
            onPress={() => setView(v)}
            accessibilityRole="tab"
            accessibilityState={{ selected: view === v }}
            style={[s.segBtn, view === v && { backgroundColor: c.surface }]}
          >
            <Text
              style={{
                color: view === v ? c.ink : c.muted,
                fontFamily: fonts.bodyBold,
                fontSize: 14,
              }}
            >
              {v === 'check' ? `To check (${toCheck.length})` : 'All activity'}
            </Text>
          </Pressable>
        ))}
      </View>

      {error ? <Notice tone="error">{error}</Notice> : null}
      {problem ? <Notice tone="error">{problem}</Notice> : null}
      {!data && !error ? <Notice>Loading…</Notice> : null}

      {data && view === 'check' ? (
        toCheck.length === 0 ? (
          <Card>
            <Body bold>All caught up</Body>
            <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 14 }}>Balances are current as of now.</Text>
          </Card>
        ) : (
          toCheck.map((item) =>
            item.h ? (
              <HeldCard key={item.h.hash} h={item.h} accounts={heldAccounts ?? []} categories={data.categories} today={today} />
            ) : (
              <PendingCard
                key={item.t!.id}
                t={item.t!}
                categories={data.categories}
                bills={data.bills}
                today={today}
                onConfirm={(row, categoryId, rule, note, billId, asTransfer) =>
                  act(row, 'confirm', () =>
                    confirmTransaction(supabase, {
                      id: row.id,
                      categoryId,
                      rule,
                      note,
                      billId,
                      asTransfer,
                    }),
                  )
                }
                onIgnore={(row) => act(row, 'ignore', () => ignoreTransaction(supabase, row.id))}
                onEdit={setEditing}
              />
            ),
          )
        )
      ) : null}

      {data && view === 'all' ? (
        txns.length === 0 ? (
          <Notice>Nothing yet. Spending you add with + shows up here.</Notice>
        ) : (
          <Card>
            <Label>Recent</Label>
            {txns.map((t) => (
              <Pressable key={t.id} onPress={() => setEditing(t)} accessibilityRole="button" accessibilityLabel={`Edit ${t.who}`} style={[s.row, { minHeight: 52 }]}>
                <View style={{ flex: 1 }}>
                  <Body>{t.who}</Body>
                  <Text
                    style={{
                      color: c.muted,
                      fontFamily: fonts.body,
                      fontSize: 13,
                    }}
                  >
                    {t.account} · {when(t.occurredAt, today)}
                    {t.status === 'pending' ? ' · to check' : t.categoryName ? ` · ${t.categoryName}` : ''}
                  </Text>
                </View>
                <Amount
                  value={money(t.amount)}
                  signed
                  style={{
                    color: t.status === 'pending' ? c.gold : t.amount > 0 ? c.accentText : c.ink,
                  }}
                />
              </Pressable>
            ))}
          </Card>
        )
      ) : null}
      {editing && data ? (
        <InboxEditSheet
          t={editing}
          accounts={data.accounts}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void reload();
          }}
        />
      ) : null}
    </Screen>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    minHeight: 40,
    borderRadius: 999,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    minHeight: 48,
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 15,
  },
  btn: {
    minHeight: 48,
    borderRadius: 999,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  seg: { flexDirection: 'row', borderRadius: 999, padding: 4 },
  segBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
