import { useState } from 'react';
import { Pressable, Text } from 'react-native';
import { saveOtherDeduction } from '@/lib/pay/other-deduction';
import { Input } from '~/components/Sheet';
import { Card, Label } from '~/components/ui';
import { supabase } from '~/lib/supabase';
import { fonts, useTheme } from '~/lib/theme';

/**
 * A payroll deduction that is not one of the necessary ones, such as your HMO plan. It comes off every cutoff and the Budget page
 * lists it without counting it in the planned total.
 */
export function OtherDeductionCard({ label: label0, amount: amount0, onSaved }: { label: string; amount: number; onSaved: () => void }) {
  const c = useTheme();
  const [label, setLabel] = useState(label0);
  const [amount, setAmount] = useState(amount0 > 0 ? (amount0 / 100).toFixed(2) : '');
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    setProblem(null);
    const r = await saveOtherDeduction(supabase, { label, amount });
    setBusy(false);
    if ('error' in r) setProblem(r.error);
    else onSaved();
  };

  return (
    <Card>
      <Label>Other payroll deduction</Label>
      <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 13 }}>
        Something your employer takes from each payslip that is not tax, SSS, PhilHealth or Pag-IBIG, such as an HMO plan.
      </Text>
      <Input value={label} onChangeText={setLabel} maxLength={30} placeholder="Name, e.g. HMO plan" />
      <Input value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="Taken each cutoff (₱)" />
      {problem ? <Text style={{ color: c.err, fontFamily: fonts.body, fontSize: 13 }}>{problem}</Text> : null}
      <Pressable
        onPress={() => void save()}
        disabled={busy}
        accessibilityRole="button"
        style={{ minHeight: 44, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: c.accent, opacity: busy ? 0.6 : 1 }}
      >
        <Text style={{ color: c.onAccent, fontFamily: fonts.bodyBold, fontSize: 15 }}>{busy ? 'Saving…' : 'Save'}</Text>
      </Pressable>
    </Card>
  );
}
