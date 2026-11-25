import { useState } from 'react';
import { Text, View } from 'react-native';
import { editTransaction, manilaFields } from '@/lib/inbox/edit';
import { Chip } from '~/components/ui';
import { Field, Input, Sheet, SheetActions } from '~/components/Sheet';
import type { InboxTxn } from '~/lib/inbox';
import { supabase } from '~/lib/supabase';
import { fonts, useTheme } from '~/lib/theme';

/** Change an Inbox item: its name, amount, direction, account, date and time, and note. A transfer keeps its two accounts. */
export function InboxEditSheet({ t, accounts, onClose, onSaved }: { t: InboxTxn; accounts: { id: string; name: string }[]; onClose: () => void; onSaved: () => void }) {
  const c = useTheme();
  const when = manilaFields(t.occurredAt);
  const isTransfer = t.kind === 'transfer';
  const [merchant, setMerchant] = useState(t.who === 'Expense' || /^Transfer (in|out)$/.test(t.who) ? '' : t.who);
  const [amount, setAmount] = useState((Math.abs(t.amount) / 100).toFixed(2));
  const [direction, setDirection] = useState<'in' | 'out'>(t.amount < 0 ? 'out' : 'in');
  const [accountId, setAccountId] = useState(t.accountId);
  const [date, setDate] = useState(when.date);
  const [time, setTime] = useState(when.time);
  const [note, setNote] = useState(t.note ?? '');
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    setProblem(null);
    const r = await editTransaction(supabase, { id: t.id, merchant, amount, direction, accountId, date, time, note });
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
      {isTransfer ? (
        <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 13 }}>A move between your accounts keeps both sides, so the amount, time and note change on both.</Text>
      ) : (
        <>
          <Field label="Money">
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Chip label="Went out" on={direction === 'out'} onPress={() => setDirection('out')} />
              <Chip label="Came in" on={direction === 'in'} onPress={() => setDirection('in')} />
            </View>
          </Field>
          <Field label="Account">
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {accounts.map((a) => (
                <Chip key={a.id} label={a.name} on={accountId === a.id} onPress={() => setAccountId(a.id)} />
              ))}
            </View>
          </Field>
        </>
      )}
      <Field label="Date (YYYY-MM-DD)">
        <Input value={date} onChangeText={setDate} keyboardType="numbers-and-punctuation" placeholder="2026-11-25" />
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
