import { Reading, Result, Step } from '~/components/RuleSteps';
import type { TestData } from '~/components/RuleEditor';
import { seenPackages } from '@modules/notification-listener';
import { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { canParseEmail } from '@/lib/capture/email';
import { canParse } from '@/lib/capture/parsers';
import { setSourceRemoved } from '@/lib/capture/source-write';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { isCustomSlot, SOURCE_INFO, type SourceConfig } from '@/lib/capture/sources';
import { formatPesos, money } from '@/lib/domain/money';
import { Body, Chip, Label } from '~/components/ui';
import { saveSource } from '~/lib/capture';
import { useSession } from '~/lib/session';
import { supabase } from '~/lib/supabase';
import { fonts, useTheme } from '~/lib/theme';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 6 }}>
      <Label>{label}</Label>
      {children}
    </View>
  );
}

type Option = { id: string; name: string };

/** Edits one source (GCash, Maya, ...): its apps, senders, usual account and category. Moved here from the old Capture rules screen. */
export function SourceEditor({
  cfg, accounts, categories, test, onPatternsChanged, onClose, onSaved,
}: {
  test: TestData;
  onPatternsChanged: () => void | Promise<void>;
  cfg: SourceConfig;
  accounts: Option[];
  categories: Option[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const { session } = useSession();
  const [name, setName] = useState(cfg.label);
  const info = { ...SOURCE_INFO[cfg.source], label: isCustomSlot(cfg.source) && name.trim() ? name.trim() : cfg.label };
  const [enabled, setEnabled] = useState(cfg.enabled);
  const [packages, setPackages] = useState(cfg.packages.join('\n'));
  const [senders, setSenders] = useState(cfg.senders.join('\n'));
  const [accountId, setAccountId] = useState<string | null>(cfg.accountId);
  const [categoryId, setCategoryId] = useState<string | null>(cfg.categoryId);
  const [autoConfirm, setAutoConfirm] = useState(cfg.autoConfirm);
  const [minAmount, setMinAmount] = useState(cfg.minAmount > 0 ? formatPesos(money(cfg.minAmount), { symbol: false }) : '');
  const [seen] = useState<string[]>(() => {
    try {
      return seenPackages();
    } catch {
      return [];
    }
  });
  const [problem, setProblem] = useState<string | null>(null);
  const [sample, setSample] = useState('');
  const [busy, setBusy] = useState(false);


  const addPackage = (p: string) => setPackages((t) => (t.split(/\s+/).includes(p) ? t : (t.trim() ? t.trim() + '\n' : '') + p));

  async function save() {
    if (!session) return;
    setBusy(true);
    setProblem(null);
    const r = await saveSource(supabase, session.user.id, { source: cfg.source, enabled, packages, senders, accountId, categoryId, autoConfirm, minAmount, label: name });
    setBusy(false);
    if ('error' in r) setProblem(r.error);
    else onSaved();
  }

  const remove = () =>
    Alert.alert(`Remove ${info.label}?`, 'It stops listening and moves to Removed. Its reader and settings stay; Add back restores them.', [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          const r = await setSourceRemoved(supabase, cfg.source, true);
          if ('error' in r) setProblem(r.error);
          else onSaved();
        },
      },
    ]);
  const notif = canParse(cfg.source);
  const email = canParseEmail(cfg.source);
  const reader = notif && email ? 'Built-in reader for notifications and emails.' : notif ? 'Built-in reader for notifications. Add a pattern in step 2 to read its emails.' : email ? 'Built-in reader for emails. Add a pattern to read its notifications.' : 'No built-in reader: add a pattern in step 2, or nothing from it can be read.';

  // The settings as they are on screen, so the sample shows what saving them would do.
  const lines = (t: string) => t.split(/[\s,]+/).filter(Boolean);
  const typedMin = Number(minAmount.replace(/,/g, ''));
  const draft: SourceConfig = { ...cfg, label: info.label, enabled, packages: lines(packages), senders: lines(senders), accountId, categoryId, autoConfirm, minAmount: Number.isFinite(typedMin) && typedMin > 0 ? Math.round(typedMin * 100) : 0 };
  const configs = test.configs.map((x) => (x.source === cfg.source ? draft : x));

  const input = [s.input, { color: c.ink, backgroundColor: c.soft, fontFamily: fonts.body }];
  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={s.scrim} onPress={onClose} accessibilityLabel="Close" />
      <View style={[s.sheet, { backgroundColor: c.surface, borderColor: c.line, paddingBottom: insets.bottom + 16 }]}>
        <View style={[s.grab, { backgroundColor: c.line }]} />
        <ScrollView contentContainerStyle={{ gap: 14 }} keyboardShouldPersistTaps="handled">
          <View style={s.between}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: c.ink, fontFamily: fonts.display, fontSize: 20 }}>Everything else from {info.label}</Text>
              <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 13 }}>Anything from {info.label} no rule above caught. {reader}</Text>
            </View>
            <Switch value={enabled} onValueChange={setEnabled} trackColor={{ true: c.accent, false: c.line }} thumbColor={c.ink} accessibilityLabel={`Capture ${info.label}`} />
          </View>

          {isCustomSlot(cfg.source) ? (
            <Field label="Name">
              <TextInput value={name} onChangeText={setName} maxLength={30} placeholder="e.g. ShopeePay" placeholderTextColor={c.muted} style={input} />
            </Field>
          ) : null}

          <Step n={1} title="Where to listen" summary={`${draft.packages.length} app${draft.packages.length === 1 ? '' : 's'} · ${draft.senders.length} sender${draft.senders.length === 1 ? '' : 's'}`}>
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
            <TextInput value={senders} onChangeText={setSenders} multiline autoCapitalize="none" autoCorrect={false} keyboardType="email-address" placeholder="name@bank.com or @bank.com" placeholderTextColor={c.muted} style={[...input, { minHeight: 64 }]} />
          </Field>

          </Step>

          <Step n={2} title="How it's read" summary={`Shared by all of ${info.label}`} startOpen>
            <Reading source={cfg.source} configs={configs} patterns={test.patterns} sample={sample} setSample={setSample} onPatternsChanged={onPatternsChanged} />
          </Step>

          <Step n={3} title="Which messages" summary="All that no rule caught">
            <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 13 }}>Everything from {info.label} that no rule caught. It has no words: it is the fallback.</Text>
          </Step>

          <Step n={4} title="What to do" summary={accountId ? `Goes to ${accounts.find((a) => a.id === accountId)?.name ?? 'an account'}` : 'Account read from the message'}>
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

          {accountId ? (
            <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 12 }}>Everything from {info.label} will go to this account, whatever the message says. Leave it on Inbox if one app speaks for several accounts, such as a wallet and its card.</Text>
          ) : null}
          <Label>Applies to all of {info.label}, including its rules</Label>
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

          </Step>

          <Step n={5} title="What happens with the sample" summary={sample.trim() ? 'Tap to see the result' : 'Paste a sample in step 2'}>
            <Result sample={sample} configs={configs} allPatterns={test.patterns} ruleId={null} ruleNames={new Map(test.rules.map((r) => [r.id, r.name || r.words?.[0] || r.matchText]))} categoryName={new Map(categories.map((x) => [x.id, x.name]))}
              setup={{ source: cfg.source, config: draft, rules: test.rules, patterns: test.patterns, accounts: test.accounts }} />
          </Step>

          {problem ? <Text style={{ color: c.err, fontFamily: fonts.body, fontSize: 14 }}>{problem}</Text> : null}
          <View style={s.between}>
            <Pressable onPress={onClose} accessibilityRole="button" style={[s.btn, { flex: 1, backgroundColor: c.soft }]}>
              <Text style={{ color: c.ink, fontFamily: fonts.bodyBold, fontSize: 15 }}>Cancel</Text>
            </Pressable>
            <Pressable onPress={save} disabled={busy} accessibilityRole="button" style={[s.btn, { flex: 1, backgroundColor: c.accent, opacity: busy ? 0.6 : 1 }]}>
              <Text style={{ color: c.onAccent, fontFamily: fonts.bodyBold, fontSize: 15 }}>{busy ? 'Saving…' : 'Save'}</Text>
            </Pressable>
          </View>
          <Pressable onPress={remove} accessibilityRole="button" style={[s.btn, { borderWidth: 1, borderColor: c.line }]}>
            <Text style={{ color: c.err, fontFamily: fonts.bodyBold, fontSize: 15 }}>Remove {info.label}</Text>
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  input: { minHeight: 48, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15 },
  btn: { minHeight: 48, borderRadius: 999, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center' },
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { maxHeight: '90%', borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1, padding: 16, gap: 12 },
  grab: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2 },
});
