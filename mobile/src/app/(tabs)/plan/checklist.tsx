import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { restOf, type ChecklistLineOut, type WalletOut } from '@/lib/bills/checklist';
import { loadChecklist, type ChecklistData } from '@/lib/bills/load';
import { cancelTransfer, markBillSent, sendLump, undoBillSent } from '@/lib/bills/send';
import { setLineWallet, setPayAccount } from '@/lib/bills/settings';
import { money } from '@/lib/domain/money';
import type { PayCutoff } from '@/lib/engine/types';
import { Amount, Body, Card, Chip, Label, Notice, Screen, Tick } from '~/components/ui';
import { useHide } from '~/lib/hide';
import { peso } from '~/lib/money';
import { supabase } from '~/lib/supabase';
import { fonts, useTheme } from '~/lib/theme';
import { useLoad } from '~/lib/useLoad';

type Ready = Extract<ChecklistData, { kind: 'ready' }>;
const HOW: Record<string, string> = { covered: 'covered by a transfer', payroll: 'already in your payroll account', ticked: 'sent' };

/** The pay checklist: each wallet's lines with a tick, "Send the rest" for a wallet; transfers the app spots tick lines by themselves. */
export default function Checklist() {
  const c = useTheme();
  const { hide } = useHide();
  const [cutoff, setCutoff] = useState<PayCutoff | undefined>(undefined);
  const { data, error, refreshing, reload } = useLoad(() => loadChecklist(supabase, cutoff));
  // Another cutoff tab: load it (the loader above already reads the new choice).
  useEffect(() => {
    if (cutoff !== undefined) void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cutoff]);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(fn: () => Promise<{ ok: true } | { error: string }>) {
    setBusy(true);
    setProblem(null);
    const r = await fn();
    setBusy(false);
    if ('error' in r) setProblem(r.error);
    else await reload();
  }

  return (
    <Screen title="Pay checklist" refreshing={refreshing} onRefresh={reload}>
      {error ? <Notice tone="error">{error}</Notice> : null}
      {problem ? <Notice tone="error">{problem}</Notice> : null}
      {!data && !error ? <Notice>Loading…</Notice> : null}
      {data?.kind === 'setup' ? <Notice>No salary on file yet. Add your salary under Salary and tax first.</Notice> : null}
      {data?.kind === 'ready' ? (
        <Body2 data={data} cutoff={cutoff ?? data.cutoff} setCutoff={setCutoff} busy={busy} run={run} hide={hide} c={c} />
      ) : null}
    </Screen>
  );
}

function Body2({ data, cutoff, setCutoff, busy, run, hide, c }: { data: Ready; cutoff: PayCutoff; setCutoff: (c: PayCutoff) => void; busy: boolean; run: (fn: () => Promise<{ ok: true } | { error: string }>) => Promise<void>; hide: boolean; c: ReturnType<typeof useTheme> }) {
  const { checklist, payrollId, accounts } = data;
  const name = (id: string) => accounts.find((a) => a.id === id)?.name ?? 'Account';
  const pct = checklist.total > 0 ? Math.min(100, (checklist.sent / checklist.total) * 100) : 0;

  const tick = (l: ChecklistLineOut) => {
    if (!payrollId) return Alert.alert('Pick the account your pay lands in first.');
    if (l.how === 'ticked' && l.txnId) return void run(() => undoBillSent(supabase, l.txnId!));
    if (!l.sent) void run(() => markBillSent(supabase, { lineId: l.id, from: payrollId, amount: (l.amount / 100).toFixed(2) }));
  };

  return (
    <>
      <View style={s.chips}>
        <Chip label={`1st cutoff${data.currentCutoff === 'first' ? ' (now)' : ''}`} on={cutoff === 'first'} onPress={() => setCutoff('first')} />
        <Chip label={`2nd cutoff${data.currentCutoff === 'second' ? ' (now)' : ''}`} on={cutoff === 'second'} onPress={() => setCutoff('second')} />
      </View>

      <Card>
        <Label>Send from</Label>
        <View style={s.chips}>
          {accounts.map((a) => (
            <Chip key={a.id} label={a.name} on={payrollId === a.id} onPress={() => void run(() => setPayAccount(supabase, a.id))} />
          ))}
        </View>
        <View style={s.between}>
          <Body bold>
            {checklist.sentCount} of {checklist.lineCount} sent
          </Body>
          <Text style={{ color: c.ink, fontFamily: fonts.bodyBold, fontSize: 14 }}>
            {peso(checklist.sent, hide)} of {peso(checklist.total, hide)}
          </Text>
        </View>
        <View style={[s.track, { backgroundColor: c.soft }]}>
          <View style={{ width: `${pct}%`, height: 8, borderRadius: 4, backgroundColor: c.accent }} />
        </View>
        <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 12 }}>
          Tick a line when it is sent: the transfer is recorded and your balances move. Transfers the app spots in your notifications and emails tick lines by themselves.
        </Text>
      </Card>

      {checklist.wallets.length === 0 ? <Notice>No budget line has a wallet yet. Pick a wallet for a line below and it shows up here.</Notice> : null}
      {checklist.wallets.map((w) => (
        <Wallet key={w.walletId} w={w} name={name(w.walletId)} payrollId={payrollId} busy={busy} hide={hide} c={c} onTick={tick} run={run} />
      ))}

      {data.unassigned.length > 0 ? (
        <Card>
          <Label>No wallet yet</Label>
          <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 12 }}>Tap a wallet for each line; it is remembered on the budget line.</Text>
          {data.unassigned.map((l) => (
            <View key={l.id} style={{ gap: 6, paddingVertical: 6 }}>
              <View style={s.between}>
                <Body>{l.name}</Body>
                <Amount value={money(l.amount)} />
              </View>
              <View style={s.chips}>
                {accounts.map((a) => (
                  <Chip key={a.id} label={a.name} on={false} onPress={() => void run(() => setLineWallet(supabase, l.id, a.id))} />
                ))}
              </View>
            </View>
          ))}
        </Card>
      ) : null}
    </>
  );
}

function Wallet({ w, name, payrollId, busy, hide, c, onTick, run }: { w: WalletOut; name: string; payrollId: string | null; busy: boolean; hide: boolean; c: ReturnType<typeof useTheme>; onTick: (l: ChecklistLineOut) => void; run: (fn: () => Promise<{ ok: true } | { error: string }>) => Promise<void> }) {
  const isPayroll = w.walletId === payrollId;
  const rest = restOf(w);
  const sentCount = w.lines.filter((l) => l.sent).length;
  const pct = w.total > 0 ? Math.min(100, (w.sent / w.total) * 100) : 0;
  return (
    <Card>
      <View style={s.between}>
        <Text style={{ color: c.ink, fontFamily: fonts.display, fontSize: 18 }}>
          {name}
          {isPayroll ? '  · payroll' : ''}
        </Text>
        <Amount value={w.total} />
      </View>
      <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 12 }}>
        {sentCount} of {w.lines.length} sent · {peso(w.sent, hide)} of {peso(w.total, hide)}
      </Text>
      <View style={[s.track, { backgroundColor: c.soft }]}>
        <View style={{ width: `${pct}%`, height: 8, borderRadius: 4, backgroundColor: c.accent }} />
      </View>
      {w.lines.map((l) => {
        const locked = l.sent && l.how !== 'ticked';
        return (
          <Pressable
            key={l.id}
            onPress={() => onTick(l)}
            disabled={busy || locked}
            accessibilityRole="button"
            accessibilityLabel={l.sent ? `${l.name}: ${HOW[l.how ?? 'ticked']}${l.how === 'ticked' ? '. Tap to undo' : ''}` : `Mark ${l.name} sent`}
            style={[s.line, { borderTopColor: c.line }]}
          >
            <Tick on={l.sent} size={28} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: l.sent ? c.muted : c.ink, fontFamily: fonts.bodyBold, fontSize: 15, textDecorationLine: l.sent ? 'line-through' : 'none' }}>{l.name}</Text>
              {l.reimbursed || l.pending ? (
                <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 12 }}>{[l.reimbursed ? 'reimbursed later' : null, l.pending ? 'confirm in Inbox' : null].filter(Boolean).join(' · ')}</Text>
              ) : null}
            </View>
            <Amount value={l.amount} style={{ color: l.sent ? c.muted : c.ink }} />
          </Pressable>
        );
      })}
      {w.unmatched > 0 ? (
        <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 12 }}>
          {peso(w.unmatched, hide)} reached {name} from your payroll account but does not add up to the next line, so no line is ticked for it.
        </Text>
      ) : null}
      {!isPayroll && rest.amount > 0 ? (
        <Pressable
          onPress={() => payrollId && void run(() => sendLump(supabase, { from: payrollId, to: w.walletId, amount: rest.amount }))}
          disabled={busy || !payrollId}
          accessibilityRole="button"
          style={[s.btn, { backgroundColor: w.sent === 0 ? c.accent : c.soft, opacity: busy || !payrollId ? 0.6 : 1 }]}
        >
          <Text style={{ color: w.sent === 0 ? c.onAccent : c.ink, fontFamily: fonts.bodyBold, fontSize: 14 }}>
            {w.sent === 0 ? 'Send all' : 'Send the rest'} {peso(rest.amount, hide)}
          </Text>
        </Pressable>
      ) : null}
      {w.lumps.map((t) => (
        <View key={t.id} style={s.between}>
          <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 12 }}>
            Transfer {peso(t.amount, hide)}
            {t.pending ? ' (waiting in Inbox)' : ''}
          </Text>
          <Pressable
            onPress={() => void run(() => cancelTransfer(supabase, t.id))}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="Undo this transfer"
            style={{ minHeight: 36, justifyContent: 'center' }}
          >
            <Text style={{ color: c.accentText, fontFamily: fonts.bodyBold, fontSize: 13 }}>Undo</Text>
          </Pressable>
        </View>
      ))}
    </Card>
  );
}

const s = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  line: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, borderTopWidth: 1 },
  btn: { minHeight: 44, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
});
