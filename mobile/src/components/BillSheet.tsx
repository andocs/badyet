import { useState } from 'react';
import { Text, View } from 'react-native';
import { markBillSent } from '@/lib/bills/send';
import type { Bill } from '@/lib/now/summary';
import { Chip } from '~/components/ui';
import { Field, Input, Sheet, SheetActions } from '~/components/Sheet';
import { supabase } from '~/lib/supabase';
import { fonts, useTheme } from '~/lib/theme';

/** Mark a bill sent: which account paid it, and how much (starts at the bill's amount). The money really moves. */
export function BillSheet({ bill, accounts, onClose, onSaved }: { bill: Bill; accounts: { id: string; name: string }[]; onClose: () => void; onSaved: () => void }) {
  const c = useTheme();
  const [from, setFrom] = useState<string | null>(null);
  const [amount, setAmount] = useState((bill.amount / 100).toFixed(2));
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!from) return setProblem('Pick the account it was paid from.');
    setBusy(true);
    const r = await markBillSent(supabase, { lineId: bill.lineId, from, amount });
    setBusy(false);
    if ('error' in r) return setProblem(r.error);
    onSaved();
  };

  return (
    <Sheet title={`Mark ${bill.name} sent`} onClose={onClose}>
      <Field label="Paid from">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {accounts.map((a) => (
            <Chip key={a.id} label={a.id === bill.accountId ? `${a.name} (its own)` : a.name} on={from === a.id} onPress={() => setFrom(a.id)} />
          ))}
        </View>
      </Field>
      <Field label="Amount (₱)">
        <Input value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
      </Field>
      <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 13 }}>
        {from === null ? 'Balances change when you save.' : from === bill.accountId ? 'Saved as spending from that account, in the bill’s category.' : 'Saved as a transfer into the bill’s account.'}
      </Text>
      <SheetActions onClose={onClose} onSave={() => void save()} busy={busy} saveLabel="Mark sent" problem={problem} />
    </Sheet>
  );
}
