import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { isoDate } from '@/lib/domain/dates';
import { money } from '@/lib/domain/money';
import { relativeDay, timeLabel } from '@/lib/now/format';
import { manilaDate } from '@/lib/now/summary';
import { todayManila } from '@/lib/plans/validate';
import { GmailBanner } from '~/components/GmailBanner';
import { Amount, Body, Card, Label, Notice, Screen } from '~/components/ui';
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
      <Text style={{ color: on ? c.onAccent : c.ink, fontFamily: fonts.bodyBold, fontSize: 14 }}>{label}</Text>
    </Pressable>
  );
}

function PendingCard({
  t, categories, today, onConfirm, onIgnore,
}: {
  t: InboxTxn;
  categories: Category[];
  today: ReturnType<typeof isoDate>;
  onConfirm: (t: InboxTxn, categoryId: string | null, rule: boolean, note: string) => void;
  onIgnore: (t: InboxTxn) => void;
}) {
  const c = useTheme();
  const [categoryId, setCategoryId] = useState<string | null>(t.categoryId);
  const [rule, setRule] = useState(t.guess === 'rule');
  const [note, setNote] = useState(t.note ?? '');
  const isTransfer = t.kind === 'transfer';
  const chosen = categories.find((x) => x.id === categoryId)?.name;
  const canConfirm = isTransfer || categoryId !== null;

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
            {categories.map((x) => (
              <Chip key={x.id} label={x.name} on={x.id === categoryId} onPress={() => setCategoryId(x.id)} />
            ))}
          </View>
          {t.guess && categoryId === t.categoryId ? (
            <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 12 }}>
              Suggested from {t.guess === 'rule' ? 'your rule' : 'what you did before'}.
            </Text>
          ) : null}
          {chosen && t.who !== 'Expense' ? (
            <View style={s.row}>
              <Text style={{ color: c.ink, fontFamily: fonts.body, fontSize: 14, flex: 1 }}>Always put {t.who} under {chosen}</Text>
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
          onPress={() => onConfirm(t, isTransfer ? null : categoryId, rule && !isTransfer, note)}
          disabled={!canConfirm}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canConfirm }}
          style={[s.btn, { flex: 1, backgroundColor: canConfirm ? c.accent : c.soft }]}
        >
          <Text style={{ color: canConfirm ? c.onAccent : c.muted, fontFamily: fonts.bodyBold, fontSize: 15 }}>
            {canConfirm ? 'Confirm' : 'Pick a category'}
          </Text>
        </Pressable>
        <Pressable onPress={() => onIgnore(t)} accessibilityRole="button" style={[s.btn, { backgroundColor: c.soft }]}>
          <Text style={{ color: c.ink, fontFamily: fonts.bodyBold, fontSize: 15 }}>Not mine</Text>
        </Pressable>
      </View>
    </Card>
  );
}

export default function Inbox() {
  const c = useTheme();
  const { data, error, refreshing, reload } = useLoad(() => loadInbox(supabase));
  const [view, setView] = useState<'check' | 'all'>('check');
  const [gone, setGone] = useState<Set<string>>(new Set());
  const [problem, setProblem] = useState<string | null>(null);
  const today = useMemo(() => isoDate(todayManila()), []);

  const txns = (data?.txns ?? []).filter((t) => !gone.has(t.id));
  const pending = txns.filter((t) => t.status === 'pending');

  // The row leaves the moment you tap; if the save fails it comes back with the reason.
  async function act(t: InboxTxn, run: () => Promise<{ ok: true } | { error: string }>) {
    setProblem(null);
    setGone((g) => new Set(g).add(t.id));
    const r = await run();
    if ('error' in r) {
      setGone((g) => {
        const n = new Set(g);
        n.delete(t.id);
        return n;
      });
      setProblem(r.error);
    } else {
      void reload();
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
            <Text style={{ color: view === v ? c.ink : c.muted, fontFamily: fonts.bodyBold, fontSize: 14 }}>
              {v === 'check' ? `To check (${pending.length})` : 'All activity'}
            </Text>
          </Pressable>
        ))}
      </View>

      {error ? <Notice tone="error">{error}</Notice> : null}
      {problem ? <Notice tone="error">{problem}</Notice> : null}
      {!data && !error ? <Notice>Loading…</Notice> : null}

      {data && view === 'check' ? (
        pending.length === 0 ? (
          <Card>
            <Body bold>All caught up</Body>
            <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 14 }}>Balances are current as of now.</Text>
          </Card>
        ) : (
          pending.map((t) => (
            <PendingCard
              key={t.id}
              t={t}
              categories={data.categories}
              today={today}
              onConfirm={(row, categoryId, rule, note) => act(row, () => confirmTransaction(supabase, { id: row.id, categoryId, rule, note }))}
              onIgnore={(row) => act(row, () => ignoreTransaction(supabase, row.id))}
            />
          ))
        )
      ) : null}

      {data && view === 'all' ? (
        txns.length === 0 ? (
          <Notice>Nothing yet. Spending you add with + shows up here.</Notice>
        ) : (
          <Card>
            <Label>Recent</Label>
            {txns.map((t) => (
              <View key={t.id} style={[s.row, { minHeight: 52 }]}>
                <View style={{ flex: 1 }}>
                  <Body>{t.who}</Body>
                  <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 13 }}>
                    {t.account} · {when(t.occurredAt, today)}
                    {t.status === 'pending' ? ' · to check' : t.categoryName ? ` · ${t.categoryName}` : ''}
                  </Text>
                </View>
                <Amount value={money(t.amount)} signed style={{ color: t.status === 'pending' ? c.gold : t.amount > 0 ? c.accentText : c.ink }} />
              </View>
            ))}
          </Card>
        )
      ) : null}
    </Screen>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 40, borderRadius: 999, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  input: { minHeight: 48, borderRadius: 10, paddingHorizontal: 14, fontSize: 15 },
  btn: { minHeight: 48, borderRadius: 999, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center' },
  seg: { flexDirection: 'row', borderRadius: 999, padding: 4 },
  segBtn: { flex: 1, minHeight: 44, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
});
