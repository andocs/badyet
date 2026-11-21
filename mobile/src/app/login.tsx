import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { signInWithGoogle } from '@/lib/signin';
import { colors } from '@/lib/theme';

export default function Login() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function go() {
    setBusy(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign-in failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={s.wrap}>
      <Text style={s.title}>Bad(yet)</Text>
      <Text style={s.sub}>Your budget, on your phone.</Text>
      <Pressable style={s.btn} onPress={go} disabled={busy} accessibilityRole="button">
        {busy ? <ActivityIndicator color={colors.onAccent} /> : <Text style={s.btnText}>Continue with Google</Text>}
      </Pressable>
      {error ? <Text style={s.err}>{error}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg, justifyContent: 'center', padding: 24, gap: 16 },
  title: { color: colors.text, fontSize: 36, fontWeight: '800' },
  sub: { color: colors.muted, fontSize: 16 },
  btn: {
    backgroundColor: colors.accent, minHeight: 52, borderRadius: 999,
    alignItems: 'center', justifyContent: 'center', marginTop: 16,
  },
  btnText: { color: colors.onAccent, fontSize: 16, fontWeight: '700' },
  err: { color: '#F87171', fontSize: 14 },
});
