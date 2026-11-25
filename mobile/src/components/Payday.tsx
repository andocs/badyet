import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { Money } from '@/lib/domain/money';
import { recordPay, saveNowCategories } from '@/lib/pay/payday';
import { Body, Card, Chip } from '~/components/ui';
import { Field, Input, Sheet, SheetActions } from '~/components/Sheet';
import { useHide } from '~/lib/hide';
import { peso } from '~/lib/money';
import { supabase } from '~/lib/supabase';
import { fonts, useTheme } from '~/lib/theme';

/** "Has the pay arrived?": records this cutoff's take-home as income on the account it went into (remembered for next time). */
export function PaydayCard({ payday, accounts, onSaved }: {
  payday: { amount: Money; cutoff: 'first' | 'second'; bonuses: string[]; accountId: string | null };
  accounts: { id: string; name: string; kind: string }[];
  onSaved: () => void;
}) {
  const c = useTheme();
  const { hide } = useHide();
  const [hidden, setHidden] = useState(false);
  const [account, setAccount] = useState<string | null>(payday.accountId);
  const [typed, setTyped] = useState(payday.bonuses.length > 0 ? '' : (payday.amount / 100).toFixed(2));
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (hidden) return null;

  const save = async () => {
    if (!account) return setProblem('Pick the account the pay went into.');
    setBusy(true);
    const r = await recordPay(supabase, { accountId: account, amount: typed });
    setBusy(false);
    if ('error' in r) return setProblem(r.error);
    onSaved();
  };

  return (
    <Card>
      <Text style={{ color: c.ink, fontFamily: fonts.display, fontSize: 18 }}>Has the pay arrived?</Text>
      <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 14 }}>
        {payday.bonuses.length > 0
          ? `This pay includes ${payday.bonuses.join(', ')}. Type the actual take-home (without it: ${peso(payday.amount, hide)}).`
          : `Your payslip says ${peso(payday.amount, hide)}. Change it if a different amount came in.`}
      </Text>
      <Field label="Went into">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {accounts.filter((a) => a.kind !== 'credit').map((a) => (
            <Chip key={a.id} label={a.name} on={account === a.id} onPress={() => setAccount(a.id)} />
          ))}
        </View>
      </Field>
      <Field label="Take-home (₱)">
        <Input value={typed} onChangeText={setTyped} keyboardType="decimal-pad" placeholder="0.00" />
      </Field>
      {problem ? <Text style={{ color: c.err, fontFamily: fonts.body, fontSize: 13 }}>{problem}</Text> : null}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Pressable onPress={() => void save()} disabled={busy} accessibilityRole="button" style={{ flex: 1, minHeight: 44, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: c.accent }}>
          <Text style={{ color: c.onAccent, fontFamily: fonts.bodyBold, fontSize: 15 }}>{busy ? 'Saving…' : 'Yes, add it'}</Text>
        </Pressable>
        <Pressable onPress={() => setHidden(true)} accessibilityRole="button" style={{ minHeight: 44, paddingHorizontal: 16, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: c.soft }}>
          <Text style={{ color: c.ink, fontFamily: fonts.bodyBold, fontSize: 15 }}>Not yet</Text>
        </Pressable>
      </View>
    </Card>
  );
}

/** Choose which categories show under Planned vs spent; saved to your account, so the web shows the same. */
export function PanelSheet({ all, shown, onClose, onSaved }: { all: { id: string; name: string }[]; shown: string[] | null; onClose: () => void; onSaved: () => void }) {
  const [picked, setPicked] = useState<Set<string>>(() => new Set(shown ?? all.map((x) => x.id)));
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (picked.size === 0) return setProblem('Pick at least one.');
    setBusy(true);
    const r = await saveNowCategories(supabase, all.every((x) => picked.has(x.id)) ? null : [...picked]);
    setBusy(false);
    if ('error' in r) return setProblem(r.error);
    onSaved();
  };
  return (
    <Sheet title="Planned vs spent shows" onClose={onClose}>
      <Body>Tap to show or hide a category.</Body>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {all.map((x) => (
          <Chip key={x.id} label={x.name} on={picked.has(x.id)} onPress={() => setPicked((p) => { const n = new Set(p); if (n.has(x.id)) n.delete(x.id); else n.add(x.id); return n; })} />
        ))}
      </View>
      <SheetActions onClose={onClose} onSave={() => void save()} busy={busy} problem={problem} />
    </Sheet>
  );
}
