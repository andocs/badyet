import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Body, Card, Label } from '~/components/ui';
import { savePaydays } from '~/lib/settingsWrite';
import { supabase } from '~/lib/supabase';
import { fonts, useTheme } from '~/lib/theme';

const ord = (n: number) => `${n}${n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th'}`;

/** The two paydays. Cutoffs run payday to payday. */
export function PaydaysCard() {
  const c = useTheme();
  const [first, setFirst] = useState('10');
  const [second, setSecond] = useState('25');
  const [note, setNote] = useState<{ text: string; bad: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let live = true;
      void supabase
        .from('user_settings')
        .select('first_payday_day, second_payday_day')
        .maybeSingle()
        .then(({ data }) => {
          if (!live || !data) return;
          setFirst(String(data.first_payday_day));
          setSecond(String(data.second_payday_day));
        });
      return () => {
        live = false;
      };
    }, []),
  );

  async function save() {
    setBusy(true);
    const r = await savePaydays(supabase, { first: Number(first), second: Number(second) });
    setBusy(false);
    setNote('error' in r ? { text: r.error, bad: true } : { text: 'Paydays saved.', bad: false });
  }

  const a = Number(first);
  const b = Number(second);
  const input = [s.input, { color: c.ink, backgroundColor: c.soft, fontFamily: fonts.body }];
  return (
    <Card>
      <Label>Paydays</Label>
      <View style={s.two}>
        <View style={{ flex: 1, gap: 6 }}>
          <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 13 }}>First payday</Text>
          <TextInput value={first} onChangeText={setFirst} keyboardType="number-pad" maxLength={2} style={input} accessibilityLabel="First payday" />
        </View>
        <View style={{ flex: 1, gap: 6 }}>
          <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 13 }}>Second payday</Text>
          <TextInput value={second} onChangeText={setSecond} keyboardType="number-pad" maxLength={2} style={input} accessibilityLabel="Second payday" />
        </View>
      </View>
      {Number.isInteger(a) && Number.isInteger(b) && a > 0 && b > 1 ? (
        <Body>
          <Text style={{ color: c.muted, fontSize: 12 }}>
            Cutoffs run payday to payday: paid the {ord(a)} covers the {ord(a + 1)}–{ord(b - 1)}; paid the {ord(b)} covers the {ord(b)}–{ord(a)} of next month.
          </Text>
        </Body>
      ) : null}
      {note ? <Text style={{ color: note.bad ? c.err : c.accentText, fontFamily: fonts.body, fontSize: 14 }}>{note.text}</Text> : null}
      <Pressable onPress={save} disabled={busy} accessibilityRole="button" style={[s.btn, { backgroundColor: c.accent, opacity: busy ? 0.6 : 1 }]}>
        <Text style={{ color: c.onAccent, fontFamily: fonts.bodyBold, fontSize: 15 }}>{busy ? 'Saving…' : 'Save paydays'}</Text>
      </Pressable>
    </Card>
  );
}

const s = StyleSheet.create({
  two: { flexDirection: 'row', gap: 12 },
  input: { minHeight: 48, borderRadius: 10, paddingHorizontal: 14, fontSize: 16 },
  btn: { minHeight: 48, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
});
