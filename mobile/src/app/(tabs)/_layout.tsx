import { Tabs } from 'expo-router';
import { fonts, useTheme } from '~/lib/theme';

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
        tabBarIcon: () => null,
        tabBarIconStyle: { display: 'none' },
        tabBarLabelPosition: 'beside-icon',
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Now' }} />
      <Tabs.Screen name="inbox" options={{ title: 'Inbox' }} />
      <Tabs.Screen name="add" options={{ title: '+' }} />
      <Tabs.Screen name="accounts" options={{ title: 'Accounts' }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
    </Tabs>
  );
}
