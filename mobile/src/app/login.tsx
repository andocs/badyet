import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { signInWithGoogle } from '~/lib/signin';
import { fonts, useTheme } from '~/lib/theme';

export default function Login() {
  const c = useTheme();
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
    <View style={[s.wrap, { backgroundColor: c.bg }]}>
      <Text style={{ color: c.ink, fontSize: 40, fontFamily: fonts.display }}>Bad(yet)</Text>
      <Text style={{ color: c.muted, fontSize: 16, fontFamily: fonts.body }}>Your budget, on your phone.</Text>
      <Pressable style={[s.btn, { backgroundColor: c.accent }]} onPress={go} disabled={busy} accessibilityRole="button">
        {busy ? (
          <ActivityIndicator color={c.onAccent} />
        ) : (
          <Text style={{ color: c.onAccent, fontSize: 16, fontFamily: fonts.bodyBold }}>Continue with Google</Text>
        )}
      </Pressable>
      {error ? <Text style={{ color: c.err, fontSize: 14, fontFamily: fonts.body }}>{error}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'center', padding: 24, gap: 16 },
  btn: { minHeight: 52, borderRadius: 999, alignItems: 'center', justifyContent: 'center', marginTop: 16 },
});
