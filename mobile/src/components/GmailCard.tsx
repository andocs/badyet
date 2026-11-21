import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Body, Card, Label } from '~/components/ui';
import { setGmailConnected } from '~/lib/captureEngine';
import { triggerCapture, useCaptureStatus } from '~/lib/CaptureRunner';
import { connectGmail, disconnectGmail, gmailAccount, gmailSetup } from '~/lib/googleAuth';
import { fonts, useTheme } from '~/lib/theme';

/** Connect Gmail so bank, Grab and foodpanda emails can become pending items. */
export function GmailCard() {
  const c = useTheme();
  const { gmail } = useCaptureStatus();
  const setup = gmailSetup();
  const [email, setEmail] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let live = true;
      if (setup === 'ready') void gmailAccount().then((e) => { if (live) setEmail(e); if (e) setGmailConnected(true); });
      return () => {
        live = false;
      };
    }, [setup]),
  );

  async function connect() {
    setBusy(true);
    setProblem(null);
    const r = await connectGmail();
    setBusy(false);
    if ('error' in r) return setProblem(r.error);
    setEmail(r.email);
    setGmailConnected(true);
    triggerCapture(true);
  }

  async function disconnect() {
    await disconnectGmail();
    setGmailConnected(false);
    setEmail(null);
  }

  let last = '';
  if (gmail?.status === 'ok') last = `Checked ${new Date(gmail.at).toLocaleTimeString()}: ${gmail.found} new, ${gmail.ignored} not money, ${gmail.skipped} skipped.`;
  else if (gmail?.status === 'error') last = gmail.message;
  else if (gmail?.status === 'not-connected') last = 'Not connected, or the sign-in expired. Connect again.';
  else if (gmail?.status === 'no-sources') last = 'Turn on a source that sends email (BPI, Grab or foodpanda) in Capture rules.';

  const btn = (label: string, onPress: () => void, primary = false) => (
    <Pressable
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      style={[s.btn, { backgroundColor: primary ? c.accent : c.soft, opacity: busy ? 0.6 : 1 }]}
    >
      <Text style={{ color: primary ? c.onAccent : c.ink, fontFamily: fonts.bodyBold, fontSize: 15 }}>{label}</Text>
    </Pressable>
  );

  return (
    <Card>
      <Label>Gmail</Label>
      {setup === 'no-library' ? <Body>Reading Gmail needs the newest app version. Install the latest APK, then come back here.</Body> : null}
      {setup === 'no-client-id' ? <Body>Gmail is not set up in this build yet: the Google client id is missing.</Body> : null}
      {setup === 'ready' ? (
        <>
          <Body>{email ? `Connected as ${email}. Only mail from your enabled banks and shops is read, and only the amount, merchant and reference are kept.` : 'Not connected. Connect to turn bank, Grab and foodpanda emails into pending items.'}</Body>
          {email ? (
            <>
              <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 12 }}>While the Google project is in testing mode, Google asks you to sign in again about every 7 days.</Text>
              {last ? <Text style={{ color: gmail?.status === 'error' ? c.err : c.muted, fontFamily: fonts.body, fontSize: 13 }}>{last}</Text> : null}
              {btn('Check now', () => triggerCapture(true), true)}
              {btn('Disconnect', disconnect)}
            </>
          ) : (
            btn(busy ? 'Connecting…' : 'Connect Gmail', connect, true)
          )}
          {problem ? <Text style={{ color: c.err, fontFamily: fonts.body, fontSize: 14 }}>{problem}</Text> : null}
        </>
      ) : null}
    </Card>
  );
}

const s = StyleSheet.create({
  btn: { minHeight: 48, borderRadius: 999, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
});
