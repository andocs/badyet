import { StyleSheet, Text, View } from 'react-native';
import { colors } from '@/lib/theme';

export default function Screen() {
  return (
    <View style={s.wrap}>
      <Text style={s.title}>Quick add</Text>
      <Text style={s.sub}>Coming in a later slice.</Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg, justifyContent: 'center', padding: 24 },
  title: { color: colors.text, fontSize: 28, fontWeight: '800' },
  sub: { color: colors.muted, marginTop: 8 },
});
