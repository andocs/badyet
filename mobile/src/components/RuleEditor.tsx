import { rulesWithDraft } from '@/lib/capture/draft';
import type { CapturePattern } from '@/lib/capture/patterns';
import type { AccountLite } from '@/lib/capture/row';
import { Reading, Result, Step } from '~/components/RuleSteps';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RULE_CHANNELS, RULE_KINDS, SOURCES, SOURCE_INFO, type CaptureRule, type RuleChannel, type RuleKind, type SourceKey, isCustomSlot, type SourceConfig } from '@/lib/capture/sources';
import { Body, Chip, Label } from '~/components/ui';
import { saveRuleFull, deleteRule } from '~/lib/capture';
import type { AppInfo, SenderInfo } from '~/lib/deviceApps';
import { supabase } from '~/lib/supabase';
import { fonts, useTheme } from '~/lib/theme';

type Option = { id: string; name: string };

/** What the sample test needs besides the thing being edited. */
export interface TestData {
  configs: SourceConfig[];
  rules: CaptureRule[];
  patterns: CapturePattern[];
  accounts: AccountLite[];
}

export const CHANNEL_LABEL: Record<RuleChannel, string> = { notifications: 'Notifications', emails: 'Emails', both: 'Both' };
const KIND_LABEL: Record<RuleKind, string> = { spending: 'Spending', income: 'Income', transfer: 'Transfer', payment: 'Payment' };

const toList = (text: string) => text.split(/[,\n]/).map((w) => w.trim()).filter(Boolean);

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  const c = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <Label>{label}</Label>
      {children}
      {hint ? <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 12 }}>{hint}</Text> : null}
    </View>
  );
}

/** The sheet that edits one capture rule (a new one when `rule` is null). */
export function RuleEditor({
  rule, accounts, categories, installed, recent, senders, test, order, onPatternsChanged, onClose, onSaved,
}: {
  /** What the sample test needs besides the thing being edited. */
  test: TestData;
  /** The saved rule's switch and place in the order. */
  order: { number: number; first: boolean; last: boolean; enabled: boolean; onToggle: (v: boolean) => void; onMove: (dir: -1 | 1) => void } | null;
  onPatternsChanged: () => void | Promise<void>;
  rule: CaptureRule | null;
  accounts: Option[];
  categories: Option[];
  installed: AppInfo[];
  recent: string[];
  senders: SenderInfo[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState(rule?.name ?? '');
  const [channel, setChannel] = useState<RuleChannel>(rule?.channel ?? 'both');
  const [sources, setSources] = useState<SourceKey[]>(rule?.sources ?? (rule?.source ? [rule.source] : []));
  const [packages, setPackages] = useState<string[]>(rule?.packages ?? []);
  const [fromSenders, setFromSenders] = useState<string[]>(rule?.senders ?? []);
  const [words, setWords] = useState((rule?.words?.length ? rule.words : rule?.matchText ? [rule.matchText] : []).join(', '));
  const [must, setMust] = useState((rule?.mustWords ?? []).join(', '));
  const [skip, setSkip] = useState((rule?.skipWords ?? []).join(', '));
  const [ignore, setIgnore] = useState(rule?.action === 'ignore');
  const [kind, setKind] = useState<RuleKind>(rule?.kind ?? 'spending');
  const [categoryId, setCategoryId] = useState<string | null>(rule?.categoryId ?? null);
  const [fromId, setFromId] = useState<string | null>(rule?.fromAccountId ?? null);
  const [toId, setToId] = useState<string | null>(rule?.toOther ? 'others' : (rule?.toAccountId ?? null));
  const [toOther, setToOther] = useState(rule?.toOther ?? '');
  const toAccount = toId === 'others' ? null : toId;
  const [autoConfirm, setAutoConfirm] = useState(rule?.autoConfirm ?? rule?.action === 'auto_confirm');
  const [picker, setPicker] = useState<null | 'app' | 'sender'>(null);
  const [sample, setSample] = useState('');
  const [reading, setReading] = useState<SourceKey | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const moves = !ignore && (kind === 'transfer' || kind === 'payment');
  const labelOf = new Map(installed.map((a) => [a.package, a.label]));
  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const draft: CaptureRule = {
    id: rule?.id ?? 'draft', source: null, matchText: toList(words)[0] ?? '', action: ignore ? 'ignore' : 'record', enabled: order?.enabled ?? true, channel, words: toList(words), mustWords: toList(must), skipWords: toList(skip),
    sources, packages, senders: fromSenders, kind, categoryId, fromAccountId: moves ? fromId : null, toAccountId: moves ? toAccount : null, toOther: moves && toId === 'others' ? toOther.trim() || null : null, autoConfirm,
  };
  // Which source's patterns and reader the sample is tried with: one the rule is limited to, else any of yours.
  const readable = sources.length > 0 ? test.configs.filter((x) => sources.includes(x.source)) : test.configs;
  const source: SourceKey = reading && readable.some((x) => x.source === reading) ? reading : (readable[0]?.source ?? 'gcash');
  const config = test.configs.find((x) => x.source === source);
  const channels = channel === 'notifications' ? (['notification'] as const) : channel === 'emails' ? (['email'] as const) : undefined;
  const ruleNames = new Map(test.rules.map((r) => [r.id, r.name || r.words?.[0] || r.matchText]));
  ruleNames.set(draft.id, name.trim() || draft.matchText || 'this rule');
  const accountName = (id: string | null) => (id === 'others' ? `${toOther.trim() || 'someone'} (others)` : id ? (accounts.find((a) => a.id === id)?.name ?? 'Account') : 'asks in the Inbox');
  const whatSummary = ignore ? 'Ignored' : `${KIND_LABEL[kind]}${moves && (fromId || toId) ? ` · ${accountName(fromId)} → ${accountName(toId)}` : ''}`;

  async function save() {
    setBusy(true);
    setProblem(null);
    const r = await saveRuleFull(supabase, rule?.id ?? null, {
      name, enabled: order?.enabled ?? rule?.enabled ?? true, channel, words: toList(words), mustWords: toList(must), skipWords: toList(skip), sources, packages, senders: fromSenders,
      action: ignore ? 'ignore' : 'record', kind, categoryId, fromAccountId: fromId, toAccountId: toAccount, toOther: toId === 'others' ? toOther : null, autoConfirm,
    });
    setBusy(false);
    if ('error' in r) setProblem(r.error);
    else onSaved();
  }

  async function remove() {
    if (!rule) return;
    setBusy(true);
    const r = await deleteRule(supabase, rule.id);
    setBusy(false);
    if ('error' in r) setProblem(r.error);
    else onSaved();
  }

  const input = [s.input, { color: c.ink, backgroundColor: c.soft, fontFamily: fonts.body }];
  const switchProps = { trackColor: { true: c.accent, false: c.line }, thumbColor: c.ink } as const;

  return (
    <Modal visible animationType="slide" transparent onRequestClose={picker ? () => setPicker(null) : onClose}>
      <Pressable style={s.scrim} onPress={onClose} accessibilityLabel="Close" />
      <View style={[s.sheet, { backgroundColor: c.surface, borderColor: c.line, paddingBottom: insets.bottom + 16 }]}>
        <View style={[s.grab, { backgroundColor: c.line }]} />
        {picker === 'app' ? (
          <AppPicker installed={installed} recent={recent} chosen={packages} onToggle={(p) => setPackages((l) => toggle(l, p))} onDone={() => setPicker(null)} />
        ) : picker === 'sender' ? (
          <SenderPicker senders={senders} chosen={fromSenders} onToggle={(a) => setFromSenders((l) => toggle(l, a))} onDone={() => setPicker(null)} />
        ) : (
          <ScrollView contentContainerStyle={{ gap: 14 }} keyboardShouldPersistTaps="handled">
            <Text style={{ color: c.ink, fontFamily: fonts.display, fontSize: 20 }}>
              {rule ? 'Edit rule' : 'New rule'}
              {order ? ` · Rule ${order.number}` : ''}
            </Text>
            {order ? (
              <View style={s.between}>
                <Switch value={order.enabled} onValueChange={order.onToggle} accessibilityLabel="This rule on or off" {...switchProps} />
                <View style={{ flex: 1 }}>
                  <Body bold>This rule is {order.enabled ? 'on' : 'off'}</Body>
                </View>
                {([[-1, '↑', 'Try this rule earlier', order.first], [1, '↓', 'Try this rule later', order.last]] as const).map(([dir, sign, label, off]) => (
                  <Pressable key={dir} onPress={() => order.onMove(dir)} disabled={off} accessibilityRole="button" accessibilityLabel={label} style={[s.btn, { backgroundColor: c.soft, opacity: off ? 0.4 : 1, paddingHorizontal: 16 }]}>
                    <Text style={{ color: c.ink, fontFamily: fonts.bodyBold, fontSize: 15 }}>{sign}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}

            <Field label="Name">
              <TextInput value={name} onChangeText={setName} maxLength={60} placeholder="Like GCash cashback" placeholderTextColor={c.muted} style={input} />
            </Field>

            <Step n={1} title="Where to listen" summary={`${CHANNEL_LABEL[channel]} · ${sources.length + packages.length + fromSenders.length === 0 ? 'everywhere' : [...sources.map((k) => SOURCE_INFO[k].label), ...packages, ...fromSenders].join(', ')}`} startOpen={!rule}>
            <Field label="Listen on">
              <View style={s.chips}>
                {RULE_CHANNELS.map((x) => (
                  <Chip key={x} label={CHANNEL_LABEL[x]} on={channel === x} onPress={() => setChannel(x)} />
                ))}
              </View>
            </Field>

            <Field label="From" hint="Leave empty to match anywhere.">
              <View style={s.chips}>
                {SOURCES.filter((k) => !isCustomSlot(k)).map((k) => (
                  <Chip key={k} label={SOURCE_INFO[k].label} on={sources.includes(k)} onPress={() => setSources((l) => toggle(l, k))} />
                ))}
                {packages.map((p) => (
                  <Chip key={p} label={`${labelOf.get(p) ?? p}  ×`} on onPress={() => setPackages((l) => l.filter((x) => x !== p))} />
                ))}
                {fromSenders.map((a) => (
                  <Chip key={a} label={`${a}  ×`} on onPress={() => setFromSenders((l) => l.filter((x) => x !== a))} />
                ))}
                <Chip label="+ App" on={false} onPress={() => setPicker('app')} />
                <Chip label="+ Sender" on={false} onPress={() => setPicker('sender')} />
              </View>
            </Field>

            </Step>

            <Step n={2} title="How it's read" summary={`Shared by all of ${config?.label ?? SOURCE_INFO[source].label}`}>
              <Reading source={source} setSource={setReading} options={readable.map((x) => x.source)} configs={test.configs} patterns={test.patterns} channels={channels} sample={sample} setSample={setSample} onPatternsChanged={onPatternsChanged} />
            </Step>

            <Step n={3} title="Which messages" summary={toList(words).length ? `Contains ${toList(words).slice(0, 3).join(', ')}` : 'Add a word to look for'} startOpen={!rule}>
            <Field label="Words (any of these)" hint="Separate with commas.">
              <TextInput value={words} onChangeText={setWords} autoCapitalize="none" placeholder="cashback, refund" placeholderTextColor={c.muted} style={input} />
            </Field>
            <Field label="Must also contain">
              <TextInput value={must} onChangeText={setMust} autoCapitalize="none" placeholder="optional" placeholderTextColor={c.muted} style={input} />
            </Field>
            <Field label="Skip if contains">
              <TextInput value={skip} onChangeText={setSkip} autoCapitalize="none" placeholder="optional" placeholderTextColor={c.muted} style={input} />
            </Field>

            </Step>

            <Step n={4} title="What to do" summary={whatSummary} startOpen>
            <View style={s.between}>
              <View style={{ flex: 1 }}>
                <Body bold>Ignore</Body>
                <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 12 }}>Drop what matches instead of recording it.</Text>
              </View>
              <Switch value={ignore} onValueChange={setIgnore} accessibilityLabel="Ignore" {...switchProps} />
            </View>

            {!ignore ? (
              <>
                <Field label="What it is">
                  <View style={s.chips}>
                    {RULE_KINDS.map((k) => (
                      <Chip key={k} label={KIND_LABEL[k]} on={kind === k} onPress={() => setKind(k)} />
                    ))}
                  </View>
                </Field>

                {kind === 'spending' ? (
                  <Field label="Category">
                    <View style={s.chips}>
                      <Chip label="Ask in Inbox" on={categoryId === null} onPress={() => setCategoryId(null)} />
                      {categories.map((x) => (
                        <Chip key={x.id} label={x.name} on={categoryId === x.id} onPress={() => setCategoryId(x.id)} />
                      ))}
                    </View>
                  </Field>
                ) : null}

                {moves ? (
                  <>
                    <Field label="Money leaves">
                      <View style={s.chips}>
                        <Chip label="Ask in Inbox" on={fromId === null} onPress={() => setFromId(null)} />
                        {accounts.map((a) => (
                          <Chip key={a.id} label={a.name} on={fromId === a.id} onPress={() => setFromId(a.id)} />
                        ))}
                      </View>
                    </Field>
                    <Field label="Money arrives in">
                      <View style={s.chips}>
                        <Chip label="Ask in Inbox" on={toId === null} onPress={() => setToId(null)} />
                        {accounts.map((a) => (
                          <Chip key={a.id} label={a.name} on={toId === a.id} onPress={() => setToId(a.id)} />
                        ))}
                        <Chip label="Others (someone else's account)" on={toId === 'others'} onPress={() => setToId('others')} />
                      </View>
                    </Field>
                    {toId === 'others' ? (
                      <Field label="Whose account is it?">
                        <TextInput value={toOther} onChangeText={setToOther} maxLength={80} placeholder="Name, bank and last digits" placeholderTextColor={c.muted} accessibilityLabel="Whose account is it" style={input} />
                        <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 12 }}>It waits in the Inbox, where you choose: a loan, spending or not spending.</Text>
                      </Field>
                    ) : null}
                  </>
                ) : null}

                <View style={s.between}>
                  <View style={{ flex: 1 }}>
                    <Body bold>Confirm automatically</Body>
                    <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 12 }}>Only when everything it needs is set. Otherwise it waits in the Inbox.</Text>
                  </View>
                  <Switch value={autoConfirm} onValueChange={setAutoConfirm} accessibilityLabel="Confirm automatically" {...switchProps} />
                </View>
              </>
            ) : null}

            {moves ? (
              <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 12 }}>
                Whatever you set here is used. If one side is left to the Inbox, the item waits there: press Transfer and pick the other account. If the other account then sends its own message, it is not added twice.
              </Text>
            ) : null}
            {config?.autoConfirm && !autoConfirm && !ignore ? (
              <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 12 }}>&quot;Everything else from {config.label}&quot; confirms automatically, and that also applies to this rule.</Text>
            ) : null}
            </Step>

            <Step n={5} title="What happens with the sample" summary={sample.trim() ? 'Tap to see the result' : 'Paste a sample in step 2'}>
              {config ? (
                <Result sample={sample} configs={test.configs} allPatterns={test.patterns} ruleId={ignore ? null : draft.id} ruleNames={ruleNames} categoryName={new Map(categories.map((x) => [x.id, x.name]))}
                  setup={{ source, config, rules: rulesWithDraft(test.rules, draft), patterns: test.patterns, accounts: test.accounts, channels, from: sources.length === 0 ? (packages[0] ?? fromSenders[0]) : undefined }} />
              ) : null}
            </Step>

            {problem ? <Text style={{ color: c.err, fontFamily: fonts.body, fontSize: 14 }}>{problem}</Text> : null}
            <View style={s.between}>
              {rule ? (
                <Pressable onPress={remove} disabled={busy} accessibilityRole="button" style={[s.btn, { backgroundColor: c.soft }]}>
                  <Text style={{ color: c.err, fontFamily: fonts.bodyBold, fontSize: 15 }}>Delete</Text>
                </Pressable>
              ) : null}
              <Pressable onPress={onClose} accessibilityRole="button" style={[s.btn, { flex: 1, backgroundColor: c.soft }]}>
                <Text style={{ color: c.ink, fontFamily: fonts.bodyBold, fontSize: 15 }}>Cancel</Text>
              </Pressable>
              <Pressable onPress={save} disabled={busy} accessibilityRole="button" style={[s.btn, { flex: 1, backgroundColor: c.accent, opacity: busy ? 0.6 : 1 }]}>
                <Text style={{ color: c.onAccent, fontFamily: fonts.bodyBold, fontSize: 15 }}>{busy ? 'Saving…' : 'Save'}</Text>
              </Pressable>
            </View>
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

function PickerShell({ title, onDone, children }: { title: string; onDone: () => void; children: React.ReactNode }) {
  const c = useTheme();
  return (
    <ScrollView contentContainerStyle={{ gap: 12 }} keyboardShouldPersistTaps="handled">
      <View style={s.between}>
        <Text style={{ flex: 1, color: c.ink, fontFamily: fonts.display, fontSize: 20 }}>{title}</Text>
        <Pressable onPress={onDone} accessibilityRole="button" style={[s.small, { backgroundColor: c.accent }]}>
          <Text style={{ color: c.onAccent, fontFamily: fonts.bodyBold, fontSize: 14 }}>Done</Text>
        </Pressable>
      </View>
      {children}
    </ScrollView>
  );
}

function AppPicker({ installed, recent, chosen, onToggle, onDone }: { installed: AppInfo[]; recent: string[]; chosen: string[]; onToggle: (p: string) => void; onDone: () => void }) {
  const c = useTheme();
  const [tab, setTab] = useState<'recent' | 'all'>('recent');
  const [typed, setTyped] = useState('');
  const labelOf = new Map(installed.map((a) => [a.package, a.label]));
  const list: AppInfo[] = tab === 'recent' ? recent.map((p) => ({ package: p, label: labelOf.get(p) ?? p })) : installed;
  const typedId = typed.trim().toLowerCase();
  return (
    <PickerShell title="Pick an app" onDone={onDone}>
      <View style={s.chips}>
        <Chip label="Recent" on={tab === 'recent'} onPress={() => setTab('recent')} />
        <Chip label="All apps" on={tab === 'all'} onPress={() => setTab('all')} />
      </View>
      {list.length === 0 ? (
        <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 14 }}>{tab === 'recent' ? 'No app has posted a notification yet.' : 'The app list is not available on this build. Type an app id below.'}</Text>
      ) : null}
      {list.map((a) => (
        <Pressable key={a.package} onPress={() => onToggle(a.package)} accessibilityRole="button" accessibilityState={{ selected: chosen.includes(a.package) }} style={s.row}>
          <View style={{ flex: 1 }}>
            <Body bold>{a.label}</Body>
            {a.label !== a.package ? <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 12 }}>{a.package}</Text> : null}
          </View>
          <Text style={{ color: c.accentText, fontFamily: fonts.bodyBold }}>{chosen.includes(a.package) ? 'Added' : 'Add'}</Text>
        </Pressable>
      ))}
      <Label>Type an app id</Label>
      <View style={s.between}>
        <TextInput value={typed} onChangeText={setTyped} autoCapitalize="none" autoCorrect={false} placeholder="com.example.app" placeholderTextColor={c.muted} style={[s.input, { flex: 1, color: c.ink, backgroundColor: c.soft, fontFamily: fonts.body }]} />
        <Pressable
          onPress={() => {
            if (typedId && !chosen.includes(typedId)) onToggle(typedId);
            setTyped('');
          }}
          accessibilityRole="button"
          style={[s.small, { backgroundColor: c.soft }]}
        >
          <Text style={{ color: c.ink, fontFamily: fonts.bodyBold, fontSize: 14 }}>Add</Text>
        </Pressable>
      </View>
    </PickerShell>
  );
}

function SenderPicker({ senders, chosen, onToggle, onDone }: { senders: SenderInfo[]; chosen: string[]; onToggle: (a: string) => void; onDone: () => void }) {
  const c = useTheme();
  const [typed, setTyped] = useState('');
  const address = typed.trim().toLowerCase();
  return (
    <PickerShell title="Pick a sender" onDone={onDone}>
      {senders.length === 0 ? <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 14 }}>No senders seen yet. They appear after Gmail checks your mail. You can also type one below.</Text> : null}
      {senders.map((x) => (
        <Pressable key={x.address} onPress={() => onToggle(x.address)} accessibilityRole="button" accessibilityState={{ selected: chosen.includes(x.address) }} style={s.row}>
          <View style={{ flex: 1 }}>
            <Body bold>{x.address}</Body>
            <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 12 }}>{x.emails} email{x.emails === 1 ? '' : 's'}</Text>
          </View>
          <Text style={{ color: c.accentText, fontFamily: fonts.bodyBold }}>{chosen.includes(x.address) ? 'Added' : 'Add'}</Text>
        </Pressable>
      ))}
      <Label>Type an address or @domain</Label>
      <View style={s.between}>
        <TextInput value={typed} onChangeText={setTyped} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" placeholder="name@bank.com or @bank.com" placeholderTextColor={c.muted} style={[s.input, { flex: 1, color: c.ink, backgroundColor: c.soft, fontFamily: fonts.body }]} />
        <Pressable
          onPress={() => {
            if (address && !chosen.includes(address)) onToggle(address);
            setTyped('');
          }}
          accessibilityRole="button"
          style={[s.small, { backgroundColor: c.soft }]}
        >
          <Text style={{ color: c.ink, fontFamily: fonts.bodyBold, fontSize: 14 }}>Add</Text>
        </Pressable>
      </View>
    </PickerShell>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52 },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  input: { minHeight: 48, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15 },
  btn: { minHeight: 48, borderRadius: 999, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center' },
  small: { minHeight: 40, borderRadius: 999, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { maxHeight: '90%', borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1, padding: 16, gap: 12 },
  grab: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2 },
});
