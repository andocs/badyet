import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { money, parsePesos, sum } from '@/lib/domain/money';
import { loadLendingContext } from '@/lib/lending/context';
import { dueBadge, historyRows, loanLine, pesoText } from '@/lib/lending/forms';
import { dueLoans, outstandingOf, postponedTimes, sortLoans, type Loan } from '@/lib/lending/model';
import { sourceOfKey } from '@/lib/lending/sources';
import { createLoan, removeLoan } from '@/lib/lending/write';
import { relativeDay } from '@/lib/now/format';
import { manilaDate } from '@/lib/now/summary';
import { DateInput } from '~/components/DateInput';
import { Choices, LendFields, LoanActions, lendingEnv, newDraft, type LendDraft } from '~/components/Lending';
import { Field, Input, Sheet, SheetActions } from '~/components/Sheet';
import { Amount, Body, Card, Chip, Notice, Screen } from '~/components/ui';
import { useHide } from '~/lib/hide';
import { peso } from '~/lib/money';
import { supabase } from '~/lib/supabase';
import { fonts, useTheme } from '~/lib/theme';
import { useLoad } from '~/lib/useLoad';

type Data = Awaited<ReturnType<typeof loadLendingContext>>;

/** Money lent by hand: cash, or something already recorded that the app did not file as a loan. */
function LendSheet({ data, onClose, onSaved }: { data: Data; onClose: () => void; onSaved: () => void }) {
  const [draft, setDraft] = useState<LendDraft>(() => newDraft(data.lend));
  const [recorded, setRecorded] = useState('');
  const [amount, setAmount] = useState('');
  const [accountId, setAccountId] = useState(data.payback.accounts[0]?.id ?? '');
  const [date, setDate] = useState<string>(data.lend.today);
  const [note, setNote] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const picked = data.outgoing.find((o) => o.id === recorded);

  const save = async () => {
    setBusy(true);
    setProblem(null);
    const r = await createLoan(
      supabase,
      { borrower: draft.borrower, dueOn: draft.dueOn, from: sourceOfKey(draft.fromKey), note, ...(picked ? { txnId: picked.id } : { manual: { amount, accountId: accountId || null, date } }) },
      lendingEnv(),
    );
    setBusy(false);
    if ('error' in r) setProblem(r.error);
    else onSaved();
  };

  return (
    <Sheet title="Lend money" onClose={onClose}>
      {data.outgoing.length > 0 ? (
        <Choices
          label="Is it already recorded?"
          options={[{ key: '', label: 'No, add it now' }, ...data.outgoing.slice(0, 8).map((o) => ({ key: o.id, label: `${pesoText(o.amount)} · ${o.accountName} · ${relativeDay(manilaDate(o.occurredAt), data.lend.today)}` }))]}
          value={recorded}
          onPick={setRecorded}
        />
      ) : null}
      {picked ? null : (
        <>
          <Field label="Amount (₱)">
            <Input value={amount} onChangeText={setAmount} keyboardType="decimal-pad" accessibilityLabel="Amount" />
          </Field>
          <Field label="Lent on">
            <DateInput label="Lent on" value={date} onChange={setDate} max={data.lend.today} />
          </Field>
          <Choices label="Money left from" options={[...data.payback.accounts.map((a) => ({ key: a.id, label: a.name })), { key: '', label: 'Cash that no account tracks' }]} value={accountId} onPick={setAccountId} />
        </>
      )}
      <LendFields ctx={data.lend} draft={draft} onChange={setDraft} amount={picked ? -picked.amount : (parsePesos(amount.trim()) ?? null)} />
      <Field label="Note (optional)">
        <Input value={note} onChangeText={setNote} maxLength={200} accessibilityLabel="Note" />
      </Field>
      <SheetActions onClose={onClose} onSave={() => void save()} busy={busy} saveLabel="Save loan" problem={problem} />
    </Sheet>
  );
}

export default function Lending() {
  const c = useTheme();
  const { hide } = useHide();
  const { data, error, refreshing, reload } = useLoad(() => loadLendingContext(supabase));
  const [adding, setAdding] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const { open, paid } = sortLoans(data?.loans ?? []);
  const due = data ? dueLoans(data.loans, data.lend.today).length : 0;

  const remove = (l: Loan) =>
    Alert.alert('Remove this loan?', 'Entries added here are deleted. Ones from your bank go back to the Inbox.', [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          const r = await removeLoan(supabase, l.id);
          if ('error' in r) setProblem(r.error);
          else void reload();
        },
      },
    ]);

  const card = (l: Loan) => {
    const owed = outstandingOf(l);
    const badge = dueBadge(l, data!.lend.today);
    const times = postponedTimes(l);
    const shown = openId === l.id;
    return (
      <Card key={l.id}>
        <Pressable onPress={() => setOpenId(shown ? null : l.id)} accessibilityRole="button" accessibilityState={{ expanded: shown }} style={s.row}>
          <View style={{ flex: 1 }}>
            <Body bold>{l.borrower}</Body>
            <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 12 }}>{loanLine(l)}</Text>
            <Text style={{ color: owed === 0 ? c.accentText : badge.late ? c.gold : c.muted, fontFamily: fonts.bodyBold, fontSize: 12 }}>
              {owed === 0 ? 'Paid' : `${badge.text}${times > 0 ? ` · postponed ${times === 1 ? 'once' : `${times} times`}` : ''}`}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Amount value={money(owed > 0 ? owed : l.amount)} />
            {owed > 0 && owed < l.amount ? <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 12 }}>of {peso(l.amount, hide)}</Text> : null}
          </View>
        </Pressable>
        {shown ? (
          <View style={{ gap: 10 }}>
            {owed > 0 ? <LoanActions loan={l} ctx={data!.payback} onDone={() => void reload()} /> : null}
            {l.note ? <Body>{l.note}</Body> : null}
            {historyRows(l).map((h) => (
              <View key={h.key} style={[s.row, { borderTopWidth: 1, borderTopColor: c.line, paddingTop: 8 }]}>
                <Text style={{ flex: 1, color: c.ink, fontFamily: fonts.body, fontSize: 13 }}>{h.text}</Text>
                <Text style={{ color: h.amount !== null && h.amount > 0 ? c.accentText : c.ink, fontFamily: fonts.bodyBold, fontSize: 13 }}>
                  {h.amount === null ? h.side : `${h.amount > 0 ? '+' : '−'}${peso(money(Math.abs(h.amount)), hide)}`}
                </Text>
              </View>
            ))}
            <View style={{ flexDirection: 'row' }}>
              <Chip label="Remove loan (entered by mistake)" on={false} onPress={() => remove(l)} />
            </View>
          </View>
        ) : null}
      </Card>
    );
  };

  return (
    <Screen title="Lending" subtitle="Who owes you, and when it is due" refreshing={refreshing} onRefresh={reload}>
      {error ? <Notice tone="error">{error}</Notice> : null}
      {problem ? <Notice tone="error">{problem}</Notice> : null}
      {!data && !error ? <Notice>Loading…</Notice> : null}
      {data && !data.ready ? <Notice>Lending needs the latest database update (the rev-60 migration).</Notice> : null}
      {data?.ready ? (
        <>
          <Card>
            <Body bold>Owed to you</Body>
            <Amount value={sum(open.map(outstandingOf))} style={{ fontSize: 28 }} />
            <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 12 }}>
              {open.length === 0 ? 'Nothing is out right now.' : `${open.length} loan${open.length === 1 ? '' : 's'}${due ? ` · ${due} due` : ''}.`} Use Lend money for cash, or anything the app did not catch.
            </Text>
            <View style={{ flexDirection: 'row' }}>
              <Chip label="+ Lend money" on onPress={() => setAdding(true)} />
            </View>
          </Card>
          {open.map(card)}
          {paid.length > 0 ? <Body bold>Paid back</Body> : null}
          {paid.map(card)}
        </>
      ) : null}
      {adding && data ? (
        <LendSheet
          data={data}
          onClose={() => setAdding(false)}
          onSaved={() => {
            setAdding(false);
            void reload();
          }}
        />
      ) : null}
    </Screen>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
});
