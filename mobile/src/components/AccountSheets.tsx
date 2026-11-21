import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ACCOUNT_COLORS, ACCOUNT_KINDS, creditOwed, type AccountKind } from '@/lib/accounts/v13';
import { money, parsePesos } from '@/lib/domain/money';
import { Chip } from '~/components/ui';
import { Field, Input, Sheet, SheetActions } from '~/components/Sheet';
import type { AccountCard } from '~/lib/accounts';
import { addAccount, editAccount, moveMoney, reconcileAccount } from '~/lib/accountsWrite';
import { useHide } from '~/lib/hide';
import { peso } from '~/lib/money';
import { supabase } from '~/lib/supabase';
import { fonts, useTheme } from '~/lib/theme';

const KIND_LABEL: Record<AccountKind, string> = { debit: 'Debit', ewallet: 'E-wallet', savings: 'Savings', credit: 'Credit', cash: 'Cash' };

function useSave(onSaved: () => void) {
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<{ ok: true } | { error: string }>) => {
    setBusy(true);
    setProblem(null);
    const r = await fn();
    setBusy(false);
    if ('error' in r) setProblem(r.error);
    else onSaved();
  };
  return { problem, busy, run };
}

/** Type the balance your bank shows; the difference from the app's number is shown before you save. */
export function ReconcileSheet({ a, onClose, onSaved }: { a: AccountCard; onClose: () => void; onSaved: () => void }) {
  const c = useTheme();
  const { hide } = useHide();
  const [text, setText] = useState('');
  const { problem, busy, run } = useSave(onSaved);
  const owed = a.kind === 'credit';
  const shown = owed ? creditOwed(a.balance) : a.balance;
  const entered = text.trim() === '' ? undefined : parsePesos(text.trim());
  const diff = entered === undefined ? null : money(entered - shown);
  return (
    <Sheet title={`Reconcile ${a.name}`} onClose={onClose}>
      <Field label={owed ? 'Amount you owe now (₱)' : 'Real balance (₱)'}>
        <Input value={text} onChangeText={setText} keyboardType="decimal-pad" placeholder="1,250.50" />
      </Field>
      <View style={[s.calc, { backgroundColor: c.soft }]}>
        <Row left="Balance in the app" right={peso(shown, hide)} />
        {diff !== null ? <Row left="Difference" right={`${diff > 0 ? '+' : ''}${peso(diff, hide)}`} bold /> : null}
      </View>
      <SheetActions onClose={onClose} onSave={() => run(() => reconcileAccount(supabase, { accountId: a.id, balance: text }))} busy={busy} saveLabel="Reconcile" problem={problem} />
    </Sheet>
  );
}

export function MoveSheet({ accounts, from, onClose, onSaved }: { accounts: AccountCard[]; from: AccountCard; onClose: () => void; onSaved: () => void }) {
  const [fromId, setFromId] = useState(from.id);
  const [toId, setToId] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const { problem, busy, run } = useSave(onSaved);
  return (
    <Sheet title="Move money" onClose={onClose}>
      <Field label="From">
        <View style={s.chips}>
          {accounts.map((x) => (
            <Chip key={x.id} label={x.name} on={fromId === x.id} onPress={() => setFromId(x.id)} />
          ))}
        </View>
      </Field>
      <Field label="To">
        <View style={s.chips}>
          {accounts.filter((x) => x.id !== fromId).map((x) => (
            <Chip key={x.id} label={x.name} on={toId === x.id} onPress={() => setToId(x.id)} />
          ))}
        </View>
      </Field>
      <Field label="Amount (₱)">
        <Input value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0.00" />
      </Field>
      <SheetActions onClose={onClose} onSave={() => run(() => moveMoney(supabase, { from: fromId, to: toId ?? '', amount }))} busy={busy} saveLabel="Move" problem={problem} />
    </Sheet>
  );
}

function Swatches({ value, onPick }: { value: string; onPick: (c: string) => void }) {
  const c = useTheme();
  return (
    <View style={s.chips}>
      {ACCOUNT_COLORS.slice(0, 12).map((col) => (
        <Pressable
          key={col}
          onPress={() => onPick(col)}
          accessibilityRole="button"
          accessibilityLabel={`Colour ${col}`}
          accessibilityState={{ selected: value === col }}
          style={[s.swatch, { backgroundColor: col, borderColor: value === col ? c.ink : 'transparent' }]}
        />
      ))}
    </View>
  );
}

export function AddAccountSheet({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState('');
  const [kind, setKind] = useState<AccountKind>('debit');
  const [opening, setOpening] = useState('');
  const [last4, setLast4] = useState('');
  const [color, setColor] = useState<string>(ACCOUNT_COLORS[0]);
  const [limit, setLimit] = useState('');
  const { problem, busy, run } = useSave(onSaved);
  return (
    <Sheet title="Add account" onClose={onClose}>
      <Field label="Name">
        <Input value={name} onChangeText={setName} maxLength={30} placeholder="Bank" />
      </Field>
      <Field label="Kind">
        <View style={s.chips}>
          {ACCOUNT_KINDS.map((k) => (
            <Chip key={k} label={KIND_LABEL[k]} on={kind === k} onPress={() => setKind(k)} />
          ))}
        </View>
      </Field>
      <Field label={kind === 'credit' ? 'Amount you owe now (₱)' : 'Opening balance (₱)'}>
        <Input value={opening} onChangeText={setOpening} keyboardType="decimal-pad" placeholder="0.00" />
      </Field>
      {kind === 'credit' ? (
        <Field label="Credit limit (₱)">
          <Input value={limit} onChangeText={setLimit} keyboardType="decimal-pad" placeholder="50,000" />
        </Field>
      ) : null}
      <Field label="Last four digits (optional)">
        <Input value={last4} onChangeText={setLast4} keyboardType="number-pad" maxLength={4} placeholder="0000" />
      </Field>
      <Field label="Colour">
        <Swatches value={color} onPick={setColor} />
      </Field>
      <SheetActions
        onClose={onClose}
        onSave={() => run(() => addAccount(supabase, { name, kind, opening, last4, color, creditLimit: limit }))}
        busy={busy}
        saveLabel="Add"
        problem={problem}
      />
    </Sheet>
  );
}

export function EditAccountSheet({ a, onClose, onSaved }: { a: AccountCard; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(a.name);
  const [institution, setInstitution] = useState(a.institution ?? '');
  const [last4, setLast4] = useState(a.last4 ?? '');
  const [color, setColor] = useState(a.color);
  const { problem, busy, run } = useSave(onSaved);
  return (
    <Sheet title={`Edit ${a.name}`} onClose={onClose}>
      <Field label="Name">
        <Input value={name} onChangeText={setName} maxLength={30} />
      </Field>
      <Field label="Bank or wallet (optional)">
        <Input value={institution} onChangeText={setInstitution} maxLength={40} />
      </Field>
      <Field label="Last four digits">
        <Input value={last4} onChangeText={setLast4} keyboardType="number-pad" maxLength={4} />
      </Field>
      <Field label="Colour">
        <Swatches value={color} onPick={setColor} />
      </Field>
      <SheetActions onClose={onClose} onSave={() => run(() => editAccount(supabase, { id: a.id, name, institution, last4, color }))} busy={busy} problem={problem} />
    </Sheet>
  );
}

function Row({ left, right, bold }: { left: string; right: string; bold?: boolean }) {
  const c = useTheme();
  return (
    <View style={s.row}>
      <Text style={{ color: bold ? c.ink : c.muted, fontFamily: bold ? fonts.bodyBold : fonts.body, fontSize: 14 }}>{left}</Text>
      <Text style={{ color: c.ink, fontFamily: fonts.bodyBold, fontSize: 14 }}>{right}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  calc: { borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10, gap: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, paddingVertical: 4 },
  swatch: { width: 36, height: 36, borderRadius: 18, borderWidth: 3 },
});

