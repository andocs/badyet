import { useCallback, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { isAccessGranted, openAccessSettings } from '@modules/notification-listener';
import { Body, Card, Label, Screen } from '~/components/ui';
import { useSession } from '~/lib/session';
import { supabase } from '~/lib/supabase';
import { fonts, useTheme } from '~/lib/theme';

export default function Settings() {
  const c = useTheme();
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
    <Screen title="Settings">
      <Card>
        <Label>Account</Label>
        <Body>{session?.user.email ?? 'unknown'}</Body>
      </Card>
      <Card>
        <Label>Notification access</Label>
        <Body>{granted ? 'On. Bad(yet) can read bank notifications.' : 'Off. Turn it on so Bad(yet) can read bank notifications.'}</Body>
        {!granted ? (
          <Pressable style={[s.btn, { backgroundColor: c.accent }]} onPress={openAccessSettings} accessibilityRole="button">
            <Text style={{ color: c.onAccent, fontFamily: fonts.bodyBold, fontSize: 15 }}>Open notification access settings</Text>
          </Pressable>
        ) : null}
      </Card>
      <Pressable style={[s.btn, { backgroundColor: c.soft }]} onPress={() => supabase.auth.signOut()} accessibilityRole="button">
        <Text style={{ color: c.ink, fontFamily: fonts.bodyBold, fontSize: 15 }}>Sign out</Text>
      </Pressable>
    </Screen>
  );
}

const s = StyleSheet.create({
  btn: { minHeight: 48, borderRadius: 999, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
});
