import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { BUILTIN_FORMATS, readSample, suggestPattern, type Channel, type SampleSetup } from '@/lib/capture/explain';
import type { CapturePattern } from '@/lib/capture/patterns';
import { describeOther, describeSample, type ResultBox } from '@/lib/capture/result-view';
import { SOURCE_INFO, type SourceConfig, type SourceKey } from '@/lib/capture/sources';
import { money } from '@/lib/domain/money';
import { PatternsCard } from '~/components/PatternsCard';
import { Body, Chip, Label } from '~/components/ui';
import { useHide } from '~/lib/hide';
import { peso } from '~/lib/money';
import { fonts, useTheme } from '~/lib/theme';

/** One numbered section of the Rules editor; tap it to open or close. Closed, it says what is set. */
export function Step({ n, title, summary, startOpen = false, children }: { n: number; title: string; summary: string; startOpen?: boolean; children: React.ReactNode }) {
  const c = useTheme();
  const [open, setOpen] = useState(startOpen);
  return (
    <View style={[s.box, { borderColor: c.line }]}>
      <Pressable onPress={() => setOpen((o) => !o)} accessibilityRole="button" accessibilityState={{ expanded: open }} style={s.head}>
        <View style={[s.num, { backgroundColor: c.accent }]}>
          <Text style={{ color: c.onAccent, fontFamily: fonts.display, fontSize: 13 }}>{n}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Body bold>{title}</Body>
          <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 12 }}>{summary}</Text>
        </View>
        <Text style={{ color: c.muted, fontSize: 16 }}>{open ? '⌃' : '⌄'}</Text>
      </Pressable>
      {/* Kept mounted while closed, so what you typed stays. */}
      <View style={[s.body, open ? null : { display: 'none' }]}>{children}</View>
    </View>
  );
}

const labelOf = (configs: readonly SourceConfig[], source: SourceKey) => configs.find((x) => x.source === source)?.label ?? SOURCE_INFO[source].label;

function ReadPills({ label, text, source, patterns, channels }: { label: string; text: string; source: SourceKey; patterns: CapturePattern[]; channels?: readonly Channel[] }) {
  const c = useTheme();
  const { hide } = useHide();
  const read = readSample(source, text, patterns, channels);
  if (!read) return <Text style={{ color: c.err, fontFamily: fonts.bodyBold, fontSize: 14 }}>{label} can&apos;t read this message</Text>;
  const p = read.parsed;
  const parts = [
    `Amount ${peso(money(p.amount), hide)}`,
    `money ${p.direction}`,
    p.counterparty ? `${p.direction === 'out' ? 'to' : 'from'} ${p.counterparty}` : null,
    p.accountName ? `account named ${p.accountName}` : null,
    p.accountHint ? `your account ··${p.accountHint}` : null,
    p.ref ? `ref ${p.ref}` : null,
  ].filter(Boolean);
  return (
    <Text style={{ color: c.accentText, fontFamily: fonts.bodyBold, fontSize: 13 }}>
      Read by {read.by === 'pattern' ? 'your pattern' : `${label}'s built-in reader`}: {parts.join(' · ')}
    </Text>
  );
}

function SampleInput({ value, onChange, placeholder }: { value: string; onChange: (t: string) => void; placeholder: string }) {
  const c = useTheme();
  return <TextInput value={value} onChangeText={onChange} multiline maxLength={1500} placeholder={placeholder} placeholderTextColor={c.muted} style={[s.input, { color: c.ink, backgroundColor: c.soft, fontFamily: fonts.body }]} />;
}

/** Step 2: the patterns and built-in reader of one source, and a sample to try. Shared by every rule of that source. */
export function Reading({ source, setSource, options, configs, patterns, channels, sample, setSample, onPatternsChanged }: {
  source: SourceKey; setSource?: (s: SourceKey) => void; options?: SourceKey[]; configs: SourceConfig[]; patterns: CapturePattern[]; channels?: readonly Channel[];
  sample: string; setSample: (s: string) => void; onPatternsChanged: () => void | Promise<void>;
}) {
  const c = useTheme();
  const label = labelOf(configs, source);
  const formats = BUILTIN_FORMATS[source] ?? {};
  const lists = (['notification', 'email'] as const).flatMap((x) => (formats[x] ? [{ channel: x, list: formats[x]! }] : []));
  const [shown, setShown] = useState(false);
  const [seed, setSeed] = useState<{ key: number; template: string; sample: string; direction: 'in' | 'out' } | null>(null);
  const [none, setNone] = useState(false);
  const unreadable = sample.trim() !== '' && !readSample(source, sample, patterns, channels);
  const make = () => {
    const template = suggestPattern(sample);
    setNone(template === null);
    if (template) setSeed((x) => ({ key: (x?.key ?? 0) + 1, template, sample: sample.trim(), direction: /receiv|credit/i.test(sample) ? 'in' : 'out' }));
  };
  return (
    <View style={{ gap: 10 }}>
      {options && setSource && options.length > 1 ? (
        <View style={{ gap: 6 }}>
          <Label>Try reading as</Label>
          <View style={s.chips}>
            {options.map((k) => (
              <Chip key={k} label={labelOf(configs, k)} on={k === source} onPress={() => setSource(k)} />
            ))}
          </View>
        </View>
      ) : null}
      <Text style={{ color: c.ink, fontFamily: fonts.body, fontSize: 13 }}>The amount and money in or out come from here, not from a rule&apos;s words. Changing this affects everything from {label}.</Text>
      <PatternsCard key={`${source}-${seed?.key ?? 0}`} patterns={patterns} sources={configs} only={source} seed={seed ?? undefined} onChanged={onPatternsChanged} />
      {lists.length === 0 ? (
        <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 13 }}>{label} has no built-in reader: only your patterns can read it.</Text>
      ) : (
        <>
          <Pressable onPress={() => setShown((v) => !v)} accessibilityRole="button" accessibilityState={{ expanded: shown }} style={[s.soft, { backgroundColor: c.soft }]}>
            <Text style={{ color: c.ink, fontFamily: fonts.bodyBold, fontSize: 14 }}>
              Built-in {label} reader: {lists.reduce((t, l) => t + l.list.length, 0)} message types {shown ? '⌃' : '⌄'}
            </Text>
          </Pressable>
          {shown ? (
            <>
              {lists.flatMap(({ channel, list }) =>
                list.map((f) => (
                  <View key={`${channel}-${f.label}`} style={[s.box, { borderColor: c.line, padding: 10, gap: 6 }]}>
                    <Body bold>
                      {f.label} ({channel})
                    </Body>
                    <Text style={{ color: c.ink, fontFamily: fonts.body, fontSize: 13 }}>{f.wording}</Text>
                    <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 12 }}>Reads: {f.reads}</Text>
                    <Pressable onPress={() => setSample(f.example)} accessibilityRole="button" accessibilityLabel={`Try ${f.label}`} style={[s.soft, { backgroundColor: c.soft, alignSelf: 'flex-start' }]}>
                      <Text style={{ color: c.ink, fontFamily: fonts.bodyBold, fontSize: 13 }}>Try this</Text>
                    </Pressable>
                  </View>
                )),
              )}
              <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 12 }}>A plain summary. A message worded another way is not read: add a pattern for it. Your pattern wins over the built-in reader.</Text>
            </>
          ) : null}
        </>
      )}
      <Label>Sample message</Label>
      <SampleInput value={sample} onChange={setSample} placeholder="Paste a notification or email here. It stays on this screen." />
      {sample.trim() === '' ? null : <ReadPills source={source} label={label} text={sample} patterns={patterns} channels={channels} />}
      {unreadable ? (
        <View style={{ gap: 8 }}>
          <Text style={{ color: c.ink, fontFamily: fonts.body, fontSize: 13 }}>The app would ignore this message, whatever your rules say.</Text>
          <Pressable onPress={make} accessibilityRole="button" style={[s.soft, { backgroundColor: c.accent }]}>
            <Text style={{ color: c.onAccent, fontFamily: fonts.bodyBold, fontSize: 14 }}>+ Make a pattern from this sample</Text>
          </Pressable>
          {none ? <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 12 }}>No amount in figures was found. Write the pattern yourself above.</Text> : null}
        </View>
      ) : null}
    </View>
  );
}

function Box({ box }: { box: ResultBox }) {
  const c = useTheme();
  const { hide } = useHide();
  return (
    <View style={[s.result, { backgroundColor: c.soft }]}>
      {box.lines.map((l) => (
        <View key={l.title} style={s.line} accessible accessibilityLabel={`${l.state === 'ok' ? 'Yes' : 'No'}: ${l.title}. ${l.sub ?? ''}`}>
          <View style={[s.mark, { backgroundColor: l.state === 'ok' ? c.accent : l.state === 'bad' ? c.errTint : c.surface }]}>
            <Text style={{ color: l.state === 'ok' ? c.onAccent : l.state === 'bad' ? c.err : c.muted, fontFamily: fonts.bodyBold, fontSize: 13 }}>{l.state === 'ok' ? '✓' : l.state === 'bad' ? '✕' : '–'}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: c.ink, fontFamily: l.sub ? fonts.bodyBold : fonts.body, fontSize: 13 }}>{l.title}</Text>
            {l.sub ? <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 12 }}>{l.sub}</Text> : null}
          </View>
        </View>
      ))}
      {box.heading ? <Label>{box.heading}</Label> : null}
      {box.entries.map((e, i) => (
        <View key={i} style={[s.entry, { backgroundColor: c.surface }]}>
          <View style={{ flex: 1 }}>
            <Body bold>{e.name}</Body>
            <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 12 }}>{e.kind}</Text>
          </View>
          <Text style={{ color: c.ink, fontFamily: fonts.bodyBold, fontSize: 15 }}>
            {e.amount < 0 ? '−' : '+'}
            {peso(money(Math.abs(e.amount)), hide)}
          </Text>
        </View>
      ))}
      {box.foot ? <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 12 }}>{box.foot}</Text> : null}
    </View>
  );
}

/** Step 5: what the sample would do, and (optionally) whether the other account's message belongs with it. */
export function Result({ setup, sample, configs, allPatterns, ruleId, ruleNames, categoryName }: {
  setup: SampleSetup; sample: string; configs: SourceConfig[]; allPatterns: CapturePattern[]; ruleId: string | null; ruleNames: Map<string, string>; categoryName: Map<string, string>;
}) {
  const c = useTheme();
  const [otherSource, setOtherSource] = useState<SourceKey>(setup.source);
  const [otherText, setOtherText] = useState('');
  if (sample.trim() === '') return <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 13 }}>Paste a sample in step 2 to see what it would do.</Text>;
  const { box, outcome } = describeSample(sample, setup, { source: labelOf(configs, setup.source), ruleId, rules: ruleNames, categories: categoryName });
  const otherConfig = configs.find((x) => x.source === otherSource);
  const otherBox = otherConfig ? describeOther(outcome, otherText, { ...setup, source: otherSource, config: otherConfig, patterns: allPatterns, channels: undefined, from: undefined }, otherConfig.label) : null;
  return (
    <View style={{ gap: 10 }}>
      <Box box={box} />
      {outcome.kind === 'kept' ? (
        <View style={{ gap: 8 }}>
          <Label>Other side from</Label>
          <View style={s.chips}>
            {configs.map((x) => (
              <Chip key={x.source} label={x.source === setup.source ? `${x.label} (this source)` : x.label} on={x.source === otherSource} onPress={() => setOtherSource(x.source)} />
            ))}
          </View>
          <Label>The other side&apos;s message (optional)</Label>
          <SampleInput value={otherText} onChange={setOtherText} placeholder="Paste what the other account sends, if it sends anything" />
          {otherText.trim() === '' ? null : <ReadPills source={otherSource} label={labelOf(configs, otherSource)} text={otherText} patterns={allPatterns} />}
        </View>
      ) : null}
      {otherBox ? <Box box={otherBox} /> : null}
    </View>
  );
}

const s = StyleSheet.create({
  box: { borderWidth: 1, borderRadius: 12 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, minHeight: 56 },
  body: { paddingHorizontal: 12, paddingBottom: 12, gap: 10 },
  num: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  input: { minHeight: 72, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, textAlignVertical: 'top' },
  soft: { minHeight: 44, borderRadius: 999, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  result: { borderRadius: 10, padding: 12, gap: 8 },
  line: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  mark: { width: 22, height: 22, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  entry: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 8, padding: 10 },
});
