import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState, type ReactNode } from 'react';
import { Animated, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, type TextStyle, type ViewStyle } from 'react-native';
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
      keyboardShouldPersistTaps="handled"
      // On a wide screen (a tablet, or a Z Fold opened up) the content stays a readable column in the middle.
      contentContainerStyle={{ width: '100%', maxWidth: 760, alignSelf: 'center', padding: 16, paddingTop: insets.top + 12, paddingBottom: 32, gap: 12 }}
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
          hitSlop={8}
          style={[s.eye, { backgroundColor: hide ? c.accent : c.soft }]}
        >
          <Ionicons name={hide ? 'eye-off-outline' : 'eye-outline'} size={18} color={hide ? c.onAccent : c.ink} />
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
export function Amount({ value, style, symbol, signed }: { value: Money; style?: TextStyle; symbol?: boolean; signed?: boolean }) {
  const c = useTheme();
  const { hide } = useHide();
  return (
    <Text style={[{ color: c.ink, fontFamily: fonts.bodyBold, fontSize: 15, fontVariant: ['tabular-nums'] }, style]}>
      {signed && !hide && value > 0 ? '+' : ''}
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

/** Placeholder bars while a screen's data loads: they pulse so the screen visibly responds at once. */
export function Loading() {
  const c = useTheme();
  const [pulse] = useState(() => new Animated.Value(0.5));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }), Animated.timing(pulse, { toValue: 0.5, duration: 700, useNativeDriver: true })]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return (
    <Animated.View style={{ opacity: pulse, gap: 12 }} accessibilityRole="progressbar" accessibilityLabel="Loading">
      <View style={{ height: 120, borderRadius: 14, backgroundColor: c.soft }} />
      <View style={{ height: 76, borderRadius: 14, backgroundColor: c.soft }} />
      <View style={{ height: 76, borderRadius: 14, backgroundColor: c.soft }} />
    </Animated.View>
  );
}

/** The one tickbox: a rounded square, accent green with a check mark when ticked. Put it inside a Pressable that carries the tap. */
export function Tick({ on, size = 24 }: { on: boolean; size?: number }) {
  const c = useTheme();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: size, height: size, borderRadius: Math.round(size * 0.3), borderWidth: 2, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? c.accent : 'transparent', borderColor: on ? c.accent : c.muted }}
    >
      {on ? <Text style={{ color: c.onAccent, fontSize: Math.round(size * 0.55), lineHeight: Math.round(size * 0.7), fontFamily: fonts.bodyBold }}>✓</Text> : null}
    </View>
  );
}

export function Notice({ children, tone }: { children: ReactNode; tone?: 'error' }) {
  const c = useTheme();
  // Every screen says "Loading…" while its data loads; show placeholder bars for that instead of a line of text.
  if (children === 'Loading…') return <Loading />;
  return (
    <Card style={tone === 'error' ? { backgroundColor: c.errTint, borderColor: c.err } : undefined}>
      <Text style={{ color: tone === 'error' ? c.err : c.muted, fontFamily: fonts.body, fontSize: 15 }}>{children}</Text>
    </Card>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  h1: { fontSize: 24, lineHeight: 30 },
  sub: { fontSize: 14, marginTop: 2 },
  eye: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  card: { borderRadius: 10, borderWidth: 1, padding: 14, gap: 8 },
  label: { fontSize: 12, letterSpacing: 0.6, textTransform: 'uppercase' },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
});

/** A round choice button. Selected is filled with the accent. */
export function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  const c = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      style={{ minHeight: 40, borderRadius: 999, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? c.accent : c.soft }}
    >
      <Text style={{ color: on ? c.onAccent : c.ink, fontFamily: fonts.bodyBold, fontSize: 14 }}>{label}</Text>
    </Pressable>
  );
}
