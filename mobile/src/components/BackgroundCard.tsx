import { useCallback, useState } from 'react';
import { Text } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Card, Label } from '~/components/ui';
import { readLastRun, type LastRun } from '~/lib/captureEngine';
import { fonts, useTheme } from '~/lib/theme';

const WHERE = { app: 'with the app open', notification: 'from a notification', background: 'in the background' } as const;

/** When capture last ran, so you can tell it works while the app is closed. */
export function BackgroundCard() {
  const c = useTheme();
  const [run, setRun] = useState<LastRun | null>(null);
  useFocusEffect(useCallback(() => setRun(readLastRun()), []));
  const mins = run ? Math.max(0, Math.round((Date.now() - run.at) / 60_000)) : 0;
  const when = !run ? 'Not yet' : mins < 1 ? 'Just now' : mins < 60 ? `${mins} min ago` : `${Math.round(mins / 60)} h ago`;
  return (
    <Card>
      <Label>Background capture</Label>
      <Text style={{ color: c.ink, fontFamily: fonts.body, fontSize: 15 }}>
        Last run: {when}
        {run ? ` · ${WHERE[run.source]}` : ''}
      </Text>
    </Card>
  );
}
