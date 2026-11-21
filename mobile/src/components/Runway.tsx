import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';
import { formatPesos, money } from '@/lib/domain/money';
import { shortDate } from '@/lib/now/format';
import type { NowView } from '@/lib/now/summary';
import { useHide } from '~/lib/hide';
import { fonts } from '~/lib/theme';

const W = 360;
const H = 230;
const L = 44;
const R = 10;
const T = 12;
const B = 28;

/** Cumulative spending against the plan pace over the cutoff, drawn on the hero's dark gradient. Same maths as the web chart. */
export function Runway({ view }: { view: NowView }) {
  const { hide } = useHide();
  const last = view.cumulative.at(-1) ?? 0;
  const max = Math.max(view.pool, last, last + view.perDay * view.daysLeft, 100);
  const stepPesos = [500, 1000, 2000, 2500, 5000, 10000, 20000, 25000, 50000, 100000].find((s) => max / 100 / s <= 4) ?? 100000;
  const top = Math.ceil(max / 100 / stepPesos) * stepPesos * 100;
  const x = (d: number) => L + ((W - L - R) * d) / view.daysTotal;
  const y = (v: number) => T + (H - T - B) * (1 - v / top);
  const ticks = Array.from({ length: Math.floor(top / 100 / stepPesos) + 1 }, (_, i) => i * stepPesos * 100);
  const label = `Cumulative spending against plan pace over the ${view.daysTotal} day cutoff. Spent ${formatPesos(money(last))} by day ${view.dayNumber}; the plan allows ${formatPesos(view.pool)} by day ${view.daysTotal}.`;
  const dim = 'rgba(255,255,255,0.7)';
  const tickText = (v: number) => (hide ? '₱•••' : `₱${v / 100 >= 1000 ? `${v / 100000}k` : v / 100}`);

  return (
    <Svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ aspectRatio: W / H, marginTop: 12 }} accessibilityLabel={label}>
      {ticks.map((v) => (
        <Line key={`g${v}`} x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="rgba(255,255,255,0.15)" strokeWidth={1} />
      ))}
      {ticks.map((v) => (
        <SvgText key={`t${v}`} x={L - 6} y={y(v) + 4} textAnchor="end" fontSize={10} fill={dim} fontFamily={fonts.body}>
          {tickText(v)}
        </SvgText>
      ))}
      {[1, Math.ceil(view.daysTotal / 3), Math.ceil((view.daysTotal * 2) / 3), view.daysTotal].map((d) => (
        <SvgText key={`d${d}`} x={x(d)} y={H - 8} textAnchor="middle" fontSize={10} fill={dim} fontFamily={fonts.body}>
          {d === view.daysTotal ? shortDate(view.period.end) : `Day ${d}`}
        </SvgText>
      ))}
      <Line x1={x(0)} y1={y(0)} x2={x(view.daysTotal)} y2={y(view.pool)} stroke="#B9C9DD" strokeWidth={2} strokeDasharray="5 5" />
      {view.daysLeft > 1 ? (
        <Line
          x1={x(view.dayNumber)}
          y1={y(last)}
          x2={x(view.daysTotal)}
          y2={y(last + view.perDay * (view.daysTotal - view.dayNumber))}
          stroke="#5EE6B4"
          strokeWidth={2}
          strokeDasharray="2 4"
        />
      ) : null}
      <Path d={`M${view.cumulative.map((v, i) => `${x(i)} ${y(v)}`).join(' L')}`} fill="none" stroke="#5EE6B4" strokeWidth={3} strokeLinejoin="round" />
      <Circle cx={x(view.dayNumber)} cy={y(last)} r={6} fill="#5EE6B4" stroke="#0B5A4E" strokeWidth={3} />
      <Line x1={x(view.dayNumber)} x2={x(view.dayNumber)} y1={T} y2={H - B} stroke="#fff" strokeOpacity={0.3} />
      <SvgText x={x(view.dayNumber) + 6} y={T + 10} fontSize={10} fill="#fff" fontFamily={fonts.body}>
        Today
      </SvgText>
    </Svg>
  );
}
