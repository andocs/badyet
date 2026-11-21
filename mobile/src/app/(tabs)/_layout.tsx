import { Ionicons } from '@expo/vector-icons';
import { Tabs, useRouter, useSegments, type Href } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts, useTheme } from '~/lib/theme';

type IconName = keyof typeof Ionicons.glyphMap;
const icon = (name: IconName, focused: IconName) =>
  function TabIcon({ color, size, focused: on }: { color: unknown; size: number; focused: boolean }) {
    return <Ionicons name={on ? focused : name} size={size} color={color as string} />;
  };

/** The pages behind the More tab, in the same order as the web's Plan section. */
const MORE: { title: string; icon: IconName; href: Href }[] = [
  { title: 'Salary and tax', icon: 'cash-outline', href: '/plan/salary' },
  { title: 'Budget', icon: 'pie-chart-outline', href: '/plan/budget' },
  { title: 'Bonuses', icon: 'gift-outline', href: '/plan/bonuses' },
  { title: 'Funds', icon: 'flag-outline', href: '/plan/funds' },
  { title: 'Forecast', icon: 'trending-up-outline', href: '/plan/forecast' },
  { title: 'Settings', icon: 'settings-outline', href: '/settings' },
];

/** The last tab: a kebab that opens a sheet of the remaining pages instead of a page of its own. */
function MoreSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const c = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={open} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={s.scrim} onPress={onClose} accessibilityLabel="Close" />
      <View style={[s.sheet, { backgroundColor: c.surface, borderColor: c.line, paddingBottom: insets.bottom + 12 }]}>
        <View style={[s.grab, { backgroundColor: c.line }]} />
        {MORE.map((m, i) => (
          <Pressable
            key={m.title}
            onPress={() => {
              onClose();
              router.navigate(m.href);
            }}
            accessibilityRole="button"
            style={[s.row, i > 0 && { borderTopWidth: 1, borderTopColor: c.line }]}
          >
            <Ionicons name={m.icon} size={20} color={c.accentText} />
            <Text style={{ flex: 1, color: c.ink, fontFamily: fonts.bodyBold, fontSize: 16 }}>{m.title}</Text>
            <Text style={{ color: c.muted, fontSize: 20 }}>›</Text>
          </Pressable>
        ))}
      </View>
    </Modal>
  );
}

// A `hidden` tab cannot be focused: the navigator sends you back to the first tab. These pages are real tabs with no button.
const HIDDEN = { tabBarItemStyle: { display: 'none' as const } };

export default function TabsLayout() {
  const c = useTheme();
  const segments = useSegments() as string[];
  const [open, setOpen] = useState(false);
  // More stays highlighted while you are on one of its pages.
  const onMore = segments.includes('plan') || segments.includes('settings');
  return (
    <>
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
        <Tabs.Screen
          name="more"
          options={{
            title: 'More',
            tabBarIcon: ({ size }) => <Ionicons name="ellipsis-vertical" size={size} color={onMore ? c.accentText : c.muted} />,
            tabBarLabelStyle: { fontFamily: fonts.bodyBold, fontSize: 12, color: onMore ? c.accentText : c.muted },
            tabBarButton: ({ style, children }) => (
              <Pressable onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel="More pages" style={style}>
                {children}
              </Pressable>
            ),
          }}
        />
        <Tabs.Screen name="plan/salary" options={HIDDEN} />
        <Tabs.Screen name="plan/budget" options={HIDDEN} />
        <Tabs.Screen name="plan/bonuses" options={HIDDEN} />
        <Tabs.Screen name="plan/funds" options={HIDDEN} />
        <Tabs.Screen name="plan/forecast" options={HIDDEN} />
        <Tabs.Screen name="settings" options={HIDDEN} />
      </Tabs>
      <MoreSheet open={open} onClose={() => setOpen(false)} />
    </>
  );
}

const s = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1, paddingHorizontal: 16, paddingTop: 12 },
  grab: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56 },
});
