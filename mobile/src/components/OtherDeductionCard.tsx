import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { money, formatPesos, parsePesos } from '@/lib/domain/money';
import { MAX_OTHER_DEDUCTIONS, saveOtherDeductions, type OtherDeductionDraft } from '@/lib/pay/other-deduction';
import { Input } from '~/components/Sheet';
import { Card, Chip, Label } from '~/components/ui';
import { supabase } from '~/lib/supabase';
import { fonts, useTheme } from '~/lib/theme';

const blank = (): OtherDeductionDraft => ({ label: '', cutoff: 'both', amount: '', amountSecond: '' });

/** What one row takes in the 1st and 2nd cutoff, or null while it is not readable yet. */
function perCutoff(d: OtherDeductionDraft): { first: number; second: number } | null {
  const a = d.amount.trim() === '' ? undefined : parsePesos(d.amount);
  if (a === undefined || a <= 0) return null;
  const b = d.cutoff === 'both' && d.amountSecond.trim() !== '' ? parsePesos(d.amountSecond) : a;
  if (b === undefined) return null;
  return { first: d.cutoff === 'second' ? 0 : a, second: d.cutoff === 'first' ? 0 : b };
}

/**
 * Payroll deductions that are not the necessary ones, such as your HMO plan or a loan. Each is on the 1st cutoff, the 2nd, or both,
 * with its own amount in each. The Budget page lists them without counting them in the planned total.
 */
export function OtherDeductionCard({ items, onSaved }: { items: OtherDeductionDraft[]; onSaved: () => void }) {
  const c = useTheme();
  const [rows, setRows] = useState<OtherDeductionDraft[]>(items);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (i: number, patch: Partial<OtherDeductionDraft>) => setRows((r) => r.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  const save = async () => {
    setBusy(true);
    setProblem(null);
    const r = await saveOtherDeductions(supabase, { items: rows });
    setBusy(false);
    if ('error' in r) setProblem(r.error);
    else {
      setRows((x) => x.filter((d) => d.label.trim() !== '' || d.amount.trim() !== ''));
      onSaved();
    }
  };

  return (
    <Card>
      <Label>Other payroll deductions</Label>
      <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 13 }}>
        Something your employer takes from a payslip that is not tax, SSS, PhilHealth or Pag-IBIG, such as an HMO plan or a loan. Pick the cutoff it comes off.
      </Text>
      {rows.length === 0 ? <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 13 }}>None yet.</Text> : null}
      {rows.map((d, i) => {
        const pc = perCutoff(d);
        return (
          <View key={i} style={{ gap: 8, paddingTop: i === 0 ? 0 : 12, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: c.line }}>
            <Input value={d.label} onChangeText={(t) => set(i, { label: t })} maxLength={30} placeholder="Name, e.g. HMO plan" />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {([['first', '1st'], ['second', '2nd'], ['both', 'Both']] as const).map(([v, l]) => (
                <Chip key={v} label={l} on={d.cutoff === v} onPress={() => set(i, { cutoff: v })} />
              ))}
            </View>
            <Input value={d.amount} onChangeText={(t) => set(i, { amount: t })} keyboardType="decimal-pad" placeholder={d.cutoff === 'both' ? '1st cutoff amount (₱)' : 'Amount (₱)'} />
            {d.cutoff === 'both' ? (
              <Input value={d.amountSecond} onChangeText={(t) => set(i, { amountSecond: t })} keyboardType="decimal-pad" placeholder={d.amount.trim() === '' ? '2nd cutoff amount (empty = same)' : `2nd cutoff amount (empty = ${d.amount})`} />
            ) : null}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 12, flex: 1 }}>
                {pc ? `${formatPesos(money(pc.first + pc.second))} a month${pc.first > 0 && pc.second > 0 ? `: ${formatPesos(money(pc.first))} in the 1st, ${formatPesos(money(pc.second))} in the 2nd` : `, all in the ${pc.first > 0 ? '1st' : '2nd'} cutoff`}` : ''}
              </Text>
              <Pressable onPress={() => setRows((r) => r.filter((_, j) => j !== i))} accessibilityRole="button" accessibilityLabel={`Remove ${d.label || 'this deduction'}`} style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 }}>
                <Text style={{ color: c.err, fontFamily: fonts.bodyBold, fontSize: 14 }}>Remove</Text>
              </Pressable>
            </View>
          </View>
        );
      })}
      {problem ? <Text style={{ color: c.err, fontFamily: fonts.body, fontSize: 13 }}>{problem}</Text> : null}
      <Pressable
        onPress={() => setRows((r) => [...r, blank()])}
        disabled={rows.length >= MAX_OTHER_DEDUCTIONS}
        accessibilityRole="button"
        style={{ minHeight: 44, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: c.soft, opacity: rows.length >= MAX_OTHER_DEDUCTIONS ? 0.5 : 1 }}
      >
        <Text style={{ color: c.ink, fontFamily: fonts.bodyBold, fontSize: 15 }}>Add a deduction</Text>
      </Pressable>
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
