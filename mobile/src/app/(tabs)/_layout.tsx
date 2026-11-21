import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { fonts, useTheme } from '~/lib/theme';

type IconName = keyof typeof Ionicons.glyphMap;
const icon = (name: IconName, focused: IconName) =>
  function TabIcon({ color, size, focused: on }: { color: unknown; size: number; focused: boolean }) {
    return <Ionicons name={on ? focused : name} size={size} color={color as string} />;
  };

export default function TabsLayout() {
  const c = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: c.surface, borderTopColor: c.line, minHeight: 64 },
        tabBarActiveTintColor: c.accentText,
        tabBarInactiveTintColor: c.muted,
        tabBarLabelStyle: { fontFamily: fonts.bodyBold, fontSize: 12 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Now', tabBarIcon: icon('home-outline', 'home') }} />
      <Tabs.Screen name="inbox" options={{ title: 'Inbox', tabBarIcon: icon('file-tray-outline', 'file-tray') }} />
      <Tabs.Screen name="add" options={{ title: 'Add', tabBarIcon: icon('add-circle-outline', 'add-circle') }} />
      <Tabs.Screen name="accounts" options={{ title: 'Accounts', tabBarIcon: icon('wallet-outline', 'wallet') }} />
      <Tabs.Screen name="plan" options={{ title: 'Plan', tabBarIcon: icon('grid-outline', 'grid') }} />
    </Tabs>
  );
}
