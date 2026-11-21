import { useRouter } from 'expo-router';
import { Pressable, Text } from 'react-native';
import { Card } from '~/components/ui';
import { useHeldCount } from '~/lib/CaptureRunner';
import { fonts, useTheme } from '~/lib/theme';

/** Captures the app understood but could not match to an account yet. They do not reach the Inbox until it can. */
export function HeldNotice() {
  const c = useTheme();
  const router = useRouter();
  const held = useHeldCount();
  if (held === 0) return null;
  return (
    <Pressable onPress={() => router.navigate('/capture')} accessibilityRole="button">
      <Card style={{ borderColor: c.gold }}>
        <Text style={{ color: c.gold, fontFamily: fonts.bodyBold, fontSize: 15 }}>
          {held} {held === 1 ? 'capture needs' : 'captures need'} an account ›
        </Text>
        <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 13 }}>Set the usual account for the source in Capture rules.</Text>
      </Card>
    </Pressable>
  );
}
