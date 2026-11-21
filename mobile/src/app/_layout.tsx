import { Gabarito_700Bold, Gabarito_800ExtraBold } from '@expo-google-fonts/gabarito';
import { AtkinsonHyperlegibleNext_500Medium, AtkinsonHyperlegibleNext_700Bold } from '@expo-google-fonts/atkinson-hyperlegible-next';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { CaptureRunner } from '~/lib/CaptureRunner';
import { HideProvider } from '~/lib/hide';
import { SessionProvider, useSession } from '~/lib/session';
import { SyncProvider } from '~/lib/sync';
import { useTheme } from '~/lib/theme';

function Gate() {
  const { session, ready } = useSession();
  const segments = useSegments();
  const router = useRouter();
  const c = useTheme();

  useEffect(() => {
    if (!ready) return;
    const onLogin = segments[0] === 'login';
    if (!session && !onLogin) router.replace('/login');
    else if (session && onLogin) router.replace('/');
  }, [session, ready, segments, router]);

  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }} />;
}

export default function RootLayout() {
  const [loaded] = useFonts({
    Gabarito_700Bold,
    Gabarito_800ExtraBold,
    AtkinsonHyperlegibleNext_500Medium,
    AtkinsonHyperlegibleNext_700Bold,
  });
  if (!loaded) return null;
  return (
    <SafeAreaProvider>
      <SessionProvider>
        <HideProvider>
          <SyncProvider>
            <StatusBar style="auto" />
            <CaptureRunner />
            <Gate />
          </SyncProvider>
        </HideProvider>
      </SessionProvider>
    </SafeAreaProvider>
  );
}
