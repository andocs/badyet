import { seenPackages } from '@modules/notification-listener';
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SOURCE_INFO, type SourceConfig } from '@/lib/capture/sources';
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

const s = StyleSheet.create({
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  input: { minHeight: 48, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15 },
  btn: { minHeight: 48, borderRadius: 999, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center' },
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { maxHeight: '90%', borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1, padding: 16, gap: 12 },
  grab: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2 },
});
