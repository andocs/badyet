import { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { monthLabel } from '@/lib/budget/screen';
import { createPlan, deletePlan, updatePlan } from '@/lib/budget/plans-write';
import type { PlanSpan } from '@/lib/budget/plans';
import type { YearMonth } from '@/lib/domain/dates';
import { monthRange } from '@/lib/engine/months';
import type { PayCutoff } from '@/lib/engine/types';
import { Chip } from '~/components/ui';
import { Field, Input, Sheet, SheetActions } from '~/components/Sheet';
import { supabase } from '~/lib/supabase';
import { fonts, useTheme } from '~/lib/theme';

/** Make or change a budget plan: a name and the cutoffs it starts and ends on. A new plan starts as a copy of the normal budget. */
export function PlanSheet({ plan, thisMonth, onClose, onSaved }: { plan: PlanSpan | null; thisMonth: YearMonth; onClose: () => void; onSaved: (id: string | null) => void }) {
  const c = useTheme();
  const months = monthRange(thisMonth, 36);
  const [name, setName] = useState(plan?.name ?? '');
  const [fromMonth, setFromMonth] = useState<YearMonth>(plan?.from.month ?? thisMonth);
  const [fromCut, setFromCut] = useState<PayCutoff>(plan?.from.cutoff ?? 'first');
  const [toMonth, setToMonth] = useState<YearMonth>(plan?.to.month ?? months[2]!);
  const [toCut, setToCut] = useState<PayCutoff>(plan?.to.cutoff ?? 'second');
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // A plan already running may start before this month; keep its own month pickable.
  const pick = (m: YearMonth) => [...new Set([m, ...months])].sort();

  const save = async () => {
    setBusy(true);
    setProblem(null);
    const body = { name, from: { month: fromMonth, cutoff: fromCut }, to: { month: toMonth, cutoff: toCut } };
    const r = plan ? await updatePlan(supabase, { ...body, id: plan.id }) : await createPlan(supabase, body);
    setBusy(false);
    if ('error' in r) return setProblem(r.error);
    onSaved(plan ? plan.id : (r.id ?? null));
  };
  const remove = () =>
    Alert.alert(`Delete ${plan!.name}?`, 'Its lines go with it. The normal budget applies to those cutoffs again.', [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const r = await deletePlan(supabase, plan!.id);
          if ('error' in r) setProblem(r.error);
          else onSaved(null);
        },
      },
    ]);

  const monthRow = (value: YearMonth, set: (m: YearMonth) => void) => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
      {pick(value).map((m) => (
        <Chip key={m} label={monthLabel(m)} on={m === value} onPress={() => set(m)} />
      ))}
    </ScrollView>
  );
  const cutRow = (value: PayCutoff, set: (x: PayCutoff) => void) => (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      <Chip label="1st cutoff" on={value === 'first'} onPress={() => set('first')} />
      <Chip label="2nd cutoff" on={value === 'second'} onPress={() => set('second')} />
    </View>
  );

  return (
    <Sheet title={plan ? 'Edit plan' : 'New budget plan'} onClose={onClose}>
      <Field label="Name">
        <Input value={name} onChangeText={setName} maxLength={40} placeholder="e.g. Japan trip" />
      </Field>
      <Field label="Starts">
        {monthRow(fromMonth, setFromMonth)}
        {cutRow(fromCut, setFromCut)}
      </Field>
      <Field label="Ends (included)">
        {monthRow(toMonth, setToMonth)}
        {cutRow(toCut, setToCut)}
      </Field>
      {!plan ? <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 13 }}>Your current budget lines are copied into the plan. Change them after.</Text> : null}
      {plan ? (
        <Pressable onPress={remove} accessibilityRole="button" style={{ minHeight: 44, justifyContent: 'center' }}>
          <Text style={{ color: c.err, fontFamily: fonts.bodyBold, fontSize: 15 }}>Delete this plan</Text>
        </Pressable>
      ) : null}
      <SheetActions onClose={onClose} onSave={() => void save()} busy={busy} saveLabel={plan ? 'Save plan' : 'Create plan'} problem={problem} />
    </Sheet>
  );
}
