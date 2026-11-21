import { useCallback, useState } from 'react';
import { AppState, Linking, PermissionsAndroid, Platform, Pressable, StyleSheet, Text } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { isAccessGranted, openAccessSettings } from '@modules/notification-listener';
import { Body, Card, Label, Screen } from '~/components/ui';
import { GmailCard } from '~/components/GmailCard';
import { UpdatesCard } from '~/components/UpdatesCard';
import { useSession } from '~/lib/session';
import { supabase } from '~/lib/supabase';
import { fonts, useTheme } from '~/lib/theme';

// Android 13+ keeps app notifications off until the app asks.
const needsPostPermission = Platform.OS === 'android' && Number(Platform.Version) >= 33;

export default function Settings() {
  const c = useTheme();
  const router = useRouter();
  const { session } = useSession();
  const [granted, setGranted] = useState(false);
  const [postOk, setPostOk] = useState(true);

  async function allowNotifications() {
    const r = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
    if (r === PermissionsAndroid.RESULTS.GRANTED) setPostOk(true);
    else void Linking.openSettings();
  }

  useFocusEffect(
    useCallback(() => {
      const check = () => {
        setGranted(isAccessGranted());
        if (needsPostPermission) void PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS).then(setPostOk);
      };
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
      <UpdatesCard />
      {!postOk ? (
        <Card>
          <Label>App notifications</Label>
          <Body>Off. Android needs this on before it lets you turn on notification access below.</Body>
          <Pressable style={[s.btn, { backgroundColor: c.accent }]} onPress={allowNotifications} accessibilityRole="button">
            <Text style={{ color: c.onAccent, fontFamily: fonts.bodyBold, fontSize: 15 }}>Allow notifications</Text>
          </Pressable>
        </Card>
      ) : null}
      <Card>
        <Label>Notification access</Label>
        <Body>{granted ? 'On. Bad(yet) can read bank notifications.' : 'Off. Turn it on so Bad(yet) can read bank notifications.'}</Body>
        {!granted ? (
          <Pressable style={[s.btn, { backgroundColor: c.accent }]} onPress={openAccessSettings} accessibilityRole="button">
            <Text style={{ color: c.onAccent, fontFamily: fonts.bodyBold, fontSize: 15 }}>Open notification access settings</Text>
          </Pressable>
        ) : null}
        <Pressable style={[s.btn, { backgroundColor: c.soft }]} onPress={() => router.push('/capture')} accessibilityRole="button">
          <Text style={{ color: c.ink, fontFamily: fonts.bodyBold, fontSize: 15 }}>Capture rules</Text>
        </Pressable>
      </Card>
      <GmailCard />
      <Pressable style={[s.btn, { backgroundColor: c.soft }]} onPress={() => supabase.auth.signOut()} accessibilityRole="button">
        <Text style={{ color: c.ink, fontFamily: fonts.bodyBold, fontSize: 15 }}>Sign out</Text>
      </Pressable>
    </Screen>
  );
}

const s = StyleSheet.create({
  btn: { minHeight: 48, borderRadius: 999, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
});
