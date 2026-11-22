import { Pressable, StyleSheet, Text, View } from 'react-native';
import { fonts } from '~/lib/theme';

export interface TileProps {
  name: string;
  /** e.g. "E-wallet ·· 1234" */
  kind: string;
  color: string;
  balanceText: string;
  sub: string;
  fund?: boolean;
  width?: number;
  onPress?: () => void;
}

/** The web's coloured account card: name, kind, balance, and when it was last confirmed. */
export function AccountTile({ name, kind, color, balanceText, sub, fund, width, onPress }: TileProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${kind}`}
      style={[s.tile, { backgroundColor: color }, width ? { width, flexGrow: 0, flexBasis: width } : null]}
    >
      <View style={s.circleA} />
      <View style={s.circleB} />
      <View style={s.top}>
        <Text style={[s.name, { fontFamily: fonts.display }]} numberOfLines={1}>
          {name}
        </Text>
        {fund ? (
          <View style={s.tag}>
            <Text style={[s.tagText, { fontFamily: fonts.bodyBold }]}>Fund</Text>
          </View>
        ) : null}
      </View>
      <Text style={[s.kind, { fontFamily: fonts.bodyBold }]}>{kind}</Text>
      <Text style={[s.bal, { fontFamily: fonts.display }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
        {balanceText}
      </Text>
      <Text style={[s.sub, { fontFamily: fonts.bodyBold }]} numberOfLines={2}>
        {sub}
      </Text>
    </Pressable>
  );
}

/** A grey placeholder the size of a tile, shown while the accounts load. */
export function TileSkeleton({ color }: { color: string }) {
  return <View accessibilityElementsHidden importantForAccessibility='no-hide-descendants' style={[s.tile, { backgroundColor: color, opacity: 0.6 }]} />;
}

const s = StyleSheet.create({
  tile: { flexGrow: 1, flexBasis: '30%', minWidth: 104, minHeight: 140, borderRadius: 12, padding: 12, overflow: 'hidden', gap: 2 },
  circleA: { position: 'absolute', right: -30, top: -34, width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(255,255,255,0.09)' },
  circleB: { position: 'absolute', right: 30, bottom: -60, width: 110, height: 110, borderRadius: 55, backgroundColor: 'rgba(255,255,255,0.06)' },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  name: { color: '#fff', fontSize: 14, flexShrink: 1 },
  tag: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 1 },
  tagText: { color: '#fff', fontSize: 11 },
  kind: { color: 'rgba(255,255,255,0.92)', fontSize: 12 },
  bal: { color: '#fff', fontSize: 20, marginTop: 'auto', paddingTop: 10 },
  sub: { color: 'rgba(255,255,255,0.92)', fontSize: 12 },
});
