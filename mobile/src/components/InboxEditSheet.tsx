import { useState } from 'react';
import { Text, View } from 'react-native';
import { editTransaction, manilaFields } from '@/lib/inbox/edit';
import { parsePesos } from '@/lib/domain/money';
import { editLending, loanOfTxn, pesoText, withSource, type Filed } from '@/lib/lending/forms';
import { dueChips, outstandingOf } from '@/lib/lending/model';
import { sourceKey } from '@/lib/lending/sources';
import { Choices, DateField, LendFields, lendingEnv, Muted, newDraft, type LendDraft } from '~/components/Lending';
import { DateInput } from '~/components/DateInput';
import { Chip } from '~/components/ui';
import { Field, Input, Sheet, SheetActions } from '~/components/Sheet';
import type { InboxData, InboxTxn } from '~/lib/inbox';
import { supabase } from '~/lib/supabase';
import { fonts, useTheme } from '~/lib/theme';

/**
 * Change an Inbox item: its name, amount, direction, account, date and time, note and how it is filed. A move between your accounts keeps
 * its two accounts. A loan or payback keeps its loan in step.
 */
export function InboxEditSheet({ t, accounts, categories, lending, onClose, onSaved }: { t: InboxTxn; accounts: { id: string; name: string }[]; categories: { id: string; name: string }[]; lending: InboxData['lending']; onClose: () => void; onSaved: () => void }) {
  const c = useTheme();
  const when = manilaFields(t.occurredAt);
  const [merchant, setMerchant] = useState(t.who === 'Expense' || /^Transfer (in|out)$/.test(t.who) ? '' : t.who);
  const [amount, setAmount] = useState((Math.abs(t.amount) / 100).toFixed(2));
  const [direction, setDirection] = useState<'in' | 'out'>(t.amount < 0 ? 'out' : 'in');
  const [accountId, setAccountId] = useState(t.accountId);
  const [categoryId, setCategoryId] = useState<string | null>(t.categoryId ?? null);
  const [date, setDate] = useState(when.date);
  const [time, setTime] = useState(when.time);
  const [note, setNote] = useState(t.note ?? '');
  const [otherOwner, setOtherOwner] = useState(t.otherOwner ?? '');
  const paired = !!t.peerAccount;
  const link = lending && !paired ? loanOfTxn(lending.loans, t.id) : null;
  const [filed, setFiled] = useState<Filed>(link ? (link.role === 'lent' ? 'loan' : 'payback') : 'normal');
  const [draft, setDraft] = useState<LendDraft | null>(() => (link?.role === 'lent' ? { borrower: link.loan.borrower, dueOn: link.loan.dueOn, fromKey: sourceKey(link.loan.from) } : null));
  const [loanId, setLoanId] = useState(link?.role === 'payback' ? link.loan.id : '');
  const [restDue, setRestDue] = useState<string | null>(null);
  // A transfer taken out of its loan becomes ordinary money again, so it gets a direction and a category.
  const isTransfer = t.kind === 'transfer' && !(link && filed === 'normal');
  const shownDirection = filed === 'loan' ? 'out' : filed === 'payback' ? 'in' : isTransfer ? (t.amount < 0 ? 'out' : 'in') : direction;
  // Money out with no other account of yours on the far side may have gone to someone else.
  const askOwner = !paired && shownDirection === 'out' && filed !== 'loan';

  // The loans a payback can be for: those still owed, and the one it already belongs to.
  const payable = lending ? [...(link?.role === 'payback' && !lending.openLoans.some((l) => l.id === link.loan.id) ? [link.loan] : []), ...lending.openLoans] : [];
  const chosen = payable.find((l) => l.id === loanId) ?? payable[0] ?? null;
  const sameLoan = link?.role === 'payback' && chosen?.id === link.loan.id;
  const centavos = parsePesos(amount.trim()) ?? null;
  const owed = chosen ? outstandingOf(chosen) : 0;
  const rest = filed === 'payback' && !sameLoan && centavos !== null && centavos < owed ? owed - centavos : 0;
  const nextDue = restDue ?? (lending ? dueChips(lending.lend.today, lending.lend.paydays).find((d) => d.date > lending.lend.today)!.date : '');
  const loanDraft = lending ? (draft ?? newDraft(lending.lend)) : null;
  const choices: { key: Filed; label: string }[] = [{ key: 'normal', label: 'Not a loan' }, ...(shownDirection === 'out' ? [{ key: 'loan' as const, label: 'Lending' }] : payable.length > 0 ? [{ key: 'payback' as const, label: 'Loan payback' }] : [])];
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    setProblem(null);
    const about = lending && !paired ? editLending(filed, link !== null, loanDraft!, { loanId: chosen?.id ?? '', nextDue: rest > 0 ? nextDue : null }) : undefined;
    const r = await editTransaction(supabase, { id: t.id, merchant, amount, direction: shownDirection, accountId, categoryId: isTransfer || filed !== 'normal' ? undefined : categoryId, date, time, note, ...(askOwner && otherOwner.trim() !== (t.otherOwner ?? '') ? { otherOwner } : {}), ...(about ? { lending: about } : {}) }, lendingEnv());
    setBusy(false);
    if ('error' in r) setProblem(r.error);
    else onSaved();
  };

  return (
    <Sheet title="Edit item" onClose={onClose}>
      <Field label="Name">
        <Input value={merchant} onChangeText={setMerchant} maxLength={80} placeholder="Who it was with" />
      </Field>
      <Field label="Amount (₱)">
        <Input value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
      </Field>
      {isTransfer || filed !== 'normal' ? null : (
        <Field label="Money">
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Chip label="Went out" on={direction === 'out'} onPress={() => setDirection('out')} />
            <Chip label="Came in" on={direction === 'in'} onPress={() => setDirection('in')} />
          </View>
        </Field>
      )}
      {paired ? (
        <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 13 }}>A move between your accounts keeps both sides, so the amount, time and note change on both.</Text>
      ) : (
        <Field label="Account">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {accounts.map((a) => (
              <Chip key={a.id} label={a.name} on={accountId === a.id} onPress={() => setAccountId(a.id)} />
            ))}
          </View>
        </Field>
      )}
      {lending && !paired && choices.length > 1 ? <Choices label="Lending" options={choices} value={filed} onPick={(k) => setFiled(k as Filed)} /> : null}
      {link ? (
        <Muted>
          {filed === 'normal'
            ? link.role === 'lent'
              ? 'Saving removes this loan. One that has paybacks has to be removed on the Lending page.'
              : 'Saving removes this payback, so the money is owed again.'
            : 'This is part of a loan: a new amount or date changes the loan too. The rest is under More, then Lending.'}
        </Muted>
      ) : null}
      {lending && filed === 'loan' ? (
        <LendFields ctx={link?.role === 'lent' ? { ...lending.lend, sources: withSource(lending.lend.sources, link.loan.from) } : lending.lend} draft={loanDraft!} onChange={setDraft} amount={centavos} minDue={date} />
      ) : null}
      {lending && filed === 'payback' && chosen ? (
        <>
          <Choices label="Whose payback?" options={payable.map((l) => ({ key: l.id, label: outstandingOf(l) > 0 ? `${l.borrower} · ${pesoText(outstandingOf(l))} still owed` : `${l.borrower} · paid` }))} value={chosen.id} onPick={setLoanId} />
          {rest > 0 ? <DateField label={`When will the other ${pesoText(rest)} come?`} value={nextDue} onChange={setRestDue} ctx={lending.lend} /> : null}
        </>
      ) : null}
      {isTransfer || filed !== 'normal' ? null : (
        <Field label="Category">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <Chip label="None" on={categoryId === null} onPress={() => setCategoryId(null)} />
            {categories.map((k) => (
              <Chip key={k.id} label={k.name} on={categoryId === k.id} onPress={() => setCategoryId(k.id)} />
            ))}
          </View>
        </Field>
      )}
      {askOwner ? (
        <Field label="Others: whose account did it go to? (optional)">
          <Input value={otherOwner} onChangeText={setOtherOwner} maxLength={80} placeholder="Only for someone else's account" />
        </Field>
      ) : null}
      <Field label="Date">
        <DateInput label="Date" value={date} onChange={setDate} />
      </Field>
      <Field label="Time (24-hour, Philippine time)">
        <Input value={time} onChangeText={setTime} keyboardType="numbers-and-punctuation" placeholder="10:02" />
      </Field>
      <Field label="Note">
        <Input value={note} onChangeText={setNote} maxLength={200} placeholder="Add a note (optional)" />
      </Field>
      <SheetActions onClose={onClose} onSave={() => void save()} busy={busy} saveLabel="Save changes" problem={problem} />
    </Sheet>
  );
}
