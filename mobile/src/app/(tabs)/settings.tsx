import { useCallback, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { isAccessGranted, openAccessSettings } from '@modules/notification-listener';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';

export default function Settings() {
  const { session } = useSession();
  const [granted, setGranted] = useState(false);

  useFocusEffect(
    useCallback(() => {
      const check = () => setGranted(isAccessGranted());
      check();
      const sub = AppState.addEventListener('change', (s) => s === 'active' && check());
      return () => sub.remove();
    }, []),
  );

  return (
    <View style={s.wrap}>
      <Text style={s.title}>Settings</Text>
      <Text style={s.row}>Signed in as {session?.user.email ?? 'unknown'}</Text>
      <Text style={s.row}>Notification access: {granted ? 'on' : 'off'}</Text>
      {!granted ? (
        <Pressable style={s.btn} onPress={openAccessSettings} accessibilityRole="button">
          <Text style={s.btnText}>Open notification access settings</Text>
        </Pressable>
      ) : null}
      <Pressable style={[s.btn, s.ghost]} onPress={() => supabase.auth.signOut()} accessibilityRole="button">
        <Text style={[s.btnText, { color: colors.text }]}>Sign out</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg, padding: 24, paddingTop: 64, gap: 12 },
  title: { color: colors.text, fontSize: 28, fontWeight: '800', marginBottom: 8 },
  row: { color: colors.muted, fontSize: 16 },
  btn: {
    backgroundColor: colors.accent, minHeight: 48, borderRadius: 999,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20,
  },
  ghost: { backgroundColor: colors.surface },
  btnText: { color: colors.onAccent, fontSize: 15, fontWeight: '700' },
});
