import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Chip, Card, Label } from '~/components/ui';
import { Sheet, SheetActions } from '~/components/Sheet';
import { setUsualOfficeDays } from '~/lib/budgetOps';
import { supabase } from '~/lib/supabase';
import { fonts, useTheme } from '~/lib/theme';

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** The weekdays you usually go to the office. Tap to change them in a sheet. */
export function OfficeDaysCard() {
  const c = useTheme();
  const [days, setDays] = useState<number[]>([]);
  const [picked, setPicked] = useState<number[]>([]);
  const [open, setOpen] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let live = true;
      void supabase
        .from('user_settings')
        .select('office_days')
        .maybeSingle()
        .then(({ data }) => {
          if (live && data) setDays((data.office_days as number[] | null) ?? []);
        });
      return () => {
        live = false;
      };
    }, []),
  );

  async function save() {
    setBusy(true);
    setProblem(null);
    const r = await setUsualOfficeDays(supabase, picked);
    setBusy(false);
    if ('error' in r) setProblem(r.error);
    else {
      setDays(picked);
      setOpen(false);
    }
  }

  return (
    <>
      <Pressable
        onPress={() => {
          setPicked(days);
          setOpen(true);
        }}
        accessibilityRole="button"
        accessibilityLabel="Change office days"
      >
        <Card>
          <Label>Office days</Label>
          <View style={s.between}>
            <Text style={{ color: c.ink, fontFamily: fonts.body, fontSize: 15 }}>{days.length ? [...days].sort().map((d) => DOW[d - 1]).join(', ') : 'None'}</Text>
            <Text style={{ color: c.muted, fontSize: 18 }}>›</Text>
          </View>
        </Card>
      </Pressable>
      {open ? (
        <Sheet title="Usual office days" onClose={() => setOpen(false)}>
          <View style={s.chips}>
            {DOW.map((d, i) => (
              <Chip key={d} label={d} on={picked.includes(i + 1)} onPress={() => setPicked((p) => (p.includes(i + 1) ? p.filter((x) => x !== i + 1) : [...p, i + 1]))} />
            ))}
          </View>
          <SheetActions onClose={() => setOpen(false)} onSave={save} busy={busy} problem={problem} />
        </Sheet>
      ) : null}
    </>
  );
}

const s = StyleSheet.create({
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
