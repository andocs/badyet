import * as Updates from 'expo-updates';
import { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { Body, Card, Label } from '~/components/ui';
import { fonts, useTheme } from '~/lib/theme';

/** Shows which version is running and lets you pull a new one without waiting for the next launch. */
export function UpdatesCard() {
  const c = useTheme();
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const running = !Updates.isEnabled
    ? 'Updates are off in this build.'
    : Updates.isEmbeddedLaunch
      ? 'Built into the app (no update downloaded yet).'
      : `Update ${Updates.updateId?.slice(0, 8) ?? '?'} from ${Updates.createdAt ? Updates.createdAt.toLocaleString() : 'unknown date'}`;

  async function check() {
    setBusy(true);
    setStatus('Checking…');
    try {
      const r = await Updates.checkForUpdateAsync();
      if (!r.isAvailable) {
        setStatus('You have the latest version.');
        return;
      }
      setStatus('Downloading…');
      await Updates.fetchUpdateAsync();
      setStatus('Restarting…');
      await Updates.reloadAsync();
    } catch (e) {
      setStatus(e instanceof Error ? `Could not check: ${e.message}` : 'Could not check for updates.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <Label>App version</Label>
      <Body>{running}</Body>
      <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 12 }}>
        Channel {Updates.channel ?? 'none'} · runtime {Updates.runtimeVersion ?? '?'}
      </Text>
      {status ? <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 14 }}>{status}</Text> : null}
      <Pressable
        onPress={check}
        disabled={busy || !Updates.isEnabled}
        accessibilityRole="button"
        style={[s.btn, { backgroundColor: c.soft, opacity: busy || !Updates.isEnabled ? 0.6 : 1 }]}
      >
        <Text style={{ color: c.ink, fontFamily: fonts.bodyBold, fontSize: 15 }}>Check for updates</Text>
      </Pressable>
    </Card>
  );
}

const s = StyleSheet.create({
  btn: { minHeight: 48, borderRadius: 999, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
});
