import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { IsoDate } from '@/lib/domain/dates';
import { money, parsePesos } from '@/lib/domain/money';
import { validateInstallment } from '@/lib/installments/input';
import { loadInstallments, saveInstallment, deleteInstallment, type PlanRow } from '@/lib/installments/save';
import { summarizePlan } from '@/lib/installments/summary';
import { todayManila } from '@/lib/plans/validate';
import { DateInput } from '~/components/DateInput';
import { Field, Input, Sheet, SheetActions } from '~/components/Sheet';
import { Body, Card, Chip, Notice, Screen } from '~/components/ui';
import { useHide } from '~/lib/hide';
import { peso } from '~/lib/money';
import { supabase } from '~/lib/supabase';
import { fonts, useTheme } from '~/lib/theme';
import { useLoad } from '~/lib/useLoad';

interface Option {
  id: string;
  name: string;
}

interface Draft {
  id?: string;
  name: string;
  kind: 'card' | 'loan';
  price: string;
  down: string;
  months: string;
  rate: string;
  firstDueOn: string;
  cutoff: 'first' | 'second';
  accountId: string | null;
}

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const ymText = (ym: string) => `${MON[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`;
const pesos = (c: number) => (c / 100).toFixed(2);

const blank = (today: string): Draft => ({ name: '', kind: 'card', price: '', down: '', months: '12', rate: '0', firstDueOn: today, cutoff: 'second', accountId: null });
const draftOf = (p: PlanRow): Draft => ({
  id: p.id, name: p.name, kind: p.kind, price: pesos(p.price), down: p.down_payment > 0 ? pesos(p.down_payment) : '', months: String(p.term_count),
  rate: String(p.rate_bp / 100), firstDueOn: p.first_due_on, cutoff: p.cutoff, accountId: p.account_id,
});

/** The typed fields as the shared validator wants them; null while an amount cannot be read yet. */
function toInput(d: Draft) {
  const price = parsePesos(d.price.trim());
  const down = d.down.trim() === '' ? 0 : parsePesos(d.down.trim());
  const rate = d.rate.trim() === '' ? 0 : Number(d.rate);
  if (price === undefined || down === undefined || !Number.isFinite(rate)) return null;
  return { id: d.id, name: d.name, kind: d.kind, price, downPayment: down, termCount: Number(d.months), rateBp: Math.round(rate * 100), firstDueOn: d.firstDueOn.trim(), cutoff: d.cutoff, accountId: d.accountId };
}

function PlanSheet({ draft, accounts, today, onClose, onSaved }: { draft: Draft; accounts: Option[]; today: string; onClose: () => void; onSaved: () => void }) {
  const c = useTheme();
  const [d, setD] = useState(draft);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));

  const input = toInput(d);
  const checked = input ? validateInstallment(input) : null;
  const preview = !input
    ? 'Enter the amounts as pesos, like 36,000.'
    : checked && !checked.ok
      ? checked.error
      : (() => {
          const s = summarizePlan({ price: input.price, downPayment: input.downPayment, termCount: input.termCount, rateBp: input.rateBp, firstDueOn: input.firstDueOn }, today as IsoDate);
          return `${peso(money(s.payment), false)} a month for ${input.termCount} months, ending ${ymText(s.endsOn)}. Total ${peso(money(s.total), false)}${s.interest > 0 ? ` (${peso(money(s.interest), false)} interest)` : ''}.`;
        })();

  async function save() {
    setProblem(null);
    if (!input) return setProblem('Enter the amounts as pesos, like 36,000.');
    setBusy(true);
    const r = await saveInstallment(supabase, input);
    setBusy(false);
    if ('error' in r) setProblem(r.error);
    else onSaved();
  }
  async function remove() {
    if (!d.id) return;
    setBusy(true);
    const r = await deleteInstallment(supabase, d.id);
    setBusy(false);
    if ('error' in r) setProblem(r.error);
    else onSaved();
  }

  return (
    <Sheet title={d.id ? 'Edit plan' : 'New plan'} onClose={onClose}>
      <Field label="Name">
        <Input value={d.name} onChangeText={(v) => set('name', v)} maxLength={60} placeholder="Phone on BPI card" />
      </Field>
      <View style={s.chips}>
        <Chip label="Card plan" on={d.kind === 'card'} onPress={() => set('kind', 'card')} />
        <Chip label="Loan" on={d.kind === 'loan'} onPress={() => set('kind', 'loan')} />
      </View>
      <Field label={d.kind === 'loan' ? 'Loan amount (₱)' : 'Price (₱)'}>
        <Input value={d.price} onChangeText={(v) => set('price', v)} keyboardType="decimal-pad" />
      </Field>
      <Field label="Down payment (₱, optional)">
        <Input value={d.down} onChangeText={(v) => set('down', v)} keyboardType="decimal-pad" />
      </Field>
      <Field label="Monthly payments">
        <Input value={d.months} onChangeText={(v) => set('months', v)} keyboardType="number-pad" maxLength={3} />
      </Field>
      <Field label="Interest a year (%)">
        <Input value={d.rate} onChangeText={(v) => set('rate', v)} keyboardType="decimal-pad" />
      </Field>
      <Field label="First payment on">
        <DateInput label="First payment on" value={d.firstDueOn} onChange={(v) => set('firstDueOn', v)} />
      </Field>
      <Field label="Paid from">
        <View style={s.chips}>
          <Chip label="1st cutoff" on={d.cutoff === 'first'} onPress={() => set('cutoff', 'first')} />
          <Chip label="2nd cutoff" on={d.cutoff === 'second'} onPress={() => set('cutoff', 'second')} />
        </View>
      </Field>
      <Field label="Pays out of (optional)">
        <View style={s.chips}>
          <Chip label="Not tied to an account" on={d.accountId === null} onPress={() => set('accountId', null)} />
          {accounts.map((a) => (
            <Chip key={a.id} label={a.name} on={d.accountId === a.id} onPress={() => set('accountId', a.id)} />
          ))}
        </View>
      </Field>
      <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 13 }}>{preview}</Text>
      <SheetActions onClose={onClose} onSave={save} busy={busy} saveLabel="Save plan" problem={problem} />
      {d.id ? (
        <Pressable onPress={remove} disabled={busy} accessibilityRole="button" style={[s.btn, { backgroundColor: c.soft }]}>
          <Text style={{ color: c.err, fontFamily: fonts.bodyBold, fontSize: 15 }}>Delete plan</Text>
        </Pressable>
      ) : null}
      <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 12 }}>
        Saving adds one line to Budget for the monthly payment, from the first payment month to the last. A payment counts as paid once its date has passed.
      </Text>
    </Sheet>
  );
}

export default function Installments() {
  const c = useTheme();
  const { hide } = useHide();
  const today = todayManila();
  const { data, error, refreshing, reload } = useLoad(async () => {
    const [plans, accts] = await Promise.all([
      loadInstallments(supabase),
      supabase.from('accounts').select('id, name').is('archived_at', null).order('sort').order('created_at'),
    ]);
    return { ...plans, accounts: (accts.data ?? []) as Option[] };
  });
  const [open, setOpen] = useState<Draft | null>(null);

  const rows = (data?.plans ?? []).map((p) => ({ p, s: summarizePlan({ price: p.price, downPayment: p.down_payment, termCount: p.term_count, rateBp: p.rate_bp, firstDueOn: p.first_due_on }, today as IsoDate) }));
  const active = rows.filter((x) => !x.s.done);
  const finished = rows.filter((x) => x.s.done);
  const monthly = active.reduce((t, x) => t + x.s.payment, 0);
  const owed = active.reduce((t, x) => t + x.s.remainingAmount, 0);
  const done = () => {
    setOpen(null);
    void reload();
  };

  const card = ({ p, s: sm }: (typeof rows)[number]) => {
    const total = sm.paid + sm.remaining;
    const pct = total > 0 ? Math.min(100, (sm.paid / total) * 100) : 0;
    return (
      <Pressable key={p.id} onPress={() => setOpen(draftOf(p))} accessibilityRole="button" accessibilityLabel={`Edit ${p.name}`}>
        <Card>
          <View style={s.between}>
            <Body bold>{p.name}</Body>
            <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 12 }}>
              {p.kind === 'loan' ? 'Loan' : 'Card plan'} · {p.cutoff === 'first' ? '1st' : '2nd'} cutoff
            </Text>
          </View>
          <Text style={{ color: c.ink, fontFamily: fonts.display, fontSize: 22 }}>
            {peso(money(sm.payment), hide)} <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 13 }}>a month</Text>
          </Text>
          <View style={[s.bar, { backgroundColor: c.soft }]}>
            <View style={{ width: `${pct}%`, height: '100%', backgroundColor: c.accent, borderRadius: 4 }} />
          </View>
          <View style={s.between}>
            <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 13 }}>
              {sm.paid} of {total} paid · {sm.done ? 'finished' : 'ends'} {ymText(sm.endsOn)}
            </Text>
            <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 13 }}>{peso(money(sm.remainingAmount), hide)} left</Text>
          </View>
        </Card>
      </Pressable>
    );
  };

  return (
    <Screen title="Installments" refreshing={refreshing} onRefresh={reload}>
      {error ? <Notice tone="error">{error}</Notice> : null}
      {!data && !error ? <Notice>Loading…</Notice> : null}
      {data?.missing ? <Notice>Installments need a database update first: apply supabase/migrations/20261210000000_installment_plans.sql, then pull down to refresh.</Notice> : null}
      {data && !data.missing ? (
        <>
          <Card>
            <View style={s.between}>
              <View>
                <Text style={{ color: c.muted, fontFamily: fonts.bodyBold, fontSize: 12 }}>EVERY MONTH</Text>
                <Text style={{ color: c.ink, fontFamily: fonts.display, fontSize: 24 }}>{peso(money(monthly), hide)}</Text>
              </View>
              <View>
                <Text style={{ color: c.muted, fontFamily: fonts.bodyBold, fontSize: 12 }}>STILL TO PAY</Text>
                <Text style={{ color: c.ink, fontFamily: fonts.display, fontSize: 24 }}>{peso(money(owed), hide)}</Text>
              </View>
            </View>
          </Card>
          {rows.length === 0 ? <Notice>No installments yet. Add a card plan or a loan and it appears in your budget as its own line.</Notice> : null}
          {active.map(card)}
          {finished.length > 0 ? <Text style={{ color: c.muted, fontFamily: fonts.bodyBold, fontSize: 13 }}>Finished</Text> : null}
          {finished.map(card)}
          <Pressable onPress={() => setOpen(blank(today))} accessibilityRole="button" style={[s.btn, { backgroundColor: c.accent }]}>
            <Text style={{ color: c.onAccent, fontFamily: fonts.bodyBold, fontSize: 15 }}>+ Add a plan</Text>
          </Pressable>
        </>
      ) : null}
      {open && data ? <PlanSheet draft={open} accounts={data.accounts} today={today} onClose={() => setOpen(null)} onSaved={done} /> : null}
    </Screen>
  );
}

const s = StyleSheet.create({
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  bar: { height: 8, borderRadius: 4, overflow: 'hidden' },
  btn: { minHeight: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
