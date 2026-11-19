// Hand-built SVG charts for the dashboard: no chart library needed for these three shapes.

export function ForecastChart({ months, values, cap }: { months: string[]; values: number[]; cap: number | null }) {
  const w = 520;
  const h = 180;
  const peak = Math.max(1, ...values, cap ?? 0);
  const max = Math.max(10, Math.ceil(peak / 20) * 20); // in thousands of pesos
  const x = (i: number) => 34 + (i * (w - 56)) / Math.max(1, months.length - 1);
  const y = (v: number) => h - 26 - (v / max) * (h - 46);
  const line = values.map((v, i) => `${i ? "L" : "M"}${x(i)} ${y(v)}`).join(" ");
  const ticks = [0, max / 3, (max * 2) / 3, max].map((t) => Math.round(t));
  return (
    <svg className="chart" viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`Emergency fund forecast over ${months.length} months, ending near ${Math.round(values[values.length - 1] ?? 0)} thousand pesos`}>
      <defs>
        <linearGradient id="area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--accent)" stopOpacity="0.4" />
          <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {ticks.map((v) => (
        <g key={v}>
          <line x1="34" x2={w - 20} y1={y(v)} y2={y(v)} stroke="var(--line)" />
          <text x="2" y={y(v) + 4}>{v}k</text>
        </g>
      ))}
      {cap !== null && cap > 0 && (
        <>
          <line x1="34" x2={w - 20} y1={y(cap)} y2={y(cap)} stroke="var(--bucket-3)" strokeDasharray="5 5" strokeWidth="2" />
          <text x={w - 22} y={y(cap) - 8} textAnchor="end" style={{ fill: "var(--bucket-3)", fontWeight: 800 }}>Cap {Math.round(cap)}k</text>
        </>
      )}
      <path d={`${line} L${x(values.length - 1)} ${y(0)} L${x(0)} ${y(0)} Z`} fill="url(#area)" />
      <path className="draw" d={line} pathLength={1} fill="none" stroke="var(--accent)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
      {values.map((v, i) => (
        <circle key={i} cx={x(i)} cy={y(v)} r="4.5" fill="var(--surface)" stroke="var(--accent)" strokeWidth="3" />
      ))}
      {months.map((m, i) => (
        <text key={m} x={x(i)} y={h - 6} textAnchor="middle">{m.slice(2).replace("-", "/")}</text>
      ))}
    </svg>
  );
}

export interface BucketRow {
  label: string;
  essentials: number;
  wants: number;
  savings: number;
}

export function CutoffBars({ rows }: { rows: BucketRow[] }) {
  const total = Math.max(1, ...rows.map((c) => Math.max(0, c.essentials) + Math.max(0, c.wants) + Math.max(0, c.savings)));
  const colors = ["var(--bucket-1)", "var(--bucket-2)", "var(--bucket-3)"];
  return (
    <>
      <svg className="chart" viewBox="0 0 260 178" role="img" aria-label="Spending by bucket for each cutoff">
        {rows.map((c, ci) => {
          const x = ci === 0 ? 28 : 150;
          let top = 150;
          return (
            <g key={c.label}>
              {[c.essentials, c.wants, c.savings].map((v, i) => {
                const hgt = (Math.max(0, v) / total) * 130;
                top -= hgt;
                return hgt > 0 ? <rect key={i} className="grow" x={x} y={top} width="74" height={Math.max(0, hgt - 2)} rx="3" fill={colors[i]} /> : null;
              })}
              <text x={x + 37} y="170" textAnchor="middle">{c.label}</text>
            </g>
          );
        })}
      </svg>
      <div className="legend">
        {["Essentials", "Wants", "Savings"].map((b, i) => (
          <span key={b} className="lab">
            <span className="dot" style={{ ["--c" as string]: colors[i] }} />
            {b}
          </span>
        ))}
      </div>
    </>
  );
}

export function CountdownRing({ daysLeft, daysTotal = 30 }: { daysLeft: number; daysTotal?: number }) {
  const r = 40;
  const circ = 2 * Math.PI * r;
  const done = Math.min(1, Math.max(0, 1 - daysLeft / daysTotal));
  return (
    <svg width="120" height="120" viewBox="0 0 110 110" role="img" aria-label={`${daysLeft} days until the 13th month pay`}>
      <circle cx="55" cy="55" r={r} fill="none" stroke="var(--soft)" strokeWidth="12" />
      <circle cx="55" cy="55" r={r} fill="none" stroke="var(--accent)" strokeWidth="12" strokeLinecap="round" strokeDasharray={`${circ * done} ${circ}`} transform="rotate(-90 55 55)" />
      <text x="55" y="58" textAnchor="middle" style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 26, fill: "var(--ink)" }}>{daysLeft}</text>
      <text x="55" y="75" textAnchor="middle">days</text>
    </svg>
  );
}
