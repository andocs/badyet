import Link from "next/link";
import type { YearMonth } from "@/lib/domain/dates";
import { monthRange } from "@/lib/engine/months";
import { loadSalary } from "@/lib/salary/load";
import { eventRows, regularRange, yearRows, yearOf } from "@/lib/salary/view";
import { createClient } from "@/lib/supabase/server";
import { Money } from "@/components/v13/money";
import { AllowanceControls, EventActions, ProjectedRaises } from "@/components/v13/salary/controls";
import { PayslipBuilder } from "@/components/v13/salary/payslip-builder";

export const metadata = { title: "Salary and tax · Bad(yet)" };

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const label = (m: YearMonth) => `${MON[Number(m.slice(5)) - 1]} ${m.slice(0, 4)}`;

export default async function Pay({ searchParams }: { searchParams: Promise<{ tab?: string; month?: string }> }) {
  const supabase = await createClient();
  if (!supabase) return <p className="v-main">Supabase is not configured.</p>;
  const { tab, month: monthParam } = await searchParams;
  const data = await loadSalary(supabase);
  const { input, thisMonth } = data;
  const hasStart = input.events.some((e) => e.kind === "start");

  const months = monthRange(thisMonth, 60);
  const month = (months as string[]).includes(monthParam ?? "") ? (monthParam as YearMonth) : thisMonth;
  const isPayslip = tab === "payslip";

  return (
    <main className="v-main">
      <div className="v-stack v-l">
        <div className="v-row v-sp v-wrap">
          <div>
            <h1>Salary and tax</h1>
            <div className="v-lbl">Your pay timeline, your allowances and bonuses, and a payslip builder for each cutoff. The budget and forecast read from here.</div>
          </div>
          <div className="v-row v-wrap">
            {hasStart ? <Link className="v-btn v-pri" href="/pay/new">+ Add a raise or promotion</Link> : null}
          </div>
        </div>

        {!hasStart ? (
          <div className="v-note"><b>No salary on file yet.</b> The <Link href="/setup">setup wizard</Link> sets your starting pay.</div>
        ) : (
          <>
            <div className="v-tabs2" role="tablist" aria-label="Salary views" style={{ marginTop: -4 }}>
              <Link href="/pay" role="tab" aria-selected={!isPayslip} className="v-tab2">Timeline</Link>
              <Link href="/pay?tab=payslip" role="tab" aria-selected={isPayslip} className="v-tab2">Payslip builder</Link>
            </div>
            {isPayslip ? (
              <PayslipBuilder key={month} input={input} month={month} months={months.map((m) => ({ value: m, label: label(m) }))} />
            ) : (
              <Timeline data={data} />
            )}
          </>
        )}
      </div>
    </main>
  );
}

function Timeline({ data }: { data: Awaited<ReturnType<typeof loadSalary>> }) {
  const { input, thisMonth } = data;
  const range = regularRange(input, thisMonth, 60);
  const events = eventRows(input);
  const years = Array.from({ length: 6 }, (_, i) => yearOf(thisMonth) + i);
  const table = yearRows(input, years);
  const a = input.assumptions;

  return (
    <div className="v-stack v-l">
      <section className="v-card" aria-labelledby="ch">
        <div className="v-row v-sp v-wrap">
          <h2 id="ch">Regular take-home per cutoff</h2>
          <div className="v-legend">
            <span><i className="v-dot" style={{ background: "var(--accent)" }} />1st cutoff (paid 10th)</span>
            <span><i className="v-dot" style={{ background: "var(--blue)" }} />2nd cutoff (paid 25th)</span>
            <span style={{ color: "var(--muted)" }}><i className="v-sw-dash" />Assumed raises</span>
          </div>
        </div>
        <Chart range={range} events={input.events.filter((e) => e.kind !== "start" && e.kind !== "adjustment").map((e) => ({ month: e.effectiveMonth, expected: e.status === "expected" }))} />
      </section>

      <div className="v-cols2">
        <div className="v-stack">
          <section className="v-card" aria-labelledby="evh">
            <div className="v-row v-sp"><h2 id="evh">Events</h2><Link className="v-btn v-sm" href="/pay/new">Add with the wizard</Link></div>
            <div>
              {events.map(({ event: e, delta }) => (
                <div className="v-ev" key={e.id}>
                  <div className="v-when">{MON[Number(e.effectiveMonth.slice(5)) - 1]}<small>{e.effectiveMonth.slice(0, 4)}</small></div>
                  <div className="v-grow">
                    <b>{{ start: "Start", merit: "Merit raise", promotion: "Promotion", allowance: "Allowance change", adjustment: "One-off adjustment" }[e.kind]}</b>
                    {e.status === "expected" ? <> <span className="v-pill v-est">expected</span></> : null}
                    <div className="v-sm v-muted">
                      {e.kind === "merit" && e.pctBp != null ? `+${e.pctBp / 100}%` : null}
                      {e.newBase != null ? <>{e.kind === "merit" ? " → " : ""}base <Money value={e.newBase} /> a month</> : null}
                      {e.kind === "promotion" && (e.newBase == null) ? "Promotion" : null}
                      {e.kind === "adjustment" && e.oneOffAmount != null ? <><Money value={e.oneOffAmount} /> once{e.oneOffTaxable ? ", taxed" : ""}</> : null}
                      {e.kind === "allowance" ? "A new allowance (see Recurring allowances)" : null}
                    </div>
                    <EventActions id={e.id} status={e.status} kind={e.kind} />
                  </div>
                  {delta !== null ? (
                    <div className={`v-delta v-num ${delta >= 0 ? "v-pos" : "v-neg"}`} style={{ textAlign: "right" }}>
                      <Money value={delta} signed />
                      <div className="v-xs v-muted" style={{ font: "600 12px var(--font-body)" }}>take-home a month</div>
                    </div>
                  ) : <span className="v-pill">{e.kind === "start" ? "start" : "once"}</span>}
                </div>
              ))}
            </div>
            <div className="v-note" style={{ marginTop: 12 }}><b>Hollow marker</b> = a raise you expect but have not confirmed yet. <b>Past the last event?</b> The projected raise below takes over.</div>
          </section>

          <section className="v-card" aria-labelledby="prj">
            <h2 id="prj">Projected raises</h2>
            <div className="v-lbl" style={{ margin: "2px 0 8px" }}>Used only after your last dated event, and drawn dashed everywhere.</div>
            <ProjectedRaises on={a.assumedRaiseOn} pctBp={a.assumedRaiseBp} month={a.assumedRaiseMonth} />
          </section>

          <section className="v-card" aria-labelledby="alh">
            <div className="v-row v-sp"><h2 id="alh">Recurring allowances</h2><Link className="v-btn v-sm" href="/pay/new?kind=allowance">+ Add</Link></div>
            <div>
              {input.allowances.length === 0 ? <p className="v-muted v-sm">No allowances yet.</p> : null}
              {input.allowances.map((al) => (
                <div className="v-alw" key={al.id} style={{ alignItems: "flex-start" }}>
                  <div className="v-grow">
                    <b>{al.name}</b>
                    <div className="v-sm v-muted"><Money value={al.amount} /> · {al.frequency === "monthly" ? "every month" : `once a year, in ${MON[(al.payMonth ?? 1) - 1]}`} · from {label(al.startsOn)}{al.endsOn ? ` to ${label(al.endsOn)}` : ""}</div>
                    <AllowanceControls id={al.id} name={al.name} cutoff={al.payslipCutoff} taxable={al.taxable} />
                  </div>
                </div>
              ))}
            </div>
            <p className="v-xs v-muted" style={{ margin: "10px 0 0" }}>Taxable ones add to your taxable pay. The cutoff you pick here is what the payslip builder uses. Bonuses are set on the Bonuses page.</p>
          </section>
        </div>

        <section className="v-card" aria-labelledby="yh">
          <h2 id="yh">Year by year</h2>
          <div className="v-scrollx">
            <table>
              <thead><tr><th>Year</th><th>Base / mo</th><th>Allowances / mo</th><th>Contributions / mo</th><th>Income tax / mo</th><th>1st cutoff</th><th>2nd cutoff</th><th>Bonuses (net)</th></tr></thead>
              <tbody>
                {table.map((r) => (
                  <tr key={r.year} className={r.assumed ? "v-est" : ""}>
                    <td><b>{r.year}</b></td>
                    <td className="v-num"><Money value={r.base} /></td>
                    <td className="v-num">{r.allowances > 0 ? <Money value={r.allowances} /> : "—"}</td>
                    <td className="v-num">−<Money value={r.contributions} /></td>
                    <td className="v-num">−<Money value={r.tax} /></td>
                    <td className="v-num"><b><Money value={r.first} /></b></td>
                    <td className="v-num"><b><Money value={r.second} /></b></td>
                    <td className="v-num v-pos">{r.bonusNet > 0 ? <Money value={r.bonusNet} signed /> : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="v-xs v-muted" style={{ margin: "10px 0 0" }}>Regular pay is December of each year, from your payslip builder. Bonuses are the 13th month, CIP and any one-offs paid that year, after tax. The current year shows the whole year.</p>
        </section>
      </div>
    </div>
  );
}

/** Regular take-home per cutoff over 60 months: solid, dashed where an assumed raise applies, hollow markers for expected events. */
function Chart({ range, events }: { range: ReturnType<typeof regularRange>; events: { month: YearMonth; expected: boolean }[] }) {
  const W = 960, H = 240, L = 54, R = 10, T = 14, B = 28;
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
    let d = "";
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
  const yearsShown = range.filter((r) => r.month.endsWith("-01")).map((r) => r.month);
  const indexOf = (m: string) => range.findIndex((r) => r.month === m);
  return (
    <svg className="v-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Regular take-home for each cutoff over five years, without bonuses" style={{ marginTop: 8 }}>
      {ticks.map((v) => (
        <g key={v}>
          <line className="v-grid" x1={L} x2={W - R} y1={y(v)} y2={y(v)} />
          <text x={L - 6} y={y(v) + 4} textAnchor="end">₱{Math.round(v / 100_000)}k</text>
        </g>
      ))}
      {yearsShown.map((m) => <text key={m} x={x(indexOf(m))} y={H - 8} textAnchor="middle">{m.slice(0, 4)}</text>)}
      {[[v1, "var(--accent)"], [v2, "var(--blue)"]].map(([vals, color]) => (
        <g key={color as string}>
          <path d={seg(vals as number[], false)} fill="none" style={{ stroke: color as string }} strokeWidth={3} />
          <path d={seg(vals as number[], true)} fill="none" style={{ stroke: color as string }} strokeWidth={3} strokeDasharray="6 5" strokeOpacity={0.7} />
        </g>
      ))}
      {events.map((e, k) => {
        const i = indexOf(e.month);
        if (i < 0) return null;
        return [[v2, "var(--blue)"], [v1, "var(--accent)"]].map(([vals, color]) => (
          <circle key={`${k}-${color as string}`} cx={x(i)} cy={y((vals as number[])[i]!)} r={e.expected ? 5 : 4.5} style={{ fill: e.expected ? "var(--bg)" : (color as string), stroke: e.expected ? (color as string) : "var(--bg)" }} strokeWidth={e.expected ? 2.5 : 2} />
        ));
      })}
    </svg>
  );
}

