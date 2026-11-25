import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { money } from '@/lib/domain/money';
import { savingsPlanPerCutoff } from '@/lib/engine/payslip';
import { salaryAt } from '@/lib/salary/view';
import type { Fund } from '@/lib/engine/types';
import { loadFunds } from '@/lib/funds/load';
import { FundSheet } from '~/components/FundSheets';
import { Amount, Card, Notice, Screen } from '~/components/ui';
import { reorderFunds } from '~/lib/fundsWrite';
import { useHide } from '~/lib/hide';
import { peso } from '~/lib/money';
import { supabase } from '~/lib/supabase';
import { fonts, useTheme } from '~/lib/theme';
import { useLoad } from '~/lib/useLoad';

const FUND_COLORS = ['#34D399', '#7FA8FF', '#F6C453', '#C4A0FF', '#5CD0E6', '#F28BC8'];
const RULE: Record<Fund['rule'], string> = { steps: 'In steps', cap: 'Fills to a target', reset: 'Resets every year', fixed: 'Fixed a month' };
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function Funds() {
  const c = useTheme();
  const { hide } = useHide();
  const { data, error, refreshing, reload } = useLoad(() => loadFunds(supabase));
  const [open, setOpen] = useState<{ fund: Fund | null } | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const accounts = data?.budget.accounts ?? [];

  async function move(i: number, d: -1 | 1) {
    if (!data) return;
    const ids = data.funds.map((f) => f.id);
    const j = i + d;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j]!, ids[i]!];
    setProblem(null);
    const r = await reorderFunds(supabase, ids);
    if ('error' in r) setProblem(r.error);
    else await reload();
  }
  const done = () => {
    setOpen(null);
    void reload();
  };

  return (
    <Screen title="Funds" refreshing={refreshing} onRefresh={reload}>
      {error ? <Notice tone="error">{error}</Notice> : null}
      {problem ? <Notice tone="error">{problem}</Notice> : null}
      {!data && !error ? <Notice>Loading…</Notice> : null}
      {data && data.funds.length === 0 ? <Notice>No funds yet. Add one with the button below.</Notice> : null}

      {data?.funds.map((f, i) => {
        const color = data.colors.get(f.id) ?? FUND_COLORS[i % FUND_COLORS.length]!;
        const balance = data.fundStart[f.id] ?? money(0);
        const target = f.target ?? null;
        const pct = target && target > 0 ? Math.min(100, (balance / target) * 100) : null;
        // The payroll savings plan: what it adds each month (both cutoffs) to the fund it feeds.
        const settings = data.budget.salary.input.settings;
        const planMonthly = f.id === settings.savingsPlanFundId ? savingsPlanPerCutoff(settings, salaryAt(data.budget.salary.input, data.budget.salary.thisMonth).base) * 2 : 0;
        const bits = [
          planMonthly > 0 ? `+${peso(money(planMonthly), hide)} a month from your payroll savings plan` : null,
          f.maxPerMonth ? `up to ${peso(f.maxPerMonth, hide)} a month` : null,
          f.fixedAmount ? `${peso(f.fixedAmount, hide)} a month` : null,
          f.rule === 'reset' && f.resetMonth ? `resets in ${MON[f.resetMonth - 1]}` : null,
        ].filter(Boolean);
        return (
          <Card key={f.id}>
            <View style={s.between}>
              <View style={[s.row, { flex: 1 }]}>
                <Text style={{ color: c.muted, fontFamily: fonts.bodyBold, fontSize: 13 }}>{i + 1}</Text>
                <View style={[s.dot, { backgroundColor: color }]} />
                <Text style={{ color: c.ink, fontFamily: fonts.display, fontSize: 16, flexShrink: 1 }}>{f.name}</Text>
              </View>
              <Amount value={balance} style={{ fontSize: 16 }} />
            </View>
            {pct !== null ? (
              <View style={{ gap: 4 }}>
                <View style={[s.track, { backgroundColor: c.soft }]}>
                  <View style={{ width: `${pct}%`, height: 8, borderRadius: 4, backgroundColor: color }} />
                </View>
                <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 12 }}>
                  {Math.round(pct)}% of {peso(target!, hide)}
                </Text>
              </View>
            ) : null}
            <View style={s.between}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: c.ink, fontFamily: fonts.bodyBold, fontSize: 14 }}>{RULE[f.rule]}</Text>
                {bits.length > 0 ? <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 12 }}>{bits.join(' · ')}</Text> : null}
              </View>
              <View style={s.row}>
                <IconBtn label="↑" a11y={`Move ${f.name} up`} onPress={() => void move(i, -1)} />
                <IconBtn label="↓" a11y={`Move ${f.name} down`} onPress={() => void move(i, 1)} />
                <IconBtn label="✎" a11y={`Edit ${f.name}`} onPress={() => setOpen({ fund: f })} />
              </View>
            </View>
          </Card>
        );
      })}

      {data ? (
        <Pressable onPress={() => setOpen({ fund: null })} accessibilityRole="button" style={[s.add, { backgroundColor: c.accent }]}>
          <Text style={{ color: c.onAccent, fontFamily: fonts.bodyBold, fontSize: 15 }}>+ New fund</Text>
        </Pressable>
      ) : null}

      {data && open ? <FundSheet fund={open.fund} color={open.fund ? (data.colors.get(open.fund.id) ?? null) : null} accounts={accounts} onClose={() => setOpen(null)} onSaved={done} /> : null}
    </Screen>
  );
}

function IconBtn({ label, a11y, onPress }: { label: string; a11y: string; onPress: () => void }) {
  const c = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={a11y} style={[s.ib, { backgroundColor: c.soft }]}>
      <Text style={{ color: c.ink, fontSize: 15 }}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  ib: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  add: { minHeight: 48, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
});
