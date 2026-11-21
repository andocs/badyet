import type { ReactNode } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, type TextStyle, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Money } from '@/lib/domain/money';
import { useHide } from '~/lib/hide';
import { peso } from '~/lib/money';
import { fonts, useTheme } from '~/lib/theme';

export function Screen(props: {
  title: string;
  subtitle?: string;
  refreshing?: boolean;
  onRefresh?: () => void;
  children: ReactNode;
}) {
  const c = useTheme();
  const { hide, toggle } = useHide();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={{ backgroundColor: c.bg }}
      contentContainerStyle={{ padding: 16, paddingTop: insets.top + 12, paddingBottom: 32, gap: 12 }}
      refreshControl={
        props.onRefresh ? <RefreshControl refreshing={!!props.refreshing} onRefresh={props.onRefresh} tintColor={c.accent} /> : undefined
      }
    >
      <View style={s.head}>
        <View style={{ flex: 1 }}>
          <Text style={[s.h1, { color: c.ink, fontFamily: fonts.display }]}>{props.title}</Text>
          {props.subtitle ? <Text style={[s.sub, { color: c.muted, fontFamily: fonts.body }]}>{props.subtitle}</Text> : null}
        </View>
        <Pressable
          onPress={toggle}
          accessibilityRole="switch"
          accessibilityState={{ checked: hide }}
          accessibilityLabel="Hide amounts"
          style={[s.eye, { backgroundColor: hide ? c.accent : c.soft }]}
        >
          <Text style={{ color: hide ? c.onAccent : c.ink, fontFamily: fonts.bodyBold, fontSize: 13 }}>{hide ? 'Hidden' : 'Hide'}</Text>
        </Pressable>
      </View>
      {props.children}
    </ScrollView>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const c = useTheme();
  return <View style={[s.card, { backgroundColor: c.surface, borderColor: c.line }, style]}>{children}</View>;
}

export function Label({ children }: { children: ReactNode }) {
  const c = useTheme();
  return <Text style={[s.label, { color: c.muted, fontFamily: fonts.bodyBold }]}>{children}</Text>;
}

export function Body({ children, style, bold }: { children: ReactNode; style?: TextStyle; bold?: boolean }) {
  const c = useTheme();
  return <Text style={[{ color: c.ink, fontSize: 15, fontFamily: bold ? fonts.bodyBold : fonts.body }, style]}>{children}</Text>;
}

/** A peso figure that respects hide-amounts. */
export function Amount({ value, style, symbol }: { value: Money; style?: TextStyle; symbol?: boolean }) {
  const c = useTheme();
  const { hide } = useHide();
  return (
    <Text style={[{ color: c.ink, fontFamily: fonts.bodyBold, fontSize: 15, fontVariant: ['tabular-nums'] }, style]}>
      {peso(value, hide, { symbol })}
    </Text>
  );
}

export function Bar({ fraction, color, over }: { fraction: number; color: string; over?: boolean }) {
  const c = useTheme();
  const w = Math.max(0, Math.min(1, fraction)) * 100;
  return (
    <View style={[s.track, { backgroundColor: c.soft }]}>
      <View style={{ width: `${w}%`, height: 6, borderRadius: 3, backgroundColor: over ? c.err : color }} />
    </View>
  );
}

export function Notice({ children, tone }: { children: ReactNode; tone?: 'error' }) {
  const c = useTheme();
  return (
    <Card style={tone === 'error' ? { backgroundColor: c.errTint, borderColor: c.err } : undefined}>
      <Text style={{ color: tone === 'error' ? c.err : c.muted, fontFamily: fonts.body, fontSize: 15 }}>{children}</Text>
    </Card>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  h1: { fontSize: 30, lineHeight: 36 },
  sub: { fontSize: 14, marginTop: 2 },
  eye: { minHeight: 48, minWidth: 64, borderRadius: 999, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  card: { borderRadius: 10, borderWidth: 1, padding: 14, gap: 8 },
  label: { fontSize: 12, letterSpacing: 0.6, textTransform: 'uppercase' },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
});
