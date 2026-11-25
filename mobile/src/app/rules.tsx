import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SOURCES, SOURCE_INFO, type CaptureRule, type SourceKey } from '@/lib/capture/sources';
import { Body, Card, Chip, Label, Notice, Screen } from '~/components/ui';
import { CHANNEL_LABEL, RuleEditor } from '~/components/RuleEditor';
import { PatternsCard } from '~/components/PatternsCard';
import { SourceEditor } from '~/components/SourceEditor';
import { applyAllowlist } from '~/lib/allowlist';
import { useHeldCount } from '~/lib/CaptureRunner';
import { loadCapture, moveRule, saveDedupeRule, saveGmailAlert, setRuleEnabled } from '~/lib/capture';
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
    const [capture, pickers, senders] = await Promise.all([loadCapture(supabase), loadPickers(supabase), loadSeenSenders(supabase)]);
    return { ...capture, accounts: pickers.accounts, categories: pickers.categories, senders };
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

  async function afterEdit() {
    setEditing(null);
    await reload();
  }
  async function toggleRule(r: CaptureRule, on: boolean) {
    const res = await setRuleEnabled(supabase, r.id, on);
    if ('error' in res) setProblem(res.error);
    await reload();
  }
  async function toggleGmailAlert(on: boolean) {
    if (!session) return;
    const res = await saveGmailAlert(supabase, session.user.id, on);
    if ('error' in res) setProblem(res.error);
    await reload();
    void loadCapture(supabase).then((d) => applyAllowlist(d.configs, d.gmailAlert)).catch(() => {});
  }
  async function move(r: CaptureRule, dir: -1 | 1) {
    if (!data) return;
    const res = await moveRule(supabase, data.rules, r.id, dir);
    if ('error' in res) setProblem(res.error);
    await reload();
  }

  const editingSourceCfg = data?.configs.find((x) => x.source === editingSource) ?? null;

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
          <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 13 }}>The first rule that matches decides. Ignore rules win over the rest.</Text>

          {data.rules.length === 0 ? <Notice>No rules yet. Add one below.</Notice> : null}
          {data.rules.map((r, i) => {
            const words = r.words?.length ? r.words : [r.matchText];
            return (
              <Card key={r.id}>
                <View style={s.row}>
                  <Pressable onPress={() => setEditing(r)} accessibilityRole="button" accessibilityLabel={`Edit rule ${r.name ?? r.matchText}`} style={{ flex: 1, gap: 4 }}>
                    <Body bold>{r.name || `“${r.matchText}”`}</Body>
                    <View style={s.chips}>
                      <View style={[s.pill, { backgroundColor: c.soft }]}>
                        <Text style={{ color: c.ink, fontFamily: fonts.bodyBold, fontSize: 12 }}>{CHANNEL_LABEL[r.channel ?? 'both']}</Text>
                      </View>
                    </View>
                    <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 13 }}>From {fromSummary(r)}</Text>
                    <View style={s.chips}>
                      {words.slice(0, 4).map((w) => (
                        <View key={w} style={[s.pill, { backgroundColor: c.soft }]}>
                          <Text style={{ color: c.ink, fontFamily: fonts.body, fontSize: 12 }}>{w}</Text>
                        </View>
                      ))}
                      {words.length > 4 ? <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 12 }}>+{words.length - 4}</Text> : null}
                    </View>
                  </Pressable>
                  <Switch value={r.enabled !== false} onValueChange={(on) => void toggleRule(r, on)} trackColor={{ true: c.accent, false: c.line }} thumbColor={c.ink} accessibilityLabel={`Rule ${r.name ?? r.matchText} on`} />
                </View>
                <View style={s.row}>
                  <Pressable onPress={() => void move(r, -1)} disabled={i === 0} accessibilityRole="button" accessibilityLabel="Move up" style={[s.small, { backgroundColor: c.soft, opacity: i === 0 ? 0.4 : 1 }]}>
                    <Text style={{ color: c.ink, fontFamily: fonts.bodyBold, fontSize: 13 }}>Up</Text>
                  </Pressable>
                  <Pressable onPress={() => void move(r, 1)} disabled={i === data.rules.length - 1} accessibilityRole="button" accessibilityLabel="Move down" style={[s.small, { backgroundColor: c.soft, opacity: i === data.rules.length - 1 ? 0.4 : 1 }]}>
                    <Text style={{ color: c.ink, fontFamily: fonts.bodyBold, fontSize: 13 }}>Down</Text>
                  </Pressable>
                </View>
              </Card>
            );
          })}
          <Pressable onPress={() => setEditing('new')} accessibilityRole="button" style={[s.btn, { backgroundColor: c.accent }]}>
            <Text style={{ color: c.onAccent, fontFamily: fonts.bodyBold, fontSize: 15 }}>+ New rule</Text>
          </Pressable>

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

          <Card>
            <Label>Sources</Label>
            {SOURCES.map((k) => {
              const cfg = data.configs.find((x) => x.source === k)!;
              const where = [cfg.packages.length ? `${cfg.packages.length} app${cfg.packages.length === 1 ? '' : 's'}` : null, cfg.senders.length ? `${cfg.senders.length} sender${cfg.senders.length === 1 ? '' : 's'}` : null].filter(Boolean).join(' · ') || 'No app or sender set yet';
              return (
                <Pressable key={k} onPress={() => setEditingSource(k)} accessibilityRole="button" accessibilityLabel={`Edit ${SOURCE_INFO[k].label}`} style={[s.row, { minHeight: 52 }]}>
                  <View style={{ flex: 1 }}>
                    <Body bold>{SOURCE_INFO[k].label}</Body>
                    <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 13 }}>
                      {cfg.enabled ? 'On' : 'Off'} · {where}
                      {cfg.autoConfirm ? ' · confirms itself' : ''}
                    </Text>
                  </View>
                  <Text style={{ color: c.muted, fontSize: 18 }}>›</Text>
                </Pressable>
              );
            })}
          </Card>

          <PatternsCard patterns={data.patterns} onChanged={reload} />
        </>
      ) : null}

      {data && !data.missing && tab === 'dedupe' && session ? (
        <DedupeCard key={`${data.dedupe.windowMin}-${data.dedupe.matchSource}`} userId={session.user.id} windowMin={data.dedupe.windowMin} matchSource={data.dedupe.matchSource} onSaved={reload} />
      ) : null}

      {editing && data ? (
        <RuleEditor
          rule={editing === 'new' ? null : editing}
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
          accounts={data.accounts}
          categories={data.categories}
          onClose={() => setEditingSource(null)}
          onSaved={() => {
            setEditingSource(null);
            void loadCapture(supabase).then((d) => applyAllowlist(d.configs, d.gmailAlert)).catch(() => {});
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

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  pill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  input: { minHeight: 48, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15 },
  btn: { minHeight: 48, borderRadius: 999, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center' },
  small: { minHeight: 40, borderRadius: 999, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
});
