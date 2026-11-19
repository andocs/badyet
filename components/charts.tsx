import { CUTOFF_BUCKETS, FORECAST, THIRTEENTH } from "@/lib/sample";

// Hand-built SVG charts: no chart library needed for these three shapes.

export function ForecastChart() {
  const { months, values, cap } = FORECAST;
  const w = 520;
  const h = 180;
  const max = 64;
  const x = (i: number) => 34 + (i * (w - 56)) / (months.length - 1);
  const y = (v: number) => h - 26 - (v / max) * (h - 46);
  const line = values.map((v, i) => `${i ? "L" : "M"}${x(i)} ${y(v)}`).join(" ");
  return (
    <svg className="chart" viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Emergency fund forecast: reaches the 60 thousand peso cap in June">
      <defs>
        <linearGradient id="area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--accent)" stopOpacity="0.4" />
          <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0, 20, 40, 60].map((v) => (
        <g key={v}>
          <line x1="34" x2={w - 20} y1={y(v)} y2={y(v)} stroke="var(--line)" />
          <text x="2" y={y(v) + 4}>{v}k</text>
        </g>
      ))}
      <line x1="34" x2={w - 20} y1={y(cap)} y2={y(cap)} stroke="var(--bucket-3)" strokeDasharray="5 5" strokeWidth="2" />
      <path d={`${line} L${x(values.length - 1)} ${y(0)} L${x(0)} ${y(0)} Z`} fill="url(#area)" />
      <path className="draw" d={line} pathLength={1} fill="none" stroke="var(--accent)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
      {values.map((v, i) => (
        <circle key={i} cx={x(i)} cy={y(v)} r="4.5" fill="var(--surface)" stroke="var(--accent)" strokeWidth="3" />
      ))}
      {months.map((m, i) => (
        <text key={m} x={x(i)} y={h - 6} textAnchor="middle">{m}</text>
      ))}
      <text x={w - 22} y={y(cap) - 8} textAnchor="end" style={{ fill: "var(--bucket-3)", fontWeight: 800 }}>Cap 60k</text>
    </svg>
  );
}

export function CutoffBars() {
  const total = Math.max(...CUTOFF_BUCKETS.map((c) => c.essentials + c.wants + c.savings));
  const colors = ["var(--bucket-1)", "var(--bucket-2)", "var(--bucket-3)"];
  return (
    <>
      <svg className="chart" viewBox="0 0 260 178" role="img" aria-label="Spending by bucket for each cutoff">
        {CUTOFF_BUCKETS.map((c, ci) => {
          const x = ci === 0 ? 28 : 150;
          let top = 150;
          return (
            <g key={c.label}>
              {[c.essentials, c.wants, c.savings].map((v, i) => {
                const hgt = (v / total) * 130;
                top -= hgt;
                return <rect key={i} className="grow" x={x} y={top} width="74" height={hgt - 2} rx="3" fill={colors[i]} />;
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

export function CountdownRing() {
  const r = 40;
  const circ = 2 * Math.PI * r;
  const done = 1 - THIRTEENTH.daysLeft / THIRTEENTH.daysTotal;
  return (
    <svg width="120" height="120" viewBox="0 0 110 110" role="img" aria-label={`${THIRTEENTH.daysLeft} days until the 13th month pay`}>
      <circle cx="55" cy="55" r={r} fill="none" stroke="var(--soft)" strokeWidth="12" />
      <circle cx="55" cy="55" r={r} fill="none" stroke="var(--accent)" strokeWidth="12" strokeLinecap="round" strokeDasharray={`${circ * done} ${circ}`} transform="rotate(-90 55 55)" />
      <text x="55" y="58" textAnchor="middle" style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 26, fill: "var(--ink)" }}>{THIRTEENTH.daysLeft}</text>
      <text x="55" y="75" textAnchor="middle">days</text>
    </svg>
  );
}
