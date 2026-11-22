import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { CapturePattern } from '@/lib/capture/patterns';
import { testPattern } from '@/lib/capture/parsers';
import { SOURCES, SOURCE_INFO, type SourceKey } from '@/lib/capture/sources';
import { money } from '@/lib/domain/money';
import { Body, Card, Chip, Label } from '~/components/ui';
import { addPattern, removePattern } from '~/lib/capture';
import { peso } from '~/lib/money';
import { supabase } from '~/lib/supabase';
import { fonts, useTheme } from '~/lib/theme';

/** Your own notification patterns: write the wording with placeholders, try it on a sample, save it. The app turns it into a regex on the phone. */
export function PatternsCard({ patterns, onChanged }: { patterns: CapturePattern[]; onChanged: () => void | Promise<void> }) {
  const c = useTheme();
  const [source, setSource] = useState<SourceKey>('custom');
  const [direction, setDirection] = useState<'in' | 'out'>('in');
  const [template, setTemplate] = useState('');
  const [sample, setSample] = useState('');
  const [problem, setProblem] = useState<string | null>(null);

  const result = template.trim() !== '' && sample.trim() !== '' ? testPattern(template, direction, sample) : null;
  const input = { color: c.ink, backgroundColor: c.soft, fontFamily: fonts.body };

  async function add() {
    setProblem(null);
    const r = await addPattern(supabase, { source, template, direction }, patterns.length);
    if ('error' in r) return setProblem(r.error);
    setTemplate('');
    setSample('');
    await onChanged();
  }
  async function drop(p: CapturePattern) {
    const r = await removePattern(supabase, p.id);
    if ('error' in r) setProblem(r.error);
    else await onChanged();
  }

  return (
    <Card>
      <Label>Your own patterns</Label>
      <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 13 }}>
        Teach the app a notification without waiting for an update. Write the wording with placeholders:{'\n'}
        {'{amount}'} the amount (required) · {'{name}'} who it was with · {'{last4}'} the last digits of your account · {'{ref}'} a reference number · {'{any}'} anything you want to skip.
        {'\n'}Yours are tried before the built-in readers.
      </Text>
      {patterns.length === 0 ? <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 14 }}>No patterns yet.</Text> : null}
      {patterns.map((p) => (
        <View key={p.id} style={s.row}>
          <View style={{ flex: 1 }}>
            <Body bold>{p.template}</Body>
            <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 13 }}>
              {SOURCE_INFO[p.source].label} · money {p.direction === 'in' ? 'in' : 'out'}
            </Text>
          </View>
          <Pressable onPress={() => void drop(p)} accessibilityRole="button" accessibilityLabel={`Delete pattern ${p.template}`} style={[s.small, { backgroundColor: c.soft }]}>
            <Text style={{ color: c.ink, fontFamily: fonts.bodyBold, fontSize: 13 }}>Delete</Text>
          </Pressable>
        </View>
      ))}

      <Label>For</Label>
      <View style={s.chips}>
        {SOURCES.map((k) => (
          <Chip key={k} label={SOURCE_INFO[k].label} on={source === k} onPress={() => setSource(k)} />
        ))}
      </View>
      <Label>Money</Label>
      <View style={s.chips}>
        <Chip label="Comes in" on={direction === 'in'} onPress={() => setDirection('in')} />
        <Chip label="Goes out" on={direction === 'out'} onPress={() => setDirection('out')} />
      </View>
      <Label>Wording</Label>
      <TextInput value={template} onChangeText={setTemplate} maxLength={200} multiline placeholder="You received {amount} from {name}" placeholderTextColor={c.muted} style={[s.input, input]} />
      <Label>Try it on a real message</Label>
      <TextInput value={sample} onChangeText={setSample} maxLength={400} multiline placeholder="Paste a notification here to see what the pattern reads" placeholderTextColor={c.muted} style={[s.input, input]} />
      {result ? (
        <Text style={{ color: !result.ok || !result.parsed ? c.err : c.accentText, fontFamily: fonts.bodyBold, fontSize: 14 }}>
          {!result.ok
            ? result.error
            : result.parsed
              ? `Reads ${peso(money(result.parsed.amount), false)} ${result.parsed.direction === 'in' ? 'in' : 'out'}${result.parsed.counterparty ? ` · with ${result.parsed.counterparty}` : ''}${result.parsed.accountHint ? ` · account …${result.parsed.accountHint}` : ''}${result.parsed.ref ? ` · ref ${result.parsed.ref}` : ''}`
              : 'This pattern does not match that message.'}
        </Text>
      ) : null}
      {problem ? <Text style={{ color: c.err, fontFamily: fonts.body, fontSize: 14 }}>{problem}</Text> : null}
      <Pressable onPress={() => void add()} accessibilityRole="button" style={[s.btn, { backgroundColor: c.accent }]}>
        <Text style={{ color: c.onAccent, fontFamily: fonts.bodyBold, fontSize: 15 }}>Save pattern</Text>
      </Pressable>
    </Card>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  input: { minHeight: 48, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  small: { minHeight: 40, borderRadius: 10, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  btn: { minHeight: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
