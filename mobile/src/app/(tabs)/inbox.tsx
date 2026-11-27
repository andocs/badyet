import * as Crypto from 'expo-crypto';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { isoDate } from '@/lib/domain/dates';
import { money } from '@/lib/domain/money';
import { relativeDay, timeLabel } from '@/lib/now/format';
import { paybackEffect, pesoText } from '@/lib/lending/forms';
import { dueChips, outstandingOf } from '@/lib/lending/model';
import { NO_SOURCE, sourceOfKey } from '@/lib/lending/sources';
import { confirmOthers, createLoan, recordPayback, type OtherWhat, type Result } from '@/lib/lending/write';
import { Choices, DateField, Effect, LendFields, lendingEnv, Muted, newDraft, SourcePicker, type LendDraft } from '~/components/Lending';
import { Field, Input } from '~/components/Sheet';
import { manilaDate } from '@/lib/now/summary';
import { todayManila } from '@/lib/plans/validate';
import { GmailBanner } from '~/components/GmailBanner';
import { HeldCard, useHeldAccounts } from '~/components/HeldCards';
import { InboxEditSheet } from '~/components/InboxEditSheet';
import { Amount, Body, Card, Label, Notice, Screen } from '~/components/ui';
import { useHeldItems } from '~/lib/CaptureRunner';
import { confirmTransaction, ignoreTransaction, loadInbox, type Category, type InboxData, type InboxTxn } from '~/lib/inbox';
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
  accounts,
  lending,
  onFile,
}: {
  lending: InboxData['lending'];
  /** Files the item as lending, a payback or a transfer to someone else. */
  onFile: (t: InboxTxn, run: () => Promise<Result>) => void;
  accounts: { id: string; name: string }[];
  t: InboxTxn;
  categories: Category[];
  bills: { id: string; name: string }[];
  today: ReturnType<typeof isoDate>;
  onConfirm: (t: InboxTxn, categoryId: string | null, rule: boolean, note: string, billId: string | null, asTransfer: boolean, otherAccountId: string | null) => void;
  onIgnore: (t: InboxTxn) => void;
  onEdit: (t: InboxTxn) => void;
}) {
  const c = useTheme();
  // With Transfer picked: the account on the other side, when only this side sent a message.
  // A capture rule that sends money to someone else has already picked Transfer and Others.
  const presetOthers = t.amount < 0 && !!t.otherOwner && t.peerAccount === null;
  const [otherId, setOtherId] = useState<string | null>(presetOthers ? 'others' : null);
  const [categoryId, setCategoryId] = useState<string | null>(t.categoryId);
  const [rule, setRule] = useState(t.guess === 'rule');
  const [note, setNote] = useState(t.note ?? '');
  const [billId, setBillId] = useState<string | null>(null);
  // "Transfer" is a button, not a category: a move between your own accounts.
  const [asT, setAsT] = useState(presetOthers);
  const isTransfer = t.kind === 'transfer';
  // Lending: money out can be "Lending", money in can be a "Loan payback", and a transfer can go to "Others".
  const [loanMode, setLoanMode] = useState(false);
  const [draft, setDraft] = useState<LendDraft | null>(null);
  const [loanId, setLoanId] = useState<string | null>(null);
  const [rest, setRest] = useState<string | null>(null);
  const [owner, setOwner] = useState(t.otherOwner ?? '');
  const [what, setWhat] = useState<OtherWhat | null>(null);
  const openLoans = lending?.openLoans ?? [];
  const lend = lending && !isTransfer && loanMode && t.amount < 0 ? lending.lend : null;
  const loan = lending && !isTransfer && loanMode && t.amount > 0
    ? (openLoans.find((l) => l.id === loanId) ?? openLoans.find((l) => outstandingOf(l) === t.amount) ?? openLoans.find((l) => outstandingOf(l) >= t.amount) ?? openLoans[0] ?? null)
    : null;
  const toOthers = lending && !isTransfer && asT && t.amount < 0 && otherId === 'others' ? lending.lend : null;
  const lendDraft = lending ? (draft ?? newDraft(lending.lend)) : null;
  const restDue = rest ?? (lending ? dueChips(lending.lend.today, lending.lend.paydays).find((d) => d.date > lending.lend.today)!.date : '');
  const special = loanMode || toOthers !== null;
  const chosen = categories.find((x) => x.id === categoryId)?.name;
  // A transfer-looking item waits a few minutes for its other side; meanwhile it can only be filed as a Transfer.
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    if (!t.holdUntil) return;
    const timer = setInterval(() => setNowMs(Date.now()), 15_000);
    return () => clearInterval(timer);
  }, [t.holdUntil]);
  const holding = t.holdUntil !== null && Date.parse(t.holdUntil) > nowMs;
  const canConfirm = lend
    ? lendDraft!.borrower.trim() !== '' && lendDraft!.dueOn !== ''
    : loan
      ? t.amount <= outstandingOf(loan)
      : toOthers
        ? owner.trim() !== '' && what !== null && (what !== 'spending' || categoryId !== null) && (what !== 'loan' || lendDraft!.dueOn !== '')
        : isTransfer || asT || (categoryId !== null && !holding);
  const confirmLabel = lend ? 'Confirm loan' : loan ? 'Confirm payback' : 'Confirm';
  const confirm = () => {
    if (lend) return onFile(t, () => createLoan(supabase, { txnId: t.id, borrower: lendDraft!.borrower, dueOn: lendDraft!.dueOn, from: sourceOfKey(lendDraft!.fromKey), note }, lendingEnv()));
    if (loan) return onFile(t, () => recordPayback(supabase, { loanId: loan.id, txnId: t.id, nextDue: t.amount < outstandingOf(loan) ? restDue : null }, lendingEnv()));
    if (toOthers)
      return onFile(t, () =>
        confirmOthers(supabase, { txnId: t.id, note, owner, what: what!, dueOn: lendDraft!.dueOn, categoryId: what === 'spending' ? categoryId : null, from: sourceOfKey(what === 'spending' ? NO_SOURCE : lendDraft!.fromKey) }, lendingEnv()),
      );
    onConfirm(t, isTransfer || asT ? null : categoryId, rule && !isTransfer && !asT, note, isTransfer || asT ? null : billId, asT, asT && otherId !== 'others' ? otherId : null);
  };

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
            <Chip label="↔ Transfer" on={asT} onPress={() => { setLoanMode(false); setAsT((v) => !v); }} />
            {lending && (t.amount < 0 || openLoans.length > 0) ? (
              <Chip label={t.amount < 0 ? 'Lending' : 'Loan payback'} on={loanMode} onPress={() => { setAsT(false); setLoanMode((v) => !v); }} />
            ) : null}
            {categories.map((x) => (
              <Chip key={x.id} label={x.name} on={!asT && !loanMode && x.id === categoryId} onPress={() => { setAsT(false); setLoanMode(false); setCategoryId(x.id); }} />
            ))}
          </View>
          {asT ? (
            <View style={{ gap: 6 }}>
              <Text style={{ color: c.muted, fontFamily: fonts.bodyBold, fontSize: 12 }}>{t.amount < 0 ? 'Other account (where it arrived)' : 'Other account (where it came from)'}</Text>
              <View style={s.chips}>
                <Chip label="Only this side" on={otherId === null} onPress={() => setOtherId(null)} />
                {accounts.filter((a) => a.id !== t.accountId).map((a) => (
                  <Chip key={a.id} label={a.name} on={otherId === a.id} onPress={() => setOtherId(a.id)} />
                ))}
                {lending && t.amount < 0 ? <Chip label="Others (someone else's account)" on={otherId === 'others'} onPress={() => setOtherId('others')} /> : null}
              </View>
              {otherId === 'others' ? null : <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 12 }}>Pick one to add the other side too, if it did not send its own message.</Text>}
            </View>
          ) : null}
          {toOthers ? (
            <View style={{ gap: 10 }}>
              <Field label="Whose account is it?">
                <Input value={owner} onChangeText={setOwner} maxLength={80} placeholder="Name, bank and last digits" accessibilityLabel="Whose account is it" />
              </Field>
              <Choices label="What is this?" options={[{ key: 'loan', label: 'A loan' }, { key: 'spending', label: 'Spending' }, { key: 'none', label: 'Not spending' }]} value={what} onPick={(k) => setWhat(k as OtherWhat)} />
              {what === 'loan' ? <LendFields ctx={toOthers} draft={{ ...lendDraft!, borrower: owner }} onChange={setDraft} amount={Math.abs(t.amount)} askWho={false} /> : null}
              {what === 'spending' ? (
                <>
                  <Choices label="Counts against" options={categories.filter((x) => x.name !== 'Credit card payment').map((x) => ({ key: x.id, label: x.name }))} value={categoryId} onPick={setCategoryId} />
                  {chosen ? <Muted>{pesoText(t.amount)} counts as spending in {chosen}.</Muted> : null}
                </>
              ) : null}
              {what === 'none' ? <SourcePicker ctx={toOthers} value={lendDraft!.fromKey} onChange={(fromKey) => setDraft({ ...lendDraft!, fromKey })} label="Take it from (optional)" /> : null}
            </View>
          ) : null}
          {lend ? <LendFields ctx={lend} draft={lendDraft!} onChange={setDraft} amount={Math.abs(t.amount)} /> : null}
          {loan ? (
            <View style={{ gap: 10 }}>
              <Choices label="Whose payback?" options={openLoans.map((l) => ({ key: l.id, label: `${l.borrower} · ${pesoText(outstandingOf(l))} owed` }))} value={loan.id} onPick={setLoanId} />
              {t.amount < outstandingOf(loan) ? <DateField label={`When will the other ${pesoText(outstandingOf(loan) - t.amount)} come?`} value={restDue} onChange={setRest} ctx={lending!.lend} /> : null}
              <Effect>
                {t.amount > outstandingOf(loan)
                  ? `This is more than ${loan.borrower} still owes (${pesoText(outstandingOf(loan))}).`
                  : paybackEffect(loan.from, t.amount, outstandingOf(loan), loan.borrower, t.amount < outstandingOf(loan) && /^\d{4}-\d{2}-\d{2}$/.test(restDue) ? restDue : null)}
              </Effect>
            </View>
          ) : null}
          {holding && !special ? (
            <Text accessibilityRole="alert" style={{ color: c.ink, fontFamily: fonts.body, fontSize: 13 }}>
              May be a transfer: waiting for the other side until {timeLabel(t.holdUntil!)}. Tap Transfer now, or confirm it as {t.amount < 0 ? 'spending' : 'income'} after that.
            </Text>
          ) : null}
          {!special && t.guess && categoryId === t.categoryId ? (
            <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 12 }}>
              Suggested from {t.guess === 'rule' ? 'your rule' : 'what you did before'}.
            </Text>
          ) : null}
          {!special && chosen && t.who !== 'Expense' ? (
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

      {!isTransfer && !special && t.amount < 0 && bills.length > 0 ? (
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
          onPress={confirm}
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
            {canConfirm ? confirmLabel : special ? 'Fill in the details' : holding && categoryId !== null ? 'Waiting for the other side' : 'Pick a category'}
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
                accounts={data.accounts}
                bills={data.bills}
                lending={data.lending}
                onFile={(row, run) => void act(row, 'confirm', run)}
                today={today}
                onConfirm={(row, categoryId, rule, note, billId, asTransfer, otherAccountId) =>
                  act(row, 'confirm', () =>
                    confirmTransaction(supabase, {
                      id: row.id,
                      categoryId,
                      rule,
                      note,
                      billId,
                      asTransfer,
                      otherAccountId,
                      newId: Crypto.randomUUID(),
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
                    {t.status === 'pending' ? ' · to check' : t.loanTag ? ` · ${t.loanTag}` : t.otherOwner ? ` · to ${t.otherOwner} (others)` : t.categoryName ? ` · ${t.categoryName}` : ''}
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
          categories={data.categories}
          lending={data.lending}
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
