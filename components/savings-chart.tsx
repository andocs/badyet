// Line chart of the three fund balances over the forecast months. Hand-built SVG, values in pesos.
export interface Series {
  label: string;
  color: string;
  values: number[];
}

export function SavingsChart({ months, series }: { months: string[]; series: Series[] }) {
  const w = 640;
  const h = 220;
  const max = Math.max(1, ...series.flatMap((s) => s.values));
  const top = Math.ceil(max / 50_000) * 50_000 || 50_000;
  const x = (i: number) => 48 + (i * (w - 72)) / Math.max(1, months.length - 1);
  const y = (v: number) => h - 28 - (v / top) * (h - 48);
  const ticks = [0, top / 3, (top * 2) / 3, top];
  const short = (n: number) => (n >= 1000 ? `${Math.round(n / 1000)}k` : String(n));
  const desc = series.map((s) => `${s.label} ends at ${Math.round(s.values[s.values.length - 1] ?? 0).toLocaleString("en-PH")} pesos`).join("; ");

  return (
    <>
      <svg className="chart" viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`Fund balances by month. ${desc}.`}>
        {ticks.map((v) => (
          <g key={v}>
            <line x1="48" x2={w - 16} y1={y(v)} y2={y(v)} stroke="var(--line)" />
            <text x="4" y={y(v) + 4}>{short(Math.round(v))}</text>
          </g>
        ))}
        {series.map((s) => (
          <g key={s.label}>
            <path
              className="draw"
              pathLength={1}
              d={s.values.map((v, i) => `${i ? "L" : "M"}${x(i)} ${y(v)}`).join(" ")}
              fill="none"
              stroke={s.color}
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {s.values.map((v, i) => (
              <circle key={i} cx={x(i)} cy={y(v)} r="3.5" fill="var(--surface)" stroke={s.color} strokeWidth="2.5" />
            ))}
          </g>
        ))}
        {months.map((m, i) => (
          <text key={m} x={x(i)} y={h - 6} textAnchor="middle">{m.slice(2).replace("-", "/")}</text>
        ))}
      </svg>
      <div className="legend">
        {series.map((s) => (
          <span key={s.label} className="lab">
            <span className="dot" style={{ ["--c" as string]: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
    </>
  );
}
