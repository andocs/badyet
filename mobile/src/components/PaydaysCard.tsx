import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Card, Label } from '~/components/ui';
import { Field, Input, Sheet, SheetActions } from '~/components/Sheet';
import { savePaydays } from '~/lib/settingsWrite';
import { supabase } from '~/lib/supabase';
import { fonts, useTheme } from '~/lib/theme';

const ord = (n: number) => `${n}${n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th'}`;

/** The two paydays. Cutoffs run payday to payday. Tap to change them in a sheet. */
export function PaydaysCard() {
  const c = useTheme();
  const [first, setFirst] = useState('10');
  const [second, setSecond] = useState('25');
  const [open, setOpen] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
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
  }, []);
  useFocusEffect(load);

  async function save() {
    setBusy(true);
    setProblem(null);
    const r = await savePaydays(supabase, { first: Number(first), second: Number(second) });
    setBusy(false);
    if ('error' in r) setProblem(r.error);
    else setOpen(false);
  }

  const a = Number(first);
  const b = Number(second);
  return (
    <>
      <Pressable onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel="Change paydays">
        <Card>
          <Label>Paydays</Label>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ color: c.ink, fontFamily: fonts.body, fontSize: 15 }}>
              {ord(a)} and {ord(b)}
            </Text>
            <Text style={{ color: c.muted, fontSize: 18 }}>›</Text>
          </View>
        </Card>
      </Pressable>
      {open ? (
        <Sheet title="Paydays" onClose={() => setOpen(false)}>
          <Field label="First payday (day of the month)">
            <Input value={first} onChangeText={setFirst} keyboardType="number-pad" maxLength={2} />
          </Field>
          <Field label="Second payday (day of the month)">
            <Input value={second} onChangeText={setSecond} keyboardType="number-pad" maxLength={2} />
          </Field>
          {Number.isInteger(a) && Number.isInteger(b) && a > 0 && b > 1 ? (
            <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 12 }}>
              Paid the {ord(a)} covers the {ord(a + 1)}–{ord(b - 1)}; paid the {ord(b)} covers the {ord(b)}–{ord(a)} of next month.
            </Text>
          ) : null}
          <SheetActions onClose={() => setOpen(false)} onSave={save} busy={busy} problem={problem} />
        </Sheet>
      ) : null}
    </>
  );
}
