import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { isoDate } from '@/lib/domain/dates';
import { money } from '@/lib/domain/money';
import { dayLabel, ordinalCutoff, rangeLabel, relativeDay, shortDate, weekdayName } from '@/lib/now/format';
import { loadNow, type AccountCard } from '@/lib/now/load';
import { manilaDate, type Envelope, type NowTxn, type NowView } from '@/lib/now/summary';
import { AccountTile } from '~/components/AccountTile';
import { GmailBanner } from '~/components/GmailBanner';
import { Runway } from '~/components/Runway';
import { Amount, Body, Card, Label, Notice, Screen } from '~/components/ui';
import { resolveColor } from '~/lib/color';
import { useHide } from '~/lib/hide';
import { peso } from '~/lib/money';
import { supabase } from '~/lib/supabase';
import { fonts, useTheme } from '~/lib/theme';
import { useLoad } from '~/lib/useLoad';

const CARD_COLORS = ['#2F5BD7', '#087A5A', '#B03030', '#7A3FB8', '#0F7A95', '#B83A86'];
const KIND: Record<string, string> = { ewallet: 'E-wallet', debit: 'Debit', savings: 'Savings', credit: 'Credit', cash: 'Cash' };

export default function Now() {
  const c = useTheme();
  const { data, error, refreshing, reload } = useLoad(() => loadNow(supabase));

  if (!data) {
    return (
      <Screen title="Now" refreshing={refreshing} onRefresh={reload}>
        {error ? <Notice tone="error">{error}</Notice> : <Notice>Loading…</Notice>}
      </Screen>
    );
  }
  if (data.kind === 'setup') {
    return (
      <Screen title="Let’s get Now going" refreshing={refreshing} onRefresh={reload}>
        <Card>
          <Body>
            {data.reason === 'no-salary'
              ? 'Now needs your salary to work out what you can spend. Run the setup wizard on the web app, then pull down to refresh.'
              : 'Now needs your budget lines to split each cutoff. Add them in Budget on the web app, then pull down to refresh.'}
          </Body>
        </Card>
      </Screen>
    );
  }

  const { view, today } = data;
  return (
    <Screen
      title={dayLabel(today)}
      subtitle={`${ordinalCutoff(view.cutoff)} cutoff · ${rangeLabel(view.period.start, view.period.end)} · payday ${shortDate(view.nextPayday)}`}
      refreshing={refreshing}
      onRefresh={reload}
    >
      <GmailBanner />
      <Hero view={view} today={today} />
      <Recent txns={view.recent} today={today} pending={view.pendingCount} />
      <AccountsRow accounts={data.accounts} total={data.total} />
      <Envelopes envelopes={view.envelopes} dayNumber={view.dayNumber} daysTotal={view.daysTotal} />
      <Bills view={view} />
      {data.settleOpen > 0 ? (
        <Card>
          <Text style={[s.h2, { color: c.ink, fontFamily: fonts.display }]}>Settle office days</Text>
          <Body style={{ color: c.muted, fontSize: 14 }}>
            {data.settleOpen} office day{data.settleOpen === 1 ? '' : 's'} ended under or over budget. Settle them in Budget on the web for now.
          </Body>
        </Card>
      ) : null}
      <Card style={{ backgroundColor: c.tint, borderColor: c.tint }}>
        <Body>
          <Body bold>Next payday, {shortDate(data.nextPay.date)}: </Body>
          <Amount value={data.nextPay.amount} style={{ fontSize: 15 }} /> lands (your {ordinalCutoff(data.nextPay.cutoff)} cutoff).
        </Body>
      </Card>
    </Screen>
  );
}

function Hero({ view, today }: { view: NowView; today: ReturnType<typeof isoDate> }) {
  const c = useTheme();
  const router = useRouter();
  const { hide } = useHide();
  const officeNote = view.nextOffice !== null || view.isUsualOfficeDay;
  const over = view.overPace > 0;
  return (
    <LinearGradient colors={[c.heroA, c.heroB]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.hero}>
      <View style={s.heroTop}>
        <View style={{ flex: 1 }}>
          <Text style={[s.heroLabel, { fontFamily: fonts.bodyBold }]}>SAFE TO SPEND TODAY</Text>
          <Amount value={view.today} style={s.heroAmount} />
        </View>
        <Pressable onPress={() => router.push('/add')} accessibilityRole="button" accessibilityLabel="Add expense" style={[s.addBtn, { backgroundColor: c.accent }]}>
          <Text style={{ color: c.onAccent, fontFamily: fonts.bodyBold, fontSize: 15 }}>+ Expense</Text>
        </Pressable>
      </View>
      {view.pool === 0 ? (
        <Text style={[s.heroSub, { fontFamily: fonts.body }]}>No budget line counts towards your daily amount yet. Mark your Wants lines in Budget.</Text>
      ) : (
        <Text style={[s.heroSub, { fontFamily: fonts.body }]}>
          per day for {view.daysLeft} {view.daysLeft === 1 ? 'day' : 'days'}. {peso(view.left, hide)} left of {peso(view.pool, hide)}.
        </Text>
      )}
      {officeNote ? (
        <Text style={[s.heroSub, { fontFamily: fonts.body }]}>
          <Text style={{ fontFamily: fonts.bodyBold, color: '#fff' }}>
            {view.isUsualOfficeDay ? 'A usual office day.' : `${weekdayName(today)}, not a usual office day.`}{' '}
          </Text>
          {view.nextOffice ? `Next: ${dayLabel(view.nextOffice.date)}, ${peso(view.nextOffice.amount, hide)}.` : ''}
        </Text>
      ) : null}

      <Runway view={view} />
      <View style={s.legend}>
        <Legend color="#5EE6B4" text="Spent" />
        <Legend color="#B9C9DD" dashed text="Plan pace" />
        <Legend color="#5EE6B4" dashed text={`If you keep to ${peso(view.perDay, hide)}`} />
      </View>
      <Text style={[s.heroSub, { fontFamily: fonts.body }]}>
        Spent {peso(view.spent, hide)} · pace says {peso(view.pace, hide)} by today
      </Text>
      {view.pool > 0 ? (
        <Text style={{ color: '#fff', fontFamily: fonts.bodyBold, fontSize: 14 }}>
          {peso(money(Math.abs(view.overPace)), hide)} {over ? 'over pace.' : 'under pace.'}
        </Text>
      ) : null}
    </LinearGradient>
  );
}

function Legend({ color, text, dashed }: { color: string; text: string; dashed?: boolean }) {
  return (
    <View style={s.legendItem}>
      <View style={[s.swatch, dashed ? { borderTopWidth: 2, borderStyle: 'dashed', borderColor: color, height: 0 } : { backgroundColor: color }]} />
      <Text style={{ color: '#d3efe6', fontFamily: fonts.body, fontSize: 13 }}>{text}</Text>
    </View>
  );
}

function Recent({ txns, today, pending }: { txns: NowTxn[]; today: ReturnType<typeof isoDate>; pending: number }) {
  const c = useTheme();
  const router = useRouter();
  let lastDay = '';
  return (
    <Card>
      <View style={s.between}>
        <Text style={[s.h2, { color: c.ink, fontFamily: fonts.display }]}>Recent</Text>
        <Pressable onPress={() => router.push('/inbox')} accessibilityRole="link" style={s.link}>
          <Text style={{ color: c.accentText, fontFamily: fonts.bodyBold, fontSize: 14 }}>
            {pending > 0 ? `${pending} to check · ` : ''}All activity →
          </Text>
        </Pressable>
      </View>
      {txns.length === 0 ? (
        <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 14 }}>Nothing yet this cutoff. Tap + to add your first spend.</Text>
      ) : (
        txns.map((t) => {
          const day = manilaDate(t.occurredAt);
          const heading = day !== lastDay ? relativeDay(day, today) : null;
          lastDay = day;
          return (
            <View key={t.id}>
              {heading ? (
                <Text style={{ color: c.muted, fontFamily: fonts.bodyBold, fontSize: 12, letterSpacing: 0.6, textTransform: 'uppercase', marginTop: 6 }}>{heading}</Text>
              ) : null}
              <View style={s.between}>
                <View style={{ flex: 1 }}>
                  <Body bold>{t.merchant ?? (t.kind === 'transfer' ? 'Transfer' : 'Expense')}</Body>
                  <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 13 }}>
                    {t.accountName}
                    {t.status === 'pending' ? ' · ' : ''}
                    {t.status === 'pending' ? <Text style={{ color: c.gold }}>pending</Text> : null}
                  </Text>
                </View>
                <Amount value={t.amount} style={{ color: t.amount > 0 ? c.accentText : c.ink }} />
              </View>
            </View>
          );
        })
      )}
    </Card>
  );
}

function AccountsRow({ accounts, total }: { accounts: AccountCard[]; total: ReturnType<typeof money> }) {
  const c = useTheme();
  const router = useRouter();
  const { hide } = useHide();
  return (
    <View style={{ gap: 8 }}>
      <View style={s.between}>
        <View style={{ flex: 1 }}>
          <Text style={[s.h2, { color: c.ink, fontFamily: fonts.display }]}>Balance</Text>
          <Amount value={total} style={{ fontFamily: fonts.display, fontSize: 22, lineHeight: 28 }} />
        </View>
        <Pressable onPress={() => router.push('/accounts')} accessibilityRole="link" style={s.link}>
          <Text style={{ color: c.accentText, fontFamily: fonts.bodyBold, fontSize: 14 }}>See all ›</Text>
        </Pressable>
      </View>
      {accounts.length === 0 ? (
        <Notice>No accounts yet. Add one under Accounts on the web to see your balances here.</Notice>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }} accessibilityLabel="Accounts, scroll sideways">
          {accounts.map((a, i) => (
            <AccountTile
              key={a.id}
              width={240}
              name={a.name}
              kind={`${KIND[a.kind] ?? a.kind}${a.last4 ? ` ·· ${a.last4}` : ''}`}
              color={a.color ?? CARD_COLORS[i % CARD_COLORS.length]!}
              balanceText={peso(a.balance, hide)}
              sub={a.confirmedOn ? `Confirmed ${shortDate(isoDate(a.confirmedOn.slice(0, 10)))}` : 'No balance set yet'}
              onPress={() => router.push('/accounts')}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function EnvelopeRow({ e, ratio, open: initiallyOpen }: { e: Envelope; ratio: number; open: boolean }) {
  const c = useTheme();
  const [open, setOpen] = useState(initiallyOpen);
  const color = resolveColor(e.color, c);
  const pct = e.plan > 0 ? Math.min(100, (e.spent / e.plan) * 100) : 0;
  const tolerance = 2500; // ₱25 either way is "on pace"
  const over = e.overPace > tolerance;
  const under = e.overPace < -tolerance;
  const { hide } = useHide();
  return (
    <View style={[s.env, { backgroundColor: c.surface, borderColor: c.line }]}>
      <Pressable onPress={() => setOpen((o) => !o)} accessibilityRole="button" accessibilityState={{ expanded: open }} accessibilityLabel={`${e.name}, ${Math.round(pct)} percent used`}>
        <View style={s.between}>
          <View style={[s.row, { flex: 1, flexWrap: 'wrap' }]}>
            <View style={[s.dot, { backgroundColor: color }]} />
            <Body bold>{e.name}</Body>
            <View style={[s.pill, { backgroundColor: over ? c.errTint : c.tint }]}>
              <Text style={{ color: over ? c.err : c.accentText, fontFamily: fonts.bodyBold, fontSize: 12 }}>
                {over ? `${peso(e.overPace, hide)} over pace` : under ? `${peso(money(-e.overPace), hide)} under pace` : 'on pace'}
              </Text>
            </View>
          </View>
          <View style={s.row}>
            <Amount value={e.left} style={{ color: e.left < 0 ? c.err : c.ink }} />
            <Text style={{ color: c.muted, fontSize: 14 }}>{open ? '▴' : '▾'}</Text>
          </View>
        </View>
        <View style={{ marginTop: 10 }}>
          <View style={[s.track, { backgroundColor: c.soft }]}>
            <View style={{ width: `${pct}%`, height: 8, borderRadius: 4, backgroundColor: e.left < 0 ? c.err : color }} />
          </View>
          <View style={[s.marker, { left: `${Math.min(100, ratio * 100)}%`, backgroundColor: c.ink }]} />
        </View>
        <View style={[s.between, { marginTop: 6 }]}>
          <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 12 }}>{peso(e.spent, hide)} spent</Text>
          <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 12 }}>of {peso(e.plan, hide)} · marker = pace</Text>
        </View>
      </Pressable>
      {open ? (
        <View style={{ marginTop: 8, gap: 6 }}>
          {e.txns.length === 0 ? (
            <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 14 }}>Nothing yet. Pip is proud.</Text>
          ) : (
            e.txns.map((t) => (
              <View key={t.id} style={s.between}>
                <View style={{ flex: 1 }}>
                  <Body bold>{t.merchant ?? 'Expense'}</Body>
                  <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 12 }}>
                    {shortDate(manilaDate(t.occurredAt))} · {t.accountName}
                    {t.status === 'pending' ? ' · pending' : ''}
                  </Text>
                </View>
                <Amount value={money(-t.amount)} />
              </View>
            ))
          )}
        </View>
      ) : null}
    </View>
  );
}

function Envelopes({ envelopes, dayNumber, daysTotal }: { envelopes: Envelope[]; dayNumber: number; daysTotal: number }) {
  const c = useTheme();
  const ratio = dayNumber / daysTotal;
  return (
    <View style={{ gap: 8 }}>
      <View style={s.between}>
        <Text style={[s.h2, { color: c.ink, fontFamily: fonts.display }]}>Planned vs spent</Text>
        <Label>this cutoff</Label>
      </View>
      {envelopes.length === 0 ? (
        <Notice>No spending envelopes yet. Add budget lines in Budget on the web and they appear here.</Notice>
      ) : (
        envelopes.map((e, i) => <EnvelopeRow key={e.categoryId} e={e} ratio={ratio} open={i === 0} />)
      )}
    </View>
  );
}

function Bills({ view }: { view: NowView }) {
  const c = useTheme();
  const sent = view.bills.filter((b) => b.sent).length;
  return (
    <Card>
      <View style={s.between}>
        <Text style={[s.h2, { color: c.ink, fontFamily: fonts.display }]}>Bills and transfers</Text>
        {view.bills.length > 0 ? (
          <View style={[s.pill, { backgroundColor: sent === view.bills.length ? c.tint : c.soft }]}>
            <Text style={{ color: sent === view.bills.length ? c.accentText : c.muted, fontFamily: fonts.bodyBold, fontSize: 12 }}>
              {sent} of {view.bills.length} sent
            </Text>
          </View>
        ) : null}
      </View>
      {view.bills.length === 0 ? (
        <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 14 }}>Budget lines that go to an account show here for the cutoff.</Text>
      ) : (
        <>
          {view.bills.map((b) => (
            <View key={b.lineId} style={[s.between, { minHeight: 36 }]}>
              <View style={[s.row, { flex: 1 }]}>
                <View style={[s.check, { backgroundColor: b.sent ? c.accent : 'transparent', borderColor: b.sent ? c.accent : c.line }]} accessibilityLabel={b.sent ? 'sent' : 'not sent yet'}>
                  {b.sent ? <Text style={{ color: c.onAccent, fontSize: 12, fontFamily: fonts.bodyBold }}>✓</Text> : null}
                </View>
                <Body>{b.name}</Body>
              </View>
              <Amount value={b.amount} style={{ color: b.sent ? c.muted : c.ink }} />
            </View>
          ))}
          <View style={[s.between, { borderTopWidth: 1, borderTopColor: c.line, paddingTop: 10, marginTop: 2 }]}>
            <Body bold>Sent this cutoff</Body>
            <Amount value={view.billsTotalSent} />
          </View>
        </>
      )}
    </Card>
  );
}

const s = StyleSheet.create({
  hero: { borderRadius: 14, padding: 16, gap: 8 },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  heroLabel: { color: '#bfe9dc', fontSize: 12, letterSpacing: 0.8 },
  heroAmount: { color: '#ffffff', fontFamily: fonts.display, fontSize: 32, lineHeight: 38, marginTop: 2 },
  heroSub: { color: '#d3efe6', fontSize: 13 },
  addBtn: { minHeight: 44, borderRadius: 999, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 16, height: 6, borderRadius: 3 },
  h2: { fontSize: 16 },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  link: { minHeight: 44, justifyContent: 'center' },
  env: { borderRadius: 10, borderWidth: 1, padding: 14 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  pill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 2 },
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  marker: { position: 'absolute', top: -3, width: 2, height: 14, borderRadius: 1 },
  check: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
});
