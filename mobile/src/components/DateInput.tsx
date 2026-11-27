import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { dateText, monthGrid, monthText, shiftMonth, WEEKDAY_LETTERS } from '@/lib/domain/calendar';
import { todayManila } from '@/lib/plans/validate';
import { Chip } from '~/components/ui';
import { fonts, useTheme } from '~/lib/theme';

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const monthOfYear = (year: number, i: number) => `${year}-${String(i + 1).padStart(2, '0')}`;

/** The field both pickers share: it shows the choice and opens its panel under itself (inside the sheet, so no second pop-up). */
function Trigger({ label, text, empty, open, onPress }: { label: string; text: string; empty: boolean; open: boolean; onPress: () => void }) {
  const c = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${label}: ${text}. Change`} accessibilityState={{ expanded: open }} style={[s.field, { backgroundColor: c.soft, borderColor: open ? c.accent : c.line }]}>
      <Text style={{ color: empty ? c.muted : c.ink, fontFamily: fonts.body, fontSize: 15 }}>{text}</Text>
      <Text style={{ color: c.muted, fontSize: 12 }}>{open ? '▴' : '▾'}</Text>
    </Pressable>
  );
}

function Header({ title, onBack, onForward, onTitle, unit }: { title: string; onBack: () => void; onForward: () => void; onTitle?: () => void; unit: 'month' | 'year' }) {
  const c = useTheme();
  const arrow = (text: string, label: string, onPress: () => void) => (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={[s.arrow, { backgroundColor: c.soft }]}>
      <Text style={{ color: c.ink, fontSize: 20 }}>{text}</Text>
    </Pressable>
  );
  return (
    <View style={s.head}>
      {arrow('‹', `Previous ${unit}`, onBack)}
      <Pressable onPress={onTitle} disabled={!onTitle} accessibilityRole="button" style={s.title}>
        <Text style={{ color: c.ink, fontFamily: fonts.display, fontSize: 16 }}>{title}</Text>
      </Pressable>
      {arrow('›', `Next ${unit}`, onForward)}
    </View>
  );
}

/** One cell of a grid: a day or a month. */
function Cell({ text, label, on, off, today, onPress, width, round }: { text: string; label: string; on: boolean; off: boolean; today?: boolean; onPress: () => void; width: `${number}%`; round: boolean }) {
  const c = useTheme();
  return (
    <View style={{ width, padding: 2 }}>
      <Pressable onPress={onPress} disabled={off} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: on, disabled: off }}
        style={[s.cell, { borderRadius: round ? 999 : 10, backgroundColor: on ? c.accent : c.soft, borderColor: today && !on ? c.accent : 'transparent', opacity: off ? 0.35 : 1 }]}>
        <Text style={{ color: on ? c.onAccent : c.ink, fontFamily: fonts.bodyBold, fontSize: 14 }}>{text}</Text>
      </Pressable>
    </View>
  );
}

/** A full date (use it instead of a typed YYYY-MM-DD field). `value` is YYYY-MM-DD or ''. */
export function DateInput({ label, value, onChange, min, max }: { label: string; value: string; onChange: (v: string) => void; min?: string; max?: string }) {
  const c = useTheme();
  const today = todayManila();
  const startMonth = () => (value || (min && min > today ? min : today)).slice(0, 7);
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(startMonth);
  const [months, setMonths] = useState(false);
  const year = Number(month.slice(0, 4));
  return (
    <View style={{ gap: 8 }}>
      <Trigger label={label} text={value ? dateText(value) : 'Pick a date'} empty={!value} open={open} onPress={() => { setMonth(startMonth()); setMonths(false); setOpen(!open); }} />
      {open ? (
        <View style={[s.panel, { borderColor: c.line, backgroundColor: c.surface }]}>
          <Header title={months ? String(year) : monthText(month)} unit={months ? 'year' : 'month'} onTitle={() => setMonths(!months)} onBack={() => setMonth(shiftMonth(month, months ? -12 : -1))} onForward={() => setMonth(shiftMonth(month, months ? 12 : 1))} />
          {months ? (
            <View style={s.grid}>
              {MON.map((m, i) => {
                const ym = monthOfYear(year, i);
                return <Cell key={m} text={m} label={`${m} ${year}`} width="33.33%" round={false} on={ym === month} off={(!!min && ym < min.slice(0, 7)) || (!!max && ym > max.slice(0, 7))} onPress={() => { setMonth(ym); setMonths(false); }} />;
              })}
            </View>
          ) : (
            <View style={s.grid}>
              {WEEKDAY_LETTERS.map((d, i) => (
                <Text key={i} style={[s.dow, { color: c.muted, fontFamily: fonts.bodyBold }]}>{d}</Text>
              ))}
              {monthGrid(month).map((d, i) =>
                d === null ? (
                  <View key={`e${i}`} style={{ width: '14.28%' }} />
                ) : (
                  <Cell key={d} text={String(Number(d.slice(8)))} label={dateText(d)} width="14.28%" round on={d === value} today={d === today} off={(!!min && d < min) || (!!max && d > max)} onPress={() => { onChange(d); setOpen(false); }} />
                ),
              )}
            </View>
          )}
        </View>
      ) : null}
    </View>
  );
}

/** A month and year (use it instead of a typed YYYY-MM field). `value` is YYYY-MM or ''. */
export function MonthInput({ label, value, onChange, clearable, placeholder = 'Not set' }: { label: string; value: string; onChange: (v: string) => void; clearable?: boolean; placeholder?: string }) {
  const c = useTheme();
  const [open, setOpen] = useState(false);
  const startYear = () => Number((value || todayManila()).slice(0, 4));
  const [year, setYear] = useState(startYear);
  return (
    <View style={{ gap: 8 }}>
      <Trigger label={label} text={/^\d{4}-\d{2}$/.test(value) ? monthText(value) : placeholder} empty={!value} open={open} onPress={() => { setYear(startYear()); setOpen(!open); }} />
      {open ? (
        <View style={[s.panel, { borderColor: c.line, backgroundColor: c.surface }]}>
          <Header title={String(year)} unit="year" onBack={() => setYear(year - 1)} onForward={() => setYear(year + 1)} />
          <View style={s.grid}>
            {MON.map((m, i) => (
              <Cell key={m} text={m} label={`${m} ${year}`} width="33.33%" round={false} on={value === monthOfYear(year, i)} off={false} onPress={() => { onChange(monthOfYear(year, i)); setOpen(false); }} />
            ))}
          </View>
          {clearable && value ? (
            <View style={{ flexDirection: 'row' }}>
              <Chip label="Clear" on={false} onPress={() => { onChange(''); setOpen(false); }} />
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  field: { minHeight: 48, borderRadius: 10, borderWidth: 1, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  panel: { borderWidth: 1, borderRadius: 14, padding: 8, gap: 8 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  arrow: { width: 40, height: 40, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  dow: { width: '14.28%', textAlign: 'center', fontSize: 11 },
  cell: { minHeight: 40, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
});
