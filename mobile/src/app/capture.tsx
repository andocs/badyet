import { seenPackages } from '@modules/notification-listener';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ACTION_LABEL, RULE_ACTIONS, SOURCES, SOURCE_INFO,
  type CaptureRule, type RuleAction, type SourceConfig, type SourceKey,
} from '@/lib/capture/sources';
import { formatPesos, money } from '@/lib/domain/money';
import { Body, Card, Label, Notice, Screen } from '~/components/ui';
import { applyAllowlist } from '~/lib/allowlist';
import { addRule, loadCapture, removeRule, saveSource } from '~/lib/capture';
import { loadPickers } from '~/lib/pickers';
import { useSession } from '~/lib/session';
import { supabase } from '~/lib/supabase';
import { fonts, useTheme } from '~/lib/theme';
import { useLoad } from '~/lib/useLoad';

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  const c = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: on }} style={[s.chip, { backgroundColor: on ? c.accent : c.soft }]}>
      <Text style={{ color: on ? c.onAccent : c.ink, fontFamily: fonts.bodyBold, fontSize: 14 }}>{label}</Text>
    </Pressable>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 6 }}>
      <Label>{label}</Label>
      {children}
    </View>
  );
}

type Option = { id: string; name: string };

function SourceEditor({
  cfg, accounts, categories, onClose, onSaved,
}: {
  cfg: SourceConfig;
  accounts: Option[];
  categories: Option[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const { session } = useSession();
  const info = SOURCE_INFO[cfg.source];
  const [enabled, setEnabled] = useState(cfg.enabled);
  const [packages, setPackages] = useState(cfg.packages.join('\n'));
  const [senders, setSenders] = useState(cfg.senders.join('\n'));
  const [accountId, setAccountId] = useState<string | null>(cfg.accountId);
  const [categoryId, setCategoryId] = useState<string | null>(cfg.categoryId);
  const [autoConfirm, setAutoConfirm] = useState(cfg.autoConfirm);
  const [minAmount, setMinAmount] = useState(cfg.minAmount > 0 ? formatPesos(money(cfg.minAmount), { symbol: false }) : '');
  const [seen, setSeen] = useState<string[]>([]);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    try {
      setSeen(seenPackages());
    } catch {
      setSeen([]);
    }
  }, []);

  const addPackage = (p: string) => setPackages((t) => (t.split(/\s+/).includes(p) ? t : (t.trim() ? t.trim() + '\n' : '') + p));

  async function save() {
    if (!session) return;
    setBusy(true);
    setProblem(null);
    const r = await saveSource(supabase, session.user.id, { source: cfg.source, enabled, packages, senders, accountId, categoryId, autoConfirm, minAmount });
    setBusy(false);
    if ('error' in r) setProblem(r.error);
    else onSaved();
  }

  const input = [s.input, { color: c.ink, backgroundColor: c.soft, fontFamily: fonts.body }];
  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={s.scrim} onPress={onClose} accessibilityLabel="Close" />
      <View style={[s.sheet, { backgroundColor: c.surface, borderColor: c.line, paddingBottom: insets.bottom + 16 }]}>
        <View style={[s.grab, { backgroundColor: c.line }]} />
        <ScrollView contentContainerStyle={{ gap: 14 }} keyboardShouldPersistTaps="handled">
          <View style={s.between}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: c.ink, fontFamily: fonts.display, fontSize: 20 }}>{info.label}</Text>
              <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 13 }}>{info.blurb}</Text>
            </View>
            <Switch value={enabled} onValueChange={setEnabled} trackColor={{ true: c.accent, false: c.line }} thumbColor={c.ink} accessibilityLabel={`Capture ${info.label}`} />
          </View>

          <Field label="Apps on this phone (one per line)">
            <TextInput value={packages} onChangeText={setPackages} multiline autoCapitalize="none" autoCorrect={false} placeholder="com.example.app" placeholderTextColor={c.muted} style={[...input, { minHeight: 64 }]} />
            {seen.length > 0 ? (
              <>
                <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 12 }}>Apps that have posted notifications on this phone. Tap to add.</Text>
                <View style={s.chips}>
                  {seen.map((p) => (
                    <Chip key={p} label={p} on={packages.split(/\s+/).includes(p)} onPress={() => addPackage(p)} />
                  ))}
                </View>
              </>
            ) : null}
          </Field>

          <Field label="Email senders (one per line)">
            <TextInput value={senders} onChangeText={setSenders} multiline autoCapitalize="none" autoCorrect={false} keyboardType="email-address" placeholder="name@bank.com" placeholderTextColor={c.muted} style={[...input, { minHeight: 64 }]} />
          </Field>

          <Field label="Usual account">
            <View style={s.chips}>
              <Chip label="Decide in Inbox" on={accountId === null} onPress={() => setAccountId(null)} />
              {accounts.map((a) => (
                <Chip key={a.id} label={a.name} on={accountId === a.id} onPress={() => setAccountId(a.id)} />
              ))}
            </View>
          </Field>

          <Field label="Usual category">
            <View style={s.chips}>
              <Chip label="Decide in Inbox" on={categoryId === null} onPress={() => setCategoryId(null)} />
              {categories.map((x) => (
                <Chip key={x.id} label={x.name} on={categoryId === x.id} onPress={() => setCategoryId(x.id)} />
              ))}
            </View>
          </Field>

          <Field label="Ignore amounts below (₱)">
            <TextInput value={minAmount} onChangeText={setMinAmount} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={c.muted} style={input} />
          </Field>

          <View style={s.between}>
            <View style={{ flex: 1 }}>
              <Body bold>Confirm without asking</Body>
              <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 12 }}>Only when the account is set, and a category for spending. Otherwise it waits in the Inbox.</Text>
            </View>
            <Switch value={autoConfirm} onValueChange={setAutoConfirm} trackColor={{ true: c.accent, false: c.line }} thumbColor={c.ink} accessibilityLabel="Confirm without asking" />
          </View>

          {problem ? <Text style={{ color: c.err, fontFamily: fonts.body, fontSize: 14 }}>{problem}</Text> : null}
          <View style={s.between}>
            <Pressable onPress={onClose} accessibilityRole="button" style={[s.btn, { flex: 1, backgroundColor: c.soft }]}>
              <Text style={{ color: c.ink, fontFamily: fonts.bodyBold, fontSize: 15 }}>Cancel</Text>
            </Pressable>
            <Pressable onPress={save} disabled={busy} accessibilityRole="button" style={[s.btn, { flex: 1, backgroundColor: c.accent, opacity: busy ? 0.6 : 1 }]}>
              <Text style={{ color: c.onAccent, fontFamily: fonts.bodyBold, fontSize: 15 }}>{busy ? 'Saving…' : 'Save'}</Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

export default function Capture() {
  const c = useTheme();
  const router = useRouter();
  const { data, error, refreshing, reload } = useLoad(async () => {
    const [capture, pickers] = await Promise.all([loadCapture(supabase), loadPickers(supabase)]);
    return { ...capture, accounts: pickers.accounts, categories: pickers.categories };
  });
  const [editing, setEditing] = useState<SourceKey | null>(null);
  const [source, setSource] = useState<'' | SourceKey>('');
  const [words, setWords] = useState('');
  const [action, setAction] = useState<RuleAction>('ignore');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const d = await loadCapture(supabase);
    applyAllowlist(d.configs);
    await reload();
  }, [reload]);

  async function add() {
    setProblem(null);
    const r = await addRule(supabase, { source: source || null, matchText: words, action, categoryId });
    if ('error' in r) return setProblem(r.error);
    setWords('');
    setCategoryId(null);
    await reload();
  }
  async function drop(rule: CaptureRule) {
    const r = await removeRule(supabase, rule.id);
    if ('error' in r) setProblem(r.error);
    else await reload();
  }

  const catName = new Map((data?.categories ?? []).map((x) => [x.id, x.name]));
  const editingCfg = data?.configs.find((x) => x.source === editing) ?? null;

  return (
    <Screen title="Capture rules" subtitle="How notifications and emails become pending items." refreshing={refreshing} onRefresh={reload}>
      <Pressable onPress={() => router.back()} accessibilityRole="link" style={{ minHeight: 44, justifyContent: 'center' }}>
        <Text style={{ color: c.accentText, fontFamily: fonts.bodyBold, fontSize: 14 }}>‹ Settings</Text>
      </Pressable>
      {error ? <Notice tone="error">{error}</Notice> : null}
      {!data && !error ? <Notice>Loading…</Notice> : null}
      {data?.missing ? <Notice>The capture settings need a database update first: apply supabase/migrations/20261207000000_capture_rules.sql, then pull down to refresh.</Notice> : null}

      {data && !data.missing ? (
        <>
          <Card>
            <Label>Sources</Label>
            {SOURCES.map((k) => {
              const cfg = data.configs.find((x) => x.source === k)!;
              const where = [cfg.packages.length ? `${cfg.packages.length} app${cfg.packages.length === 1 ? '' : 's'}` : null, cfg.senders.length ? `${cfg.senders.length} sender${cfg.senders.length === 1 ? '' : 's'}` : null].filter(Boolean).join(' · ') || 'No app or sender set yet';
              return (
                <Pressable key={k} onPress={() => setEditing(k)} accessibilityRole="button" accessibilityLabel={`Edit ${SOURCE_INFO[k].label}`} style={s.row}>
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

          <Card>
            <Label>Keyword rules</Label>
            <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 13 }}>When a notification or email contains these words, do this. Ignore rules win over the rest.</Text>
            {data.rules.length === 0 ? <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 14 }}>No keyword rules yet.</Text> : null}
            {data.rules.map((r) => (
              <View key={r.id} style={s.row}>
                <View style={{ flex: 1 }}>
                  <Body bold>“{r.matchText}”</Body>
                  <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 13 }}>
                    {r.source ? SOURCE_INFO[r.source].label : 'Any source'} → {ACTION_LABEL[r.action].toLowerCase()}
                    {r.action === 'set_category' ? `: ${catName.get(r.categoryId ?? '') ?? 'a category'}` : ''}
                  </Text>
                </View>
                <Pressable onPress={() => drop(r)} accessibilityRole="button" accessibilityLabel={`Delete rule ${r.matchText}`} style={[s.small, { backgroundColor: c.soft }]}>
                  <Text style={{ color: c.ink, fontFamily: fonts.bodyBold, fontSize: 13 }}>Delete</Text>
                </Pressable>
              </View>
            ))}
          </Card>

          <Card>
            <Label>Add a rule</Label>
            <TextInput value={words} onChangeText={setWords} maxLength={80} placeholder="Words to look for, like cashback" placeholderTextColor={c.muted} style={[s.input, { color: c.ink, backgroundColor: c.soft, fontFamily: fonts.body }]} />
            <Label>In</Label>
            <View style={s.chips}>
              <Chip label="Any source" on={source === ''} onPress={() => setSource('')} />
              {SOURCES.map((k) => (
                <Chip key={k} label={SOURCE_INFO[k].label} on={source === k} onPress={() => setSource(k)} />
              ))}
            </View>
            <Label>Then</Label>
            <View style={s.chips}>
              {RULE_ACTIONS.map((a) => (
                <Chip key={a} label={ACTION_LABEL[a]} on={action === a} onPress={() => setAction(a)} />
              ))}
            </View>
            {action === 'set_category' ? (
              <View style={s.chips}>
                {data.categories.map((x) => (
                  <Chip key={x.id} label={x.name} on={categoryId === x.id} onPress={() => setCategoryId(x.id)} />
                ))}
              </View>
            ) : null}
            {problem ? <Text style={{ color: c.err, fontFamily: fonts.body, fontSize: 14 }}>{problem}</Text> : null}
            <Pressable onPress={add} accessibilityRole="button" style={[s.btn, { backgroundColor: c.accent }]}>
              <Text style={{ color: c.onAccent, fontFamily: fonts.bodyBold, fontSize: 15 }}>Add rule</Text>
            </Pressable>
          </Card>
        </>
      ) : null}

      {editingCfg && data ? (
        <SourceEditor
          cfg={editingCfg}
          accounts={data.accounts}
          categories={data.categories}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void refresh();
          }}
        />
      ) : null}
    </Screen>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52 },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 40, borderRadius: 999, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  input: { minHeight: 48, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15 },
  btn: { minHeight: 48, borderRadius: 999, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center' },
  small: { minHeight: 40, borderRadius: 999, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { maxHeight: '90%', borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1, padding: 16, gap: 12 },
  grab: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2 },
});
