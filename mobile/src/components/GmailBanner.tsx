import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { setGmailConnected, useGmailReconnect } from '~/lib/captureEngine';
import { triggerCapture } from '~/lib/CaptureRunner';
import { connectGmail } from '~/lib/googleAuth';
import { fonts, useTheme } from '~/lib/theme';

/** Shown when Google's weekly sign-in has run out. One tap signs in again. */
export function GmailBanner() {
  const c = useTheme();
  const needs = useGmailReconnect();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  if (!needs) return null;

  async function reconnect() {
    setBusy(true);
    setProblem(null);
    const r = await connectGmail();
    setBusy(false);
    if ('error' in r) return setProblem(r.error);
    setGmailConnected(true);
    triggerCapture(true);
  }

  return (
    <View style={[s.box, { borderColor: c.gold, backgroundColor: c.surface }]}>
      <Text style={{ color: c.gold, fontFamily: fonts.bodyBold, fontSize: 15 }}>Gmail sign-in expired</Text>
      {problem ? <Text style={{ color: c.err, fontFamily: fonts.body, fontSize: 13 }}>{problem}</Text> : null}
      <Pressable onPress={reconnect} disabled={busy} accessibilityRole="button" style={[s.btn, { backgroundColor: c.accent, opacity: busy ? 0.6 : 1 }]}>
        <Text style={{ color: c.onAccent, fontFamily: fonts.bodyBold, fontSize: 15 }}>{busy ? 'Connecting…' : 'Reconnect Gmail'}</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  box: { borderWidth: 1, borderRadius: 10, padding: 14, gap: 8 },
  btn: { minHeight: 48, borderRadius: 999, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
});
