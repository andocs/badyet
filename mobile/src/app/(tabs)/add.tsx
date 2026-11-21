import { randomUUID } from 'expo-crypto';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { money } from '@/lib/domain/money';
import { relativeDay, timeLabel } from '@/lib/now/format';
import { manilaDate } from '@/lib/now/summary';
import { todayManila } from '@/lib/plans/validate';
import { isoDate } from '@/lib/domain/dates';
import { Amount, Body, Card, Label, Notice, Screen } from '~/components/ui';
import { buildExpense } from '~/lib/expense';
import { outbox } from '~/lib/outboxStore';
import { loadPickers } from '~/lib/pickers';
import { supabase } from '~/lib/supabase';
import { useSync } from '~/lib/sync';
import { fonts, useTheme } from '~/lib/theme';
import { useLoad } from '~/lib/useLoad';

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

export default function QuickAdd() {
  const c = useTheme();
  const { data, error, refreshing, reload } = useLoad(() => loadPickers(supabase));
  const { queued, syncing, syncNow, refresh, remove } = useSync();
  const [amount, setAmount] = useState('');
  const [merchant, setMerchant] = useState('');
  const [accountId, setAccountId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const account = accountId ?? data?.accounts[0]?.id ?? null;
  const today = isoDate(todayManila());
  const when = (iso: string) => `${relativeDay(manilaDate(iso), today)} ${timeLabel(iso)}`;

  const save = useCallback(async () => {
    setProblem(null);
    setSaved(null);
    const id = randomUUID();
    const built = buildExpense({ id, amountText: amount, merchant, accountId: account, categoryId });
    if ('error' in built) {
      setProblem(built.error);
      return;
    }
    setSaving(true);
    try {
      // Always queue first, then send: one path whether or not there is signal, and a retry can never double-save.
      await outbox.add(built.row);
      await syncNow();
      const stillWaiting = (await outbox.all()).some((q) => q.row.id === id);
      await refresh();
      setSaved(stillWaiting ? 'Saved on your phone. It will sync when you are back online.' : 'Saved.');
      setAmount('');
      setMerchant('');
      setCategoryId(null);
    } catch {
      setProblem('Could not save that. Try again.');
    } finally {
      setSaving(false);
    }
  }, [amount, merchant, account, categoryId, syncNow, refresh]);

  return (
    <Screen title="Quick add" refreshing={refreshing} onRefresh={reload}>
      {error ? <Notice tone="error">{error}</Notice> : null}
      {!data && !error ? <Notice>Loading…</Notice> : null}
      {data?.offline ? <Notice>You are offline. Accounts and categories are from the last time you were online.</Notice> : null}

      {queued.length > 0 ? (
        <Card>
          <Label>{queued.length} waiting to sync</Label>
          {queued.map((q) => (
            <View key={q.row.id} style={s.row}>
              <View style={{ flex: 1 }}>
                <Body>{q.row.merchant ?? 'Expense'}</Body>
                <Text style={{ color: q.lastError ? c.err : c.muted, fontFamily: fonts.body, fontSize: 12 }}>
                  {q.lastError ? `Rejected: ${q.lastError}` : when(q.row.occurred_at)}
                </Text>
              </View>
              <Amount value={money(q.row.amount)} />
              {q.lastError ? (
                <Pressable onPress={() => remove(q.row.id)} accessibilityRole="button" accessibilityLabel="Delete this expense" style={[s.small, { backgroundColor: c.soft }]}>
                  <Text style={{ color: c.ink, fontFamily: fonts.bodyBold, fontSize: 13 }}>Delete</Text>
                </Pressable>
              ) : null}
            </View>
          ))}
          <Pressable onPress={syncNow} disabled={syncing} accessibilityRole="button" style={[s.btn, { backgroundColor: c.soft, opacity: syncing ? 0.6 : 1 }]}>
            <Text style={{ color: c.ink, fontFamily: fonts.bodyBold, fontSize: 15 }}>{syncing ? 'Syncing…' : 'Sync now'}</Text>
          </Pressable>
        </Card>
      ) : null}

      {data && data.accounts.length === 0 ? (
        <Notice>Add an account first, then you can record spending against it.</Notice>
      ) : null}

      {data && data.accounts.length > 0 ? (
        <Card>
          <Label>Amount (₱)</Label>
          <TextInput
            value={amount}
            onChangeText={setAmount}
            placeholder="0.00"
            placeholderTextColor={c.muted}
            keyboardType="decimal-pad"
            accessibilityLabel="Amount in pesos"
            style={[s.amount, { color: c.ink, backgroundColor: c.soft, fontFamily: fonts.display }]}
          />
          <Label>Where</Label>
          <TextInput
            value={merchant}
            onChangeText={setMerchant}
            placeholder="Shop or note"
            placeholderTextColor={c.muted}
            maxLength={80}
            style={[s.input, { color: c.ink, backgroundColor: c.soft, fontFamily: fonts.body }]}
          />
          <Label>Account</Label>
          <View style={s.chips}>
            {data.accounts.map((a) => (
              <Chip key={a.id} label={a.name} on={a.id === account} onPress={() => setAccountId(a.id)} />
            ))}
          </View>
          <Label>Category</Label>
          <View style={s.chips}>
            <Chip label="No category" on={categoryId === null} onPress={() => setCategoryId(null)} />
            {data.categories.map((x) => (
              <Chip key={x.id} label={x.name} on={x.id === categoryId} onPress={() => setCategoryId(x.id)} />
            ))}
          </View>

          {problem ? <Text style={{ color: c.err, fontFamily: fonts.body, fontSize: 14 }}>{problem}</Text> : null}
          {saved ? <Text style={{ color: c.accentText, fontFamily: fonts.bodyBold, fontSize: 14 }}>{saved}</Text> : null}

          <Pressable onPress={save} disabled={saving} accessibilityRole="button" style={[s.btn, { backgroundColor: c.accent, opacity: saving ? 0.7 : 1 }]}>
            <Text style={{ color: c.onAccent, fontFamily: fonts.bodyBold, fontSize: 16 }}>{saving ? 'Saving…' : 'Save expense'}</Text>
          </Pressable>
        </Card>
      ) : null}
    </Screen>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 40, borderRadius: 999, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  amount: { minHeight: 64, borderRadius: 10, paddingHorizontal: 14, fontSize: 32 },
  input: { minHeight: 48, borderRadius: 10, paddingHorizontal: 14, fontSize: 15 },
  btn: { minHeight: 52, borderRadius: 999, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  small: { minHeight: 40, borderRadius: 999, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
});
