import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { money, parsePesos } from '@/lib/domain/money';
import { savingsPlanPerCutoff } from '@/lib/engine/payslip';
import { saveSavingsPlan } from '@/lib/pay/savings-plan';
import { Input } from '~/components/Sheet';
import { Body, Card, Chip, Label } from '~/components/ui';
import { useHide } from '~/lib/hide';
import { peso } from '~/lib/money';
import { supabase } from '~/lib/supabase';
import { fonts, useTheme } from '~/lib/theme';

interface Fund {
  id: string;
  name: string;
}

type Mode = 'off' | 'percent' | 'amount';

/** The payroll savings plan: what your employer takes from each payslip into savings, counted into a fund in the forecast. */
export function SavingsPlanCard({
  plan,
  funds,
  base,
  onSaved,
}: {
  plan: { bp: number; amount: number | null; fundId: string | null };
  funds: Fund[];
  base: number;
  onSaved: () => void;
}) {
  const c = useTheme();
  const { hide } = useHide();
  const [mode, setMode] = useState<Mode>(plan.amount != null && plan.amount > 0 ? 'amount' : plan.bp > 0 ? 'percent' : 'off');
  const [percent, setPercent] = useState(plan.bp > 0 ? String(plan.bp / 100) : '');
  const [amount, setAmount] = useState(plan.amount != null && plan.amount > 0 ? (plan.amount / 100).toFixed(2) : '');
  const [fundId, setFundId] = useState<string | null>(plan.fundId);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const pct = Number(percent);
  const pesos = amount.trim() === '' ? undefined : parsePesos(amount.trim());
  const perCutoff =
    mode === 'percent' && Number.isFinite(pct) && pct > 0
      ? savingsPlanPerCutoff({ savingsPlanBp: Math.round(pct * 100), savingsPlanAmount: null }, money(base))
      : mode === 'amount' && pesos !== undefined && pesos > 0
        ? money(pesos)
        : null;

  async function save() {
    setProblem(null);
    setBusy(true);
    const r = await saveSavingsPlan(supabase, {
      mode,
      percentBp: mode === 'percent' && Number.isFinite(pct) ? Math.round(pct * 100) : null,
      amount: mode === 'amount' ? (pesos ?? null) : null,
      fundId: mode === 'off' ? null : fundId,
    });
    setBusy(false);
    if ('error' in r) setProblem(r.error);
    else onSaved();
  }

  return (
    <Card>
      <Label>Payroll savings plan</Label>
      <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 13 }}>
        Money your employer takes from each payslip into savings. It lowers your take-home; the forecast counts it as saved into the fund you pick.
      </Text>
      <View style={s.chips}>
        <Chip label="None" on={mode === 'off'} onPress={() => setMode('off')} />
        <Chip label="% of basic" on={mode === 'percent'} onPress={() => setMode('percent')} />
        <Chip label="Fixed ₱" on={mode === 'amount'} onPress={() => setMode('amount')} />
      </View>
      {mode === 'percent' ? <Input value={percent} onChangeText={setPercent} keyboardType="decimal-pad" placeholder="Percent of basic each cutoff, like 6" /> : null}
      {mode === 'amount' ? <Input value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="Amount each cutoff, like 2,000" /> : null}
      {mode !== 'off' ? (
        <>
          <Label>Counts as saved into</Label>
          <View style={s.chips}>
            <Chip label="No fund" on={fundId === null} onPress={() => setFundId(null)} />
            {funds.map((f) => (
              <Chip key={f.id} label={f.name} on={fundId === f.id} onPress={() => setFundId(f.id)} />
            ))}
          </View>
        </>
      ) : null}
      {perCutoff !== null ? (
        <Body>
          {peso(perCutoff, hide)} each cutoff, {peso(money(perCutoff * 2), hide)} a month
          {fundId ? ` into ${funds.find((f) => f.id === fundId)?.name ?? 'that fund'}` : ', with no fund chosen, so the forecast will not count it as saved'}.
        </Body>
      ) : null}
      {problem ? <Text style={{ color: c.err, fontFamily: fonts.body, fontSize: 14 }}>{problem}</Text> : null}
      <Pressable onPress={() => void save()} disabled={busy} accessibilityRole="button" style={[s.btn, { backgroundColor: c.accent, opacity: busy ? 0.6 : 1 }]}>
        <Text style={{ color: c.onAccent, fontFamily: fonts.bodyBold, fontSize: 15 }}>{busy ? 'Saving…' : 'Save savings plan'}</Text>
      </Pressable>
    </Card>
  );
}

const s = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  btn: { minHeight: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
