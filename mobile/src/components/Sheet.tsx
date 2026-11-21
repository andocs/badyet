import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Label } from '~/components/ui';
import { fonts, useTheme } from '~/lib/theme';

/** The bottom sheet every add or edit opens in: scrim, grab bar, title, scrolling body. */
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={s.scrim} onPress={onClose} accessibilityLabel="Close" />
      <View style={[s.sheet, { backgroundColor: c.surface, borderColor: c.line, paddingBottom: insets.bottom + 16 }]}>
        <View style={[s.grab, { backgroundColor: c.line }]} />
        <ScrollView contentContainerStyle={{ gap: 14 }} keyboardShouldPersistTaps="handled">
          <Text style={{ color: c.ink, fontFamily: fonts.display, fontSize: 18 }}>{title}</Text>
          {children}
        </ScrollView>
      </View>
    </Modal>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={{ gap: 6 }}>
      <Label>{label}</Label>
      {children}
    </View>
  );
}

export function Input(props: TextInputProps) {
  const c = useTheme();
  return <TextInput placeholderTextColor={c.muted} {...props} style={[s.input, { color: c.ink, backgroundColor: c.soft, fontFamily: fonts.body }, props.style]} />;
}

/** Cancel and the main action, side by side, with the problem (if any) above them. */
export function SheetActions({ onClose, onSave, busy, saveLabel = 'Save', problem }: { onClose: () => void; onSave: () => void; busy?: boolean; saveLabel?: string; problem?: string | null }) {
  const c = useTheme();
  return (
    <>
      {problem ? <Text style={{ color: c.err, fontFamily: fonts.body, fontSize: 14 }}>{problem}</Text> : null}
      <View style={s.two}>
        <Pressable onPress={onClose} accessibilityRole="button" style={[s.btn, { flex: 1, backgroundColor: c.soft }]}>
          <Text style={{ color: c.ink, fontFamily: fonts.bodyBold, fontSize: 15 }}>Cancel</Text>
        </Pressable>
        <Pressable onPress={onSave} disabled={busy} accessibilityRole="button" style={[s.btn, { flex: 1, backgroundColor: c.accent, opacity: busy ? 0.6 : 1 }]}>
          <Text style={{ color: c.onAccent, fontFamily: fonts.bodyBold, fontSize: 15 }}>{busy ? 'Saving…' : saveLabel}</Text>
        </Pressable>
      </View>
    </>
  );
}

const s = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { maxHeight: '90%', borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1, padding: 16, gap: 12 },
  grab: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2 },
  input: { minHeight: 48, borderRadius: 10, paddingHorizontal: 14, fontSize: 15 },
  two: { flexDirection: 'row', gap: 10 },
  btn: { minHeight: 48, borderRadius: 999, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
});
