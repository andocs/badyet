import { useRouter, type Href } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Card, Screen } from '~/components/ui';
import { fonts, useTheme } from '~/lib/theme';

interface Item {
  title: string;
  blurb: string;
  href?: Href;
}

// Same grouping as the web's Plan section.
const ITEMS: Item[] = [
  { title: 'Salary and tax', blurb: 'Your pay, raises and allowances, month by month.', href: '/plan/salary' },
  { title: 'Budget', blurb: 'What the rules say each cutoff, and what has gone out.', href: '/plan/budget' },
  { title: 'Bonuses', blurb: '13th month and other bonuses.', href: '/plan/bonuses' },
  { title: 'Funds', blurb: 'Money you set aside for goals.', href: '/plan/funds' },
  { title: 'Forecast', blurb: 'Where the next months and years lead.', href: '/plan/forecast' },
  { title: 'Settings', blurb: 'Paydays, notifications, capture rules, Gmail.', href: '/settings' },
];

export default function Plan() {
  const c = useTheme();
  const router = useRouter();
  return (
    <Screen title="Plan" subtitle="Everything about money lives here.">
      <Card style={{ padding: 4 }}>
        {ITEMS.map((i, n) => (
          <Pressable
            key={i.title}
            disabled={!i.href}
            onPress={() => i.href && router.push(i.href)}
            accessibilityRole="button"
            accessibilityState={{ disabled: !i.href }}
            style={[s.row, n > 0 && { borderTopWidth: 1, borderTopColor: c.line }]}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ color: i.href ? c.ink : c.muted, fontFamily: fonts.bodyBold, fontSize: 16 }}>{i.title}</Text>
              <Text style={{ color: c.muted, fontFamily: fonts.body, fontSize: 13 }}>{i.href ? i.blurb : `${i.blurb} Coming soon on the phone.`}</Text>
            </View>
            {i.href ? <Text style={{ color: c.muted, fontSize: 20 }}>›</Text> : null}
          </Pressable>
        ))}
      </Card>
    </Screen>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 64, paddingHorizontal: 12, paddingVertical: 10 },
});
