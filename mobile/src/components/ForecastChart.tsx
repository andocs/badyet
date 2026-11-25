import { useMemo } from 'react';
import { Pressable, View } from 'react-native';
import Svg, { Line, Path, Text as SvgText } from 'react-native-svg';
import type { ForecastRow } from '@/lib/funds/forecast';
import { useHide } from '~/lib/hide';
import { fonts, useTheme } from '~/lib/theme';

export interface FundMeta {
  id: string;
  name: string;
  color: string;
  /** Resets to zero each year. */
  resets?: boolean;
}

const W = 380;
const H = 300;
const L = 56;
const R = 10;
const T = 14;
const B = 28;

/** Stacked area or lines for the visible funds, with a tap strip over every month. Same drawing as the web chart. */
export function ForecastChart({ rows, funds, stacked, onPick, sel }: { rows: ForecastRow[]; funds: FundMeta[]; stacked: boolean; onPick: (month: string) => void; sel: string | null }) {
  const c = useTheme();
  const { hide } = useHide();
  const n = rows.length;
  const x = (i: number) => L + ((W - L - R) * i) / Math.max(1, n - 1);
  const data = useMemo(() => {
    const layers: { f: FundMeta; vals: number[]; bottom: number[] }[] = [];
    // Funds that reset each year sit on top, so the ones that never reset stay smooth underneath them.
    for (const f of [...funds].sort((a, b) => Number(!!a.resets) - Number(!!b.resets))) {
      const bottom = stacked && layers.length > 0 ? layers[layers.length - 1]!.vals : rows.map(() => 0);
      layers.push({ f, vals: rows.map((r, i) => (r.funds[f.id]?.balance ?? 0) + bottom[i]!), bottom });
    }
    return { layers, max: Math.max(1, ...layers.flatMap((l) => l.vals)) };
  }, [rows, funds, stacked]);
  const step = (() => {
    const raw = data.max / 100 / 4;
    const nice = [1000, 2000, 5000, 10000, 20000, 25000, 50000, 100000, 200000, 500000].find((s) => s >= raw) ?? 1_000_000;
    return nice * 100;
  })();
  const top = Math.ceil(data.max / step) * step;
  const y = (v: number) => T + (H - T - B) * (1 - v / top);
  const ticks = Array.from({ length: Math.floor(top / step) + 1 }, (_, i) => i * step);
  const overrides = rows.map((r, i) => (r.override ? i : -1)).filter((i) => i >= 0);
  const selIdx = sel ? rows.findIndex((r) => r.month === sel) : -1;
  const tick = (v: number) => (hide ? '₱•••' : `₱${v >= 100_000_000 ? `${+(v / 100_000_000).toFixed(1)}M` : `${Math.round(v / 100_000)}k`}`);

  return (
    <View style={{ aspectRatio: W / H, marginTop: 10 }}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} accessibilityLabel="Fund balances over the next five years">
        {ticks.map((v) => (
          <Line key={`g${v}`} x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke={c.line} strokeWidth={1} />
        ))}
        {ticks.map((v) => (
          <SvgText key={`t${v}`} x={L - 6} y={y(v) + 4} textAnchor="end" fontSize={10} fill={c.muted} fontFamily={fonts.body}>
            {tick(v)}
          </SvgText>
        ))}
        {rows
          .filter((r) => r.month.endsWith('-01'))
          .map((r) => (
            <SvgText key={r.month} x={x(rows.indexOf(r))} y={H - 8} textAnchor="middle" fontSize={10} fill={c.muted} fontFamily={fonts.body}>
              {r.year}
            </SvgText>
          ))}
        {[...data.layers].reverse().map(({ f, vals, bottom }) =>
          stacked ? (
            <Path key={f.id} d={`M${vals.map((v, i) => `${x(i)} ${y(v)}`).join(' L')} L${[...bottom].map((v, i) => `${x(i)} ${y(v)}`).reverse().join(' L')} Z`} fill={f.color} fillOpacity={0.85} />
          ) : (
            <Path key={f.id} d={`M${vals.map((v, i) => `${x(i)} ${y(v)}`).join(' L')}`} fill="none" stroke={f.color} strokeWidth={3} strokeLinejoin="round" />
          ),
        )}
        {overrides.map((i) => (
          <Path key={i} d={`M${x(i) - 6} ${T - 2} h12 l-6 10 z`} fill={c.ink} />
        ))}
        {selIdx >= 0 ? <Line x1={x(selIdx)} x2={x(selIdx)} y1={T} y2={H - B} stroke={c.ink} strokeOpacity={0.4} /> : null}
      </Svg>
      {/* A touch strip per month sits over the drawing; the chart itself is not interactive. */}
      <View style={{ position: 'absolute', left: `${(L / W) * 100}%`, right: `${(R / W) * 100}%`, top: `${(T / H) * 100}%`, bottom: `${(B / H) * 100}%`, flexDirection: 'row' }}>
        {rows.map((r) => (
          <Pressable key={r.month} onPress={() => onPick(r.month)} accessibilityRole="button" accessibilityLabel={`${r.month}`} style={{ flex: 1 }} />
        ))}
      </View>
    </View>
  );
}
