"use client";

import Link from "next/link";
import { useMemo, useOptimistic, useRef, useState, useTransition } from "react";
import { resetMonths } from "@/app/(v13)/funds/actions";
import { money } from "@/lib/domain/money";
import { savedThisMonth, totalBalance, yearEnds, type ForecastRow } from "@/lib/funds/forecast";
import { Money } from "../money";
import { V13Icon } from "../icons";
import { Pick } from "../pick";

export interface FundMeta { id: string; name: string; color: string; blurb: string; /** Resets to zero each year. */ resets?: boolean }

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const label = (m: string) => `${MON[Number(m.slice(5)) - 1]} ${m.slice(0, 4)}`;
const WHY = (r: string) => (r.startsWith("priority") ? `Priority ${r.slice(9)}` : r === "cap hit" ? "Cap reached" : r === "pool ran out" ? "Pool ran out" : r === "takes the rest" ? "Takes the rest" : r === "pinned" ? "Pinned" : r === "skipped" ? "Skipped" : r === "bonus savings" ? "Bonus savings" : r === "next step" ? "Next step" : r === "waits for other funds" ? "Next step waits for other funds" : r);

/** 60 months of fund balances: a chart, a year ladder with month cards, and a month sheet that tells the story. */
export interface PlanMeta { perMonth: number; fund: string | null; fundSet: boolean }

export function ForecastView({ funds, rows: rowsIn, startTotal, withoutTotal, overrides: overridesIn, plan }: { funds: FundMeta[]; rows: ForecastRow[]; startTotal: number; withoutTotal: number | null; overrides: { month: string; note: string; what: string }[]; plan: PlanMeta }) {
  // Resetting a month to the default clears its marker and its entry in "Months that differ" at once.
  const [opt, clearOverride] = useOptimistic({ rows: rowsIn, overrides: overridesIn }, (cur, month: string) => ({
    rows: cur.rows.map((r) => (r.month === month ? { ...r, override: false } : r)),
    overrides: cur.overrides.filter((o) => o.month !== month),
  }));
  const rows = opt.rows;
  const overrides = opt.overrides;
  const [view, setView] = useState<"c" | "y">("c");
  const [style, setStyle] = useState<"s" | "l">("s");
  const [vis, setVis] = useState<Set<string>>(new Set(funds.map((f) => f.id)));
  const [year, setYear] = useState(rows[Math.min(11, rows.length - 1)]?.year ?? new Date().getFullYear());
  const [sel, setSel] = useState<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();

  const last = rows[rows.length - 1]!;
  const total = totalBalance(last);
  const years = [...new Set(rows.map((r) => r.year))];
  const row = sel ? rows.find((r) => r.month === sel) ?? null : null;
  const shown = funds.filter((f) => vis.has(f.id));

  const open = (m: string) => {
    setSel(m);
    setError(null);
    dialog.current?.showModal();
  };
  const toggle = (id: string) =>
    setVis((v) => {
      if (id === "*") return new Set(funds.map((f) => f.id));
      if (v.size === funds.length) return new Set([id]);
      const n = new Set(v);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n.size ? n : new Set(funds.map((f) => f.id));
    });

  return (
    <div className="v-stack v-l">
      <div className="v-row v-sp v-wrap">
        <div><h1>Where I&apos;ll be</h1><div className="v-lbl">{rows.length} months from {label(rows[0]!.month)}. Tap a month for the story.</div></div>
        <div className="v-seg" role="group" aria-label="View">
          <button type="button" aria-pressed={view === "c"} onClick={() => setView("c")}>Chart</button>
          <button type="button" aria-pressed={view === "y"} onClick={() => setView("y")}>Year by year</button>
        </div>
      </div>

      <section className="v-hero" aria-labelledby="hh">
        <div className="v-row v-sp v-wrap">
          <div>
            <div className="v-lbl" id="hh">{label(last.month)}, all my funds together</div>
            <div className="v-big v-xl num">{(total / 100).toLocaleString("en-PH", { style: "currency", currency: "PHP" })}</div>
            <div className="v-muted">up <Money value={money(total - startTotal)} /> from <Money value={money(startTotal)} /> today</div>
            {withoutTotal !== null && Math.abs(total - withoutTotal) > 50 ? <div className="v-sm" style={{ marginTop: 4 }}>Without your expected raises: <Money value={money(withoutTotal)} /> (<Money value={money(withoutTotal - total)} signed />).</div> : null}
          </div>
          <span className="v-pip" aria-hidden="true" />
        </div>
        <div className="v-fx">{funds.map((f) => <div key={f.id}><span className="v-xs" style={{ color: "#B9C9DD" }}>{f.name}</span><b><Money value={last.funds[f.id]?.balance ?? money(0)} /></b></div>)}</div>
      </section>

      <div className="v-cols6">
        <div className="v-stack v-l">
          {view === "c" ? (
            <section className="v-card">
              <div className="v-row v-sp v-wrap">
                <h2>Fund balances</h2>
                <div className="v-seg" role="group" aria-label="Chart style">
                  <button type="button" aria-pressed={style === "s"} onClick={() => setStyle("s")}>Stacked</button>
                  <button type="button" aria-pressed={style === "l"} onClick={() => setStyle("l")}>Lines</button>
                </div>
              </div>
              <div className="v-legend v-pillrow" style={{ marginTop: 12 }} role="group" aria-label="Show lines for">
                <button type="button" aria-pressed={vis.size === funds.length} onClick={() => toggle("*")}>All funds</button>
                {funds.map((f) => <button key={f.id} type="button" aria-pressed={vis.has(f.id)} onClick={() => toggle(f.id)}><i className="v-dot" style={{ background: f.color }} />{f.name}</button>)}
              </div>
              <Chart rows={rows} funds={shown} stacked={style === "s"} onPick={open} sel={sel} />
              <div className="v-row v-sp v-wrap v-sm v-muted" style={{ marginTop: 6 }}>
                <span><span className="v-tri" style={{ display: "inline-block", marginRight: 6 }} />= a month with an override</span>
                <div className="v-row" style={{ gap: 8 }}>Jump to
                  <span className="v-pickrow"><Pick label="Jump to" value={null} placeholder="Pick a month…" options={rows.map((r) => ({ value: r.month, label: `${label(r.month)}${r.override ? " (override)" : ""}` }))} onChange={open} /></span>
                </div>
              </div>
            </section>
          ) : (
            <div className="v-stack v-l">
              <div className="v-seg v-fit" role="group" aria-label="Year">{years.map((y) => <button key={y} type="button" aria-pressed={y === year} onClick={() => setYear(y)}>{y}</button>)}</div>
              <section aria-labelledby="lh">
                <div className="v-row v-sp v-wrap" style={{ marginBottom: 8 }}><h2 id="lh">Year by year</h2><span className="v-lbl">Pick a year to see its twelve months.</span></div>
                <div className="v-ladder">
                  {yearEnds(rows).map((e) => {
                    const t = totalBalance(e);
                    return (
                      <button key={e.year} type="button" className={`v-yr ${e.assumed ? "v-est" : ""}`} aria-expanded={e.year === year} onClick={() => setYear(e.year)}>
                        <div><div className="v-t">{e.year}{e.assumed ? "*" : ""}</div><div className="v-xs v-muted">end of year</div></div>
                        <div>
                          <div className="v-num" style={{ font: "800 18px var(--font-display)" }}><Money value={t} /></div>
                          <div className="v-stk" role="img" aria-label="Split by fund">{[...funds].reverse().map((f) => <i key={f.id} style={{ width: `${t > 0 ? ((e.funds[f.id]?.balance ?? 0) / t) * 100 : 0}%`, background: f.color }} />)}</div>
                          <div className="v-xs v-muted"><Money value={e.take} /> take-home a month</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
              <section className="v-card" aria-labelledby="yh">
                <div className="v-row v-sp v-wrap"><h2 id="yh">{year} month by month</h2><Link className="v-btn v-sm" href={`/forecast/override?bulk=1&y=${year}`}>Edit months in bulk</Link></div>
                <div className="v-mgrid" style={{ marginTop: 12 }}>
                  {rows.filter((r) => r.year === year).map((r) => {
                    const parts = funds.map((f) => savedThisMonth(r, f.id));
                    const tt = parts.reduce((a, b) => a + b, 0) || 1;
                    return (
                      <button key={r.month} type="button" className={`v-mc ${r.override ? "v-ov" : ""}`} onClick={() => open(r.month)} aria-label={`${label(r.month)}: ${(tt / 100).toFixed(2)} pesos saved${r.override ? ", overridden" : ""}`}>
                        <span className="v-m"><span>{MON[Number(r.month.slice(5)) - 1]}</span>{r.bonuses.length ? <V13Icon name="gift" /> : null}</span>
                        <span className="v-p"><Money value={money(parts.reduce((a, b) => a + b, 0))} /></span>
                        <span className="v-stk">{funds.map((f, i) => <i key={f.id} style={{ width: `${(parts[i]! / tt) * 100}%`, background: f.color }} />)}</span>
                        <span className="v-tags">{r.override ? <span className="v-pill">Changed</span> : null}{r.tight ? <span className="v-pill v-warn">Tight</span> : null}{r.assumed ? <span className="v-pill v-est">assumed</span> : null}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="v-xs v-muted" style={{ marginTop: 10 }}>Each bar splits the month&apos;s savings by fund. Changed marks an override. Gift icon = bonus month. * or assumed = assumed raises.</div>
              </section>
            </div>
          )}
        </div>
        <aside className="v-stack">
          <section className="v-card v-stack" aria-labelledby="sph" style={{ gap: 8 }}>
            <h2 id="sph">Savings plan</h2>
            <p className="v-sm" style={{ margin: 0 }}>
              {plan.perMonth <= 0
                ? "No payroll savings plan is set."
                : plan.fund
                  ? <><Money value={money(plan.perMonth)} /> a month goes from your payslip into <b>{plan.fund}</b>. It is inside that fund&apos;s balance every month above.</>
                  : <><Money value={money(plan.perMonth)} /> a month leaves your payslip, but {plan.fundSet ? "the fund it names no longer exists" : "it is not going to a fund"}, so the forecast leaves it out. Pick a fund for it.</>}
            </p>
            <Link className="v-btn v-sm" href="/pay" style={{ alignSelf: "flex-start" }}>{plan.perMonth > 0 && !plan.fund ? "Pick a fund" : "Change the plan"}</Link>
          </section>
          <section className="v-card">
            <h2>Months that differ</h2>
            <div className="v-lbl" style={{ margin: "2px 0 6px" }}>Months you changed from the default order.</div>
            {overrides.length === 0 ? <p className="v-muted v-sm" style={{ margin: 0 }}>None. Every month follows the default.</p> : overrides.map((o) => (
              <div key={o.month} className="v-ovl"><span className="v-tri" /><button type="button" onClick={() => open(o.month)}><b>{label(o.month)}</b>{o.note ? <span className="v-muted"> · {o.note}</span> : null}<div className="v-sm v-muted">{o.what}</div></button></div>
            ))}
          </section>
        </aside>
      </div>

      <dialog ref={dialog} className="v-dlg" aria-labelledby="mot" onClose={() => setSel(null)} onClick={(e) => e.target === dialog.current && dialog.current?.close()}>
        {row ? (
          <div className="v-qa" style={{ maxHeight: "92vh", overflow: "auto" }}>
            <div className="v-grab" aria-hidden="true" />
            <div className="v-row v-sp"><div><h2 id="mot">{label(row.month)}</h2><div className="v-xs v-muted">{row.override ? "Overridden month" : "Following the default order"}</div></div><button type="button" className="v-iconbtn v-s" onClick={() => dialog.current?.close()} aria-label="Close"><V13Icon name="x" /></button></div>
            <div className="v-row v-wrap" style={{ gap: 8 }}>
              <span className="v-pill">Pool <Money value={row.pool} /></span>
              {row.bonuses.map((b) => <span key={b.name} className="v-pill v-ok">{b.name} <Money value={b.net} /></span>)}
              {row.assumed ? <span className="v-pill v-est">assumed raise</span> : null}
              {row.expected ? <span className="v-pill v-est">expected raise</span> : null}
            </div>
            <div>
              {funds.map((f) => {
                const c = row.funds[f.id];
                if (!c) return null;
                return (
                  <div key={f.id} className="v-row v-sp" style={{ padding: "9px 0", borderBottom: "1px solid var(--line)" }}>
                    <span><span className="v-row" style={{ gap: 8 }}><i className="v-dot" style={{ background: f.color }} /><b>{f.name}</b></span><span className="v-xs v-muted" style={{ display: "block" }}>{c.reasons.map(WHY).join(" · ") || "Nothing this month"}</span>{c.plan > 0 ? <span className="v-xs v-ok" style={{ display: "block" }}>+ <Money value={c.plan} /> from your payroll savings plan</span> : null}</span>
                    <span style={{ textAlign: "right" }}><b className="v-num"><Money value={money(c.amount + c.bonus)} /></b><span className="v-xs v-muted" style={{ display: "block" }}>balance <Money value={c.balance} /></span></span>
                  </div>
                );
              })}
              {row.unplaced > 50 ? <div className="v-row v-sp v-sm" style={{ padding: "9px 0" }}><span className="v-muted">Pool not placed (every fund is full)</span><b className="v-num"><Money value={row.unplaced} /></b></div> : null}
            </div>
            {error ? <p className="v-flag v-bad" role="alert">{error}</p> : null}
            <div className="v-row v-wrap">
              <Link className="v-btn v-pri" href={`/forecast/override?m=${row.month}`}>Override this month</Link>
              <Link className="v-btn" href={`/forecast/override?bulk=1&y=${row.year}`}>Edit several months</Link>
              {row.override ? <button type="button" className="v-btn" onClick={() => start(async () => { clearOverride(row.month); dialog.current?.close(); const r = await resetMonths([row.month]); if (r.error) setError(r.error); })}>Reset to default</button> : null}
            </div>
          </div>
        ) : null}
      </dialog>
    </div>
  );
}

/** Stacked area or lines for the visible funds, with a tap target for every month. */
function Chart(props: { rows: ForecastRow[]; funds: FundMeta[]; stacked: boolean; onPick: (m: string) => void; sel: string | null }) {
  // Drawn twice at its own size (wide, and a narrow one for phones) so the labels stay readable instead of shrinking.
  return (
    <>
      <ChartSvg {...props} W={960} H={280} cls="v-wid" />
      <ChartSvg {...props} W={380} H={300} cls="v-nar" />
    </>
  );
}

function ChartSvg({ rows, funds, stacked, onPick, sel, W, H, cls }: { rows: ForecastRow[]; funds: FundMeta[]; stacked: boolean; onPick: (m: string) => void; sel: string | null; W: number; H: number; cls: string }) {
  const L = 56, R = 10, T = 14, B = 28;
  const n = rows.length;
  const x = (i: number) => L + ((W - L - R) * i) / Math.max(1, n - 1);
  const data = useMemo(() => {
    const layers: { f: FundMeta; vals: number[]; bottom: number[] }[] = [];
    // Funds that reset each year sit on top, so the ones that never reset stay smooth underneath them.
    for (const f of [...funds].sort((a, b) => Number(!!a.resets) - Number(!!b.resets))) {
      const bottom = stacked && layers.length > 0 ? layers[layers.length - 1]!.vals : rows.map(() => 0);
      layers.push({ f, vals: rows.map((r, i) => (r.funds[f.id]?.balance ?? 0) + bottom[i]!), bottom });
    }
    const max = Math.max(1, ...layers.flatMap((l) => l.vals));
    return { layers, max };
  }, [rows, funds, stacked]);
  const step = (() => { const raw = data.max / 100 / 4; const nice = [1000, 2000, 5000, 10000, 20000, 25000, 50000, 100000, 200000, 500000].find((s) => s >= raw) ?? 1_000_000; return nice * 100; })();
  const top = Math.ceil(data.max / step) * step;
  const y = (v: number) => T + (H - T - B) * (1 - v / top);
  const ticks = Array.from({ length: Math.floor(top / step) + 1 }, (_, i) => i * step);
  const ovIdx = rows.map((r, i) => (r.override ? i : -1)).filter((i) => i >= 0);
  return (
    <svg className={`v-chart ${cls}`} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Fund balances over the next five years" style={{ marginTop: 10 }}>
      {ticks.map((v) => (<g key={v}><line className="v-grid" x1={L} x2={W - R} y1={y(v)} y2={y(v)} /><text className="amt" x={L - 6} y={y(v) + 4} textAnchor="end">₱{v >= 100_000_000 ? `${+(v / 100_000_000).toFixed(1)}M` : `${Math.round(v / 100_000)}k`}</text></g>))}
      {rows.filter((r) => r.month.endsWith("-01")).map((r) => <text key={r.month} x={x(rows.indexOf(r))} y={H - 8} textAnchor="middle">{r.year}</text>)}
      {[...data.layers].reverse().map(({ f, vals, bottom }) => stacked ? (
        <path key={f.id} d={`M${vals.map((v, i) => `${x(i)} ${y(v)}`).join(" L")} L${[...bottom].map((v, i) => `${x(i)} ${y(v)}`).reverse().join(" L")} Z`} style={{ fill: f.color, fillOpacity: 0.85 }} />
      ) : (
        <path key={f.id} d={`M${vals.map((v, i) => `${x(i)} ${y(v)}`).join(" L")}`} fill="none" style={{ stroke: f.color }} strokeWidth={3} strokeLinejoin="round" />
      ))}
      {ovIdx.map((i) => <path key={i} d={`M${x(i) - 6} ${T - 2} h12 l-6 10 z`} style={{ fill: "var(--ink)" }} />)}
      {sel ? <line x1={x(rows.findIndex((r) => r.month === sel))} x2={x(rows.findIndex((r) => r.month === sel))} y1={T} y2={H - B} style={{ stroke: "var(--ink)" }} strokeOpacity={0.4} /> : null}
      {rows.map((r, i) => (
        <rect key={r.month} className="v-hit" x={x(i) - (W - L - R) / (n - 1) / 2} y={T} width={(W - L - R) / (n - 1)} height={H - T - B} tabIndex={0} role="button" aria-label={`${label(r.month)}, total ${(totalBalance(r) / 100).toFixed(2)} pesos`} onClick={() => onPick(r.month)} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onPick(r.month)} />
      ))}
    </svg>
  );
}

