import Svg, { Circle, G, Line, Path, Text as SvgText } from 'react-native-svg';
import type { YearMonth } from '@/lib/domain/dates';
import type { regularRange } from '@/lib/salary/view';
import { useHide } from '~/lib/hide';
import { fonts, useTheme } from '~/lib/theme';

const W = 380;
const H = 260;
const L = 54;
const R = 10;
const T = 14;
const B = 28;

type Range = ReturnType<typeof regularRange>;

/** Regular take-home per cutoff over 60 months: solid, dashed where an assumed raise applies, hollow markers for expected events. Same drawing as the web chart. */
export function SalaryChart({ range, events }: { range: Range; events: { month: YearMonth; expected: boolean }[] }) {
  const c = useTheme();
  const { hide } = useHide();
  const v1 = range.map((r) => r.pay.first.takeHome);
  const v2 = range.map((r) => r.pay.second.takeHome);
  const all = [...v1, ...v2];
  const step = 200_000; // ₱2,000
  const lo = Math.floor(Math.min(...all) / step) * step - step;
  const hi = Math.ceil(Math.max(...all) / step) * step + step;
  const tick = Math.ceil((hi - lo) / 4 / 100_000) * 100_000;
  const n = range.length;
  const x = (i: number) => L + ((W - L - R) * i) / Math.max(1, n - 1);
  const y = (v: number) => T + (H - T - B) * (1 - (v - lo) / (hi - lo));
  const ticks: number[] = [];
  for (let v = lo; v <= hi; v += tick) ticks.push(v);

  const seg = (vals: number[], assumed: boolean) => {
    let d = '';
    let inSeg = false;
    range.forEach((r, i) => {
      if (r.salary.assumed !== assumed) {
        inSeg = false;
        return;
      }
      d += inSeg ? `H${x(i)}V${y(vals[i]!)}` : i > 0 && assumed ? `M${x(i - 1)} ${y(vals[i - 1]!)}H${x(i)}V${y(vals[i]!)}` : `M${x(i)} ${y(vals[i]!)}`;
      inSeg = true;
    });
    return d;
  };
  const yearsShown = range.filter((r) => r.month.endsWith('-01')).map((r) => r.month);
  const indexOf = (m: string) => range.findIndex((r) => r.month === m);
  const series: [number[], string][] = [[v1, c.accent], [v2, c.blue]];

  return (
    <Svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ aspectRatio: W / H, marginTop: 8 }} accessibilityLabel="Regular take-home for each cutoff over five years, without bonuses">
      {ticks.map((v) => (
        <G key={v}>
          <Line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke={c.line} strokeWidth={1} />
          <SvgText x={L - 6} y={y(v) + 4} textAnchor="end" fontSize={10} fill={c.muted} fontFamily={fonts.body}>
            {hide ? '₱•••' : `₱${Math.round(v / 100_000)}k`}
          </SvgText>
        </G>
      ))}
      {yearsShown.map((m) => (
        <SvgText key={m} x={x(indexOf(m))} y={H - 8} textAnchor="middle" fontSize={10} fill={c.muted} fontFamily={fonts.body}>
          {m.slice(0, 4)}
        </SvgText>
      ))}
      {series.map(([vals, color]) => (
        <G key={color}>
          <Path d={seg(vals, false)} fill="none" stroke={color} strokeWidth={3} />
          <Path d={seg(vals, true)} fill="none" stroke={color} strokeWidth={3} strokeDasharray="6 5" strokeOpacity={0.7} />
        </G>
      ))}
      {events.map((e, k) => {
        const i = indexOf(e.month);
        if (i < 0) return null;
        return [...series].reverse().map(([vals, color]) => (
          <Circle key={`${k}-${color}`} cx={x(i)} cy={y(vals[i]!)} r={e.expected ? 5 : 4.5} fill={e.expected ? c.bg : color} stroke={e.expected ? color : c.bg} strokeWidth={e.expected ? 2.5 : 2} />
        ));
      })}
    </Svg>
  );
}
