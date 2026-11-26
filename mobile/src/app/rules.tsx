import { groupRules } from '@/lib/capture/explain';
import type { AccountLite } from '@/lib/capture/row';
import { formatPesos, money } from '@/lib/domain/money';
import { setSourceRemoved } from '@/lib/capture/source-write';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SOURCE_INFO, type CaptureRule, type SourceConfig, type SourceKey, isUnusedSlot } from '@/lib/capture/sources';
import { Body, Card, Chip, Label, Notice, Screen } from '~/components/ui';
import { RuleEditor } from '~/components/RuleEditor';
import { SourceEditor } from '~/components/SourceEditor';
import { applyAllowlist } from '~/lib/allowlist';
import { useHeldCount } from '~/lib/CaptureRunner';
import { loadCapture, moveRule, saveDedupeRule, saveGmailAlert, saveSource, setRuleEnabled } from '~/lib/capture';
import { loadSeenSenders, readPhoneApps, syncDeviceApps, type AppInfo } from '~/lib/deviceApps';
import { loadPickers } from '~/lib/pickers';
import { useSession } from '~/lib/session';
import { supabase } from '~/lib/supabase';
import { fonts, useTheme } from '~/lib/theme';
import { useLoad } from '~/lib/useLoad';

type Tab = 'rules' | 'dedupe';

function fromSummary(r: CaptureRule): string {
  const parts = [
    ...(r.sources ?? (r.source ? [r.source] : [])).map((k) => SOURCE_INFO[k].label),
    ...(r.packages ?? []).length ? [`${r.packages!.length} app${r.packages!.length === 1 ? '' : 's'}`] : [],
    ...(r.senders ?? []).length ? [`${r.senders!.length} sender${r.senders!.length === 1 ? '' : 's'}`] : [],
  ];
  if (parts.length === 0 && r.source) parts.push(SOURCE_INFO[r.source].label);
  return parts.length ? parts.join(' · ') : 'Anywhere';
}

export default function Rules() {
  const c = useTheme();
  const router = useRouter();
  const { session } = useSession();
  const { data, error, refreshing, reload } = useLoad(async () => {
    const [capture, pickers, senders, accountRows] = await Promise.all([loadCapture(supabase), loadPickers(supabase), loadSeenSenders(supabase), supabase.from('accounts').select('id, name, institution, last4').is('archived_at', null)]);
    return { ...capture, accounts: pickers.accounts, categories: pickers.categories, senders, testAccounts: (accountRows.data ?? []) as AccountLite[] };
  });
  const held = useHeldCount();
  const [tab, setTab] = useState<Tab>('rules');
  // Read once when the page opens: the apps this phone has.
  const [phone] = useState<{ installed: AppInfo[]; recent: string[] }>(() => readPhoneApps());
  const [editing, setEditing] = useState<CaptureRule | 'new' | null>(null);
  const [editingSource, setEditingSource] = useState<SourceKey | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  // Opening the page tells the database which apps this phone has, so the web can offer them too.
  useEffect(() => {
    void syncDeviceApps(supabase, phone.installed, phone.recent).catch(() => {});
  }, [phone]);

  // A rule's own apps are listened to, so the phone's list changes when rules do.
  const refreshAllowlist = () => void loadCapture(supabase).then((d) => applyAllowlist(d.configs, d.gmailAlert, d.rules)).catch(() => {});
  async function afterEdit() {
    setEditing(null);
    await reload();
    refreshAllowlist();
  }
  async function toggleRule(r: CaptureRule, on: boolean) {
    const res = await setRuleEnabled(supabase, r.id, on);
    if ('error' in res) setProblem(res.error);
    await reload();
    refreshAllowlist();
  }
  async function toggleSource(cfg: SourceConfig, on: boolean) {
    if (!session) return;
    const res = await saveSource(supabase, session.user.id, { source: cfg.source, enabled: on, packages: cfg.packages.join('\n'), senders: cfg.senders.join('\n'), accountId: cfg.accountId, categoryId: cfg.categoryId, autoConfirm: cfg.autoConfirm, minAmount: cfg.minAmount > 0 ? formatPesos(money(cfg.minAmount), { symbol: false }) : '', label: cfg.label });
    if ('error' in res) setProblem(res.error);
    await reload();
    refreshAllowlist();
  }
  async function toggleGmailAlert(on: boolean) {
    if (!session) return;
    const res = await saveGmailAlert(supabase, session.user.id, on);
    if ('error' in res) setProblem(res.error);
    await reload();
    void loadCapture(supabase).then((d) => applyAllowlist(d.configs, d.gmailAlert, d.rules)).catch(() => {});
  }
  async function move(r: CaptureRule, dir: -1 | 1) {
    if (!data) return;
    const res = await moveRule(supabase, data.rules, r.id, dir);
    if ('error' in res) setProblem(res.error);
    await reload();
  }

  const editingSourceCfg = data?.configs.find((x) => x.source === editingSource) ?? null;
  const test = data ? { configs: data.configs.filter((x) => !x.removed), rules: data.rules, patterns: data.patterns, accounts: data.testAccounts } : null;
  // The switch and order of the rule being edited, as they are now.
  const editingId = editing && editing !== 'new' ? editing.id : null;
  const editingAt = editingId && data ? data.rules.findIndex((r) => r.id === editingId) : -1;
  const editingNow = editingAt >= 0 ? data!.rules[editingAt]! : null;
  const order = editingNow ? { number: editingAt + 1, first: editingAt === 0, last: editingAt === data!.rules.length - 1, enabled: editingNow.enabled !== false, onToggle: (v: boolean) => void toggleRule(editingNow, v), onMove: (dir: -1 | 1) => void move(editingNow, dir) } : null;

  return (
    <Screen title="Rules" refreshing={refreshing} onRefresh={reload}>
      <Pressable onPress={() => router.back()} accessibilityRole="link" style={{ minHeight: 44, justifyContent: 'center' }}>
        <Text style={{ color: c.accentText, fontFamily: fonts.bodyBold, fontSize: 14 }}>‹ Back</Text>
      </Pressable>
      <View style={s.chips}>
        <Chip label="Capture rules" on={tab === 'rules'} onPress={() => setTab('rules')} />
        <Chip label="Duplicate rule" on={tab === 'dedupe'} onPress={() => setTab('dedupe')} />
      </View>
      {error ? <Notice tone="error">{error}</Notice> : null}
      {problem ? <Notice tone="error">{problem}</Notice> : null}
      {!data && !error ? <Notice>Loading…</Notice> : null}
      {data?.missing ? <Notice>The capture settings need a database update first: apply supabase/migrations/20261207000000_capture_rules.sql, then pull down to refresh.</Notice> : null}

      {data && !data.missing && tab === 'rules' ? (
        <>
          {held > 0 ? (
            <Notice>
              {held} capture{held === 1 ? ' is' : 's are'} waiting for an account. Open the Inbox to say which account each one belongs to.
            </Notice>
          ) : null}
          <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 13 }}>Numbers are the order rules are tried, across every source. The first match decides. Ignore rules always win. If none matches, &quot;Everything else&quot; applies.</Text>
          <Pressable onPress={() => setEditing('new')} accessibilityRole="button" style={[s.btn, { backgroundColor: c.accent }]}>
            <Text style={{ color: c.onAccent, fontFamily: fonts.bodyBold, fontSize: 15 }}>+ New rule</Text>
          </Pressable>

          {(() => {
            const live = data.configs.filter((x) => !x.removed);
            const grouped = groupRules(data.rules, live.map((x) => x.source));
            const row = (r: CaptureRule, showWhere: boolean) => {
              const words = r.words?.length ? r.words : [r.matchText];
              const what = r.action === 'ignore' ? 'Ignored' : KIND_LABEL[r.kind ?? 'spending'];
              return (
                <Pressable key={r.id} onPress={() => setEditing(r)} accessibilityRole="button" accessibilityLabel={`Edit rule ${r.name ?? r.matchText}`} style={[s.item, { backgroundColor: c.soft, borderColor: c.line, opacity: r.enabled === false ? 0.65 : 1 }]}>
                  <View style={[s.no, { backgroundColor: c.surface }]}>
                    <Text style={{ color: c.ink, fontFamily: fonts.display, fontSize: 12 }}>{grouped.numberOf.get(r.id)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Body bold>{r.name || `“${r.matchText}”`}</Body>
                    <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 12 }}>
                      {showWhere ? `${fromSummary(r)} · ` : ''}
                      {words.slice(0, 2).join(', ')} → {what}
                      {r.enabled === false ? ' · off' : ''}
                    </Text>
                  </View>
                </Pressable>
              );
            };
            return (
              <>
                {grouped.groups.map(({ source, rules: mine }) => {
                  const cfg = live.find((x) => x.source === source)!;
                  const where = [cfg.packages.length ? `${cfg.packages.length} app${cfg.packages.length === 1 ? '' : 's'}` : null, cfg.senders.length ? `${cfg.senders.length} sender${cfg.senders.length === 1 ? '' : 's'}` : null].filter(Boolean).join(' · ') || 'No app or sender set yet';
                  return (
                    <Card key={source}>
                      <View style={s.row}>
                        <View style={{ flex: 1 }}>
                          <Body bold>{cfg.label}</Body>
                        </View>
                        <Switch value={cfg.enabled} onValueChange={(on) => void toggleSource(cfg, on)} trackColor={{ true: c.accent, false: c.line }} thumbColor={c.ink} accessibilityLabel={`${cfg.label} on or off`} />
                      </View>
                      {mine.map((r) => row(r, false))}
                      <Pressable onPress={() => setEditingSource(source)} accessibilityRole="button" accessibilityLabel={`Edit everything else from ${cfg.label}`} style={[s.item, { borderColor: c.line, borderStyle: 'dashed' }]}>
                        <View style={[s.no, { backgroundColor: c.surface }]}>
                          <Text style={{ color: c.ink, fontFamily: fonts.display, fontSize: 12 }}>…</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Body bold>Everything else from {cfg.label}</Body>
                          <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 12 }}>
                            {cfg.enabled ? '' : 'Off · '}
                            {where}
                            {cfg.autoConfirm ? ' · confirms itself' : ''}
                          </Text>
                        </View>
                      </Pressable>
                    </Card>
                  );
                })}
                {grouped.shared.length > 0 ? (
                  <Card>
                    <Label>Several or any source</Label>
                    {grouped.shared.map((r) => row(r, true))}
                  </Card>
                ) : null}
              </>
            );
          })()}

          {(() => {
              const next = data.configs.find((x) => isUnusedSlot(x, data.patterns));
              return next ? (
                <Pressable
                  onPress={() =>
                    void setSourceRemoved(supabase, next.source, false).then(async (r) => {
                      if ('error' in r) return setProblem(r.error);
                      await reload();
                      setEditingSource(next.source);
                    })
                  }
                  accessibilityRole="button"
                  style={{ minHeight: 44, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: c.soft }}
                >
                  <Text style={{ color: c.ink, fontFamily: fonts.bodyBold, fontSize: 14 }}>+ Another app or bank</Text>
                </Pressable>
              ) : null;
            })()}
          {data.configs.some((x) => x.removed && !isUnusedSlot(x, data.patterns)) ? (
            <Card>
              <Label>Removed</Label>
              {data.configs.filter((x) => x.removed && !isUnusedSlot(x, data.patterns)).map((x) => (
                <View key={x.source} style={[s.row, { minHeight: 44 }]}>
                  <Body>{x.label}</Body>
                  <Pressable
                    onPress={() => void setSourceRemoved(supabase, x.source, false).then((r) => ('error' in r ? setProblem(r.error) : reload()))}
                    accessibilityRole="button"
                    style={{ minHeight: 36, paddingHorizontal: 14, borderRadius: 999, justifyContent: 'center', backgroundColor: c.soft }}
                  >
                    <Text style={{ color: c.ink, fontFamily: fonts.bodyBold, fontSize: 13 }}>Add back</Text>
                  </Pressable>
                </View>
              ))}
            </Card>
          ) : null}

          <Card>
            <Label>Gmail</Label>
            <View style={s.row}>
              <View style={{ flex: 1 }}>
                <Body bold>Check Gmail when Gmail notifies</Body>
                <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 13 }}>When the Gmail app shows a notification, read your new bank emails right away. The notification itself is never read.</Text>
              </View>
              <Switch value={data.gmailAlert} onValueChange={(on) => void toggleGmailAlert(on)} trackColor={{ true: c.accent, false: c.line }} thumbColor={c.ink} accessibilityLabel="Check Gmail when Gmail notifies" />
            </View>
          </Card>

        </>
      ) : null}

      {data && !data.missing && tab === 'dedupe' && session ? (
        <DedupeCard key={`${data.dedupe.windowMin}-${data.dedupe.matchSource}`} userId={session.user.id} windowMin={data.dedupe.windowMin} matchSource={data.dedupe.matchSource} onSaved={reload} />
      ) : null}

      {editing && data ? (
        <RuleEditor
          rule={editing === 'new' ? null : editing}
          test={test!}
          order={order}
          onPatternsChanged={reload}
          accounts={data.accounts}
          categories={data.categories}
          installed={phone.installed}
          recent={phone.recent}
          senders={data.senders}
          onClose={() => setEditing(null)}
          onSaved={() => void afterEdit()}
        />
      ) : null}

      {editingSourceCfg && data ? (
        <SourceEditor
          cfg={editingSourceCfg}
          test={test!}
          onPatternsChanged={reload}
          accounts={data.accounts}
          categories={data.categories}
          onClose={() => setEditingSource(null)}
          onSaved={() => {
            setEditingSource(null);
            void loadCapture(supabase).then((d) => applyAllowlist(d.configs, d.gmailAlert, d.rules)).catch(() => {});
            void reload();
          }}
        />
      ) : null}
    </Screen>
  );
}

/** The one duplicate rule: how close in time, and whether the source has to match too. */
function DedupeCard({ userId, windowMin, matchSource, onSaved }: { userId: string; windowMin: number; matchSource: boolean; onSaved: () => void }) {
  const c = useTheme();
  const hours = windowMin >= 60 && windowMin % 60 === 0;
  const [unit, setUnit] = useState<'min' | 'hours'>(hours ? 'hours' : 'min');
  const [amount, setAmount] = useState(String(hours ? windowMin / 60 : windowMin));
  const [same, setSame] = useState(matchSource);
  const [problem, setProblem] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    setProblem(null);
    setSaved(false);
    const n = Number(amount.trim());
    const r = await saveDedupeRule(supabase, userId, { windowMin: Math.round(n * (unit === 'hours' ? 60 : 1)), matchSource: same });
    setBusy(false);
    if ('error' in r) setProblem(r.error);
    else {
      setSaved(true);
      onSaved();
    }
  }

  return (
    <Card>
      <Label>Duplicate rule</Label>
      <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 13 }}>
        A phone alert and an email for the same money count once when they arrive within this time of each other, with the same amount and direction.
      </Text>
      <Label>Within</Label>
      <View style={s.row}>
        <TextInput value={amount} onChangeText={setAmount} keyboardType="number-pad" accessibilityLabel="Window" style={[s.input, { flex: 1, color: c.ink, backgroundColor: c.soft, fontFamily: fonts.body }]} />
        <Chip label="min" on={unit === 'min'} onPress={() => setUnit('min')} />
        <Chip label="hours" on={unit === 'hours'} onPress={() => setUnit('hours')} />
      </View>
      <Label>Match</Label>
      <View style={s.chips}>
        <Chip label="Same source" on={same} onPress={() => setSame(true)} />
        <Chip label="Any sources" on={!same} onPress={() => setSame(false)} />
      </View>
      {problem ? <Text style={{ color: c.err, fontFamily: fonts.body, fontSize: 14 }}>{problem}</Text> : null}
      {saved ? <Text style={{ color: c.accentText, fontFamily: fonts.bodyBold, fontSize: 14 }}>Saved.</Text> : null}
      <Pressable onPress={save} disabled={busy} accessibilityRole="button" style={[s.btn, { backgroundColor: c.accent, opacity: busy ? 0.6 : 1 }]}>
        <Text style={{ color: c.onAccent, fontFamily: fonts.bodyBold, fontSize: 15 }}>{busy ? 'Saving…' : 'Save'}</Text>
      </Pressable>
    </Card>
  );
}

const KIND_LABEL = { spending: 'Spending', income: 'Income', transfer: 'Transfer', payment: 'Payment' } as const;

const s = StyleSheet.create({
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 10, padding: 10, minHeight: 56 },
  no: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  pill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  input: { minHeight: 48, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15 },
  btn: { minHeight: 48, borderRadius: 999, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center' },
  small: { minHeight: 40, borderRadius: 999, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
});
