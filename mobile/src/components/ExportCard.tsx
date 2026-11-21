import { useState } from 'react';
import { Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { Card, Chip, Label } from '~/components/ui';
import { Sheet } from '~/components/Sheet';
import { EXPORTS, exportCsv } from '~/lib/exportData';
import { supabase } from '~/lib/supabase';
import { fonts, useTheme } from '~/lib/theme';

const NAME = (n: string) => n.replace(/_v2$/, '').replace(/_/g, ' ');

/** Your data as CSV: pick a table and share it (to Drive, email, a spreadsheet app). Never raw notification text. */
export function ExportCard() {
  const c = useTheme();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  async function share(name: string) {
    setBusy(name);
    setProblem(null);
    const r = await exportCsv(supabase, name);
    setBusy(null);
    if ('error' in r) return setProblem(r.error);
    if (r.csv === '') return setProblem('That table is empty.');
    try {
      await Share.share({ title: `badyet-${name}.csv`, message: r.csv });
    } catch {
      setProblem('Could not open the share sheet.');
    }
  }

  return (
    <>
      <Pressable onPress={() => setOpen(true)} accessibilityRole="button">
        <Card>
          <Label>Export data</Label>
          <View style={s.between}>
            <Text style={{ color: c.ink, fontFamily: fonts.body, fontSize: 15 }}>Share your tables as CSV</Text>
            <Text style={{ color: c.muted, fontSize: 18 }}>›</Text>
          </View>
        </Card>
      </Pressable>
      {open ? (
        <Sheet title="Export data" onClose={() => setOpen(false)}>
          <View style={s.chips}>
            {EXPORTS.map((n) => (
              <Chip key={n} label={busy === n ? 'Preparing…' : NAME(n)} on={false} onPress={() => void share(n)} />
            ))}
          </View>
          {problem ? <Text style={{ color: c.err, fontFamily: fonts.body, fontSize: 14 }}>{problem}</Text> : null}
        </Sheet>
      ) : null}
    </>
  );
}

const s = StyleSheet.create({
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
