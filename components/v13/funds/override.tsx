"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { bulkOverride, resetMonths, saveOverride } from "@/app/(v13)/funds/actions";
import { money, parsePesos } from "@/lib/domain/money";
import { allocateFunds, type FundForecastMonth } from "@/lib/engine/funds";
import type { Fund, MonthOverride } from "@/lib/engine/types";
import type { ForecastRow } from "@/lib/funds/forecast";
import { useToast } from "../feedback";
import { Money } from "../money";
import { MonthPicker } from "../pickers";
import type { FundMeta } from "./forecast-view";

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const without = <T,>(o: Record<string, T>, id: string): Record<string, T> => Object.fromEntries(Object.entries(o).filter(([k]) => k !== id));
const label = (m: string) => `${MON[Number(m.slice(5)) - 1]} ${m.slice(0, 4)}`;
const WHY = (r: string) => (r.startsWith("priority") ? `Priority ${r.slice(9)}` : r === "cap hit" ? "Cap reached" : r === "pool ran out" ? "Pool ran out" : r === "takes the rest" ? "Takes the rest" : r === "pinned" ? "Pinned" : r === "skipped" ? "Skipped" : r === "bonus savings" ? "Bonus savings" : r === "next step" ? "Next step" : r === "waits for other funds" ? "Next step waits for other funds" : r);

export interface Sim {
  funds: Fund[];
  start: Record<string, number>;
  months: { month: string; pool: number; bonusSavings: number; planCredit: number }[];
  /** The fund the payroll savings plan feeds, if any. */
  planFundId: string | null;
  overrides: { month: string; order: string[] | null; pins: Record<string, number>; skips: string[]; overflow: string | null }[];
}

const toMonths = (s: Sim): FundForecastMonth[] => s.months.map((m) => ({ month: m.month as FundForecastMonth["month"], pool: money(m.pool), bonusSavings: money(m.bonusSavings), planCredits: s.planFundId && m.planCredit > 0 ? { [s.planFundId]: money(m.planCredit) } : undefined }));
const toOverrides = (o: Sim["overrides"]): MonthOverride[] => o.map((x) => ({ month: x.month as MonthOverride["month"], order: x.order, pins: Object.fromEntries(Object.entries(x.pins).map(([k, v]) => [k, money(v)])), skips: x.skips, overflow: x.overflow }));

/** Change one month: reorder, pin an amount or skip a fund, with the effect on this month and five years later worked out live. */
export function OverrideMonth({ month, funds, defaultOrder, sim, existing, months }: {
  month: string; funds: FundMeta[]; defaultOrder: string[]; sim: Sim; existing: { order: string[] | null; pins: Record<string, number>; skips: string[]; note: string; overflow: string | null } | null; months: string[];
}) {
  const [order, setOrder] = useState<string[]>(existing?.order ?? defaultOrder);
  const [pins, setPins] = useState<Record<string, string>>(Object.fromEntries(Object.entries(existing?.pins ?? {}).map(([k, v]) => [k, (v / 100).toFixed(2)])));
  const [skips, setSkips] = useState<string[]>(existing?.skips ?? []);
  const [pinOpen, setPinOpen] = useState<string | null>(null);
  // Where bonus money a full fund cannot take goes; empty = the next funds in priority.
  const [overflow, setOverflow] = useState(existing?.overflow ?? "");
  const [note, setNote] = useState(existing?.note ?? "");
  const [to, setTo] = useState(month);
  const toast = useToast();
  const [busy, start] = useTransition();
  const meta = new Map(funds.map((f) => [f.id, f]));

  const pinsNum = useMemo(() => Object.fromEntries(Object.entries(pins).map(([k, v]) => [k, parsePesos(v) ?? 0])), [pins]);
  const isDefault = order.join() === defaultOrder.join() && Object.keys(pins).length === 0 && skips.length === 0 && overflow === "";
  const current = useMemo<Sim["overrides"][number]>(() => ({ month, order: order.join() === defaultOrder.join() ? null : order, pins: pinsNum, skips, overflow: overflow || null }), [month, order, defaultOrder, pinsNum, skips, overflow]);

  const result = useMemo(() => {
    const others = sim.overrides.filter((o) => o.month !== month);
    const run = (list: Sim["overrides"]) => allocateFunds(sim.funds, Object.fromEntries(Object.entries(sim.start).map(([k, v]) => [k, money(v)])), toMonths(sim), toOverrides(list), sim.planFundId);
    const withIt = run([...others, ...(isDefault ? [] : [current])]);
    const without = run(others);
    const i = sim.months.findIndex((m) => m.month === month);
    return { now: withIt[i]!, was: without[i]!, lastNow: withIt[withIt.length - 1]!, lastWas: without[without.length - 1]! };
  }, [sim, month, current, isDefault]);

  const move = (id: string, by: -1 | 1) => setOrder((o) => { const n = [...o]; const i = n.indexOf(id); [n[i], n[i + by]] = [n[i + by]!, n[i]!]; return n; });
  const idx = months.indexOf(month);
  const run = (fn: () => Promise<{ ok?: boolean; error?: string }>, ok: string) => start(async () => { const r = await fn(); toast(r.error ?? ok, r.error ? "bad" : "ok"); });
  const payload = (monthsList: string[], orderOnly = false) => ({ months: monthsList, order: current.order, pins: orderOnly ? {} : Object.fromEntries(Object.entries(pinsNum).filter(([k]) => !skips.includes(k))), skips: orderOnly ? [] : skips, note: note || null, overflow: orderOnly ? null : current.overflow });
  const range = months.slice(months.indexOf(month), months.indexOf(to) + 1);

  return (
    <div className="v-stack v-l">
      <div className="v-row v-sp v-wrap">
        <div>
          <Link href="/forecast" className="v-sm">← Forecast</Link>
          <h1 style={{ marginTop: 4 }}>Change a month</h1>
          <div className="v-lbl">Reorder, pin an amount or skip a fund, for this month only. Changing several months? <Link href={`/forecast/override?bulk=1&y=${month.slice(0, 4)}`}>Edit months in bulk</Link>.</div>
        </div>
        <div className="v-row">
          {idx > 0 ? <Link className="v-iconbtn" href={`/forecast/override?m=${months[idx - 1]}`} aria-label="Previous month">←</Link> : <span className="v-iconbtn" style={{ opacity: 0.4 }}>←</span>}
          <div style={{ textAlign: "center", minWidth: 110 }}><div className="v-disp" style={{ fontSize: 22 }}>{label(month)}</div><div className="v-xs">{existing ? <span className="v-pill v-ok">Overridden</span> : <span className="v-pill">Default</span>}</div></div>
          {idx < months.length - 1 ? <Link className="v-iconbtn" href={`/forecast/override?m=${months[idx + 1]}`} aria-label="Next month">→</Link> : <span className="v-iconbtn" style={{ opacity: 0.4 }}>→</span>}
        </div>
      </div>

      <div className="v-cols7">
        <section aria-labelledby="ph">
          <div className="v-row v-sp" style={{ marginBottom: 8 }}><h2 id="ph">Priority this month</h2><span className="v-pill">Pool <Money value={money(sim.months[idx]?.pool ?? 0)} /></span></div>
          <div aria-live="polite">
            {order.map((id, i) => {
              const f = meta.get(id)!;
              const pinned = id in pins;
              const sk = skips.includes(id);
              const cell = result.now.funds.find((x) => x.fundId === id);
              return (
                <div key={id}>
                  <div className={`v-fr ${sk ? "v-skip" : ""} ${pinned ? "v-pinned" : ""}`}>
                    <span className="v-grip" aria-hidden="true">⋮⋮</span>
                    <span className="v-rk">{i + 1}</span>
                    <span><b className="v-nm"><i className="v-dot" style={{ background: f.color }} /> {f.name}</b><span className="v-xs v-muted" style={{ display: "block" }}>{f.blurb}</span></span>
                    <span style={{ textAlign: "right" }}><b className="v-num"><Money value={money((cell?.amount ?? 0) + (cell?.bonus ?? 0))} /></b><span className="v-xs v-muted" style={{ display: "block" }}>{(cell?.reasons ?? []).map(WHY).join(" · ")}</span></span>
                    <span className="v-sub"><span className="v-frtools">
                      <button type="button" className="v-iconbtn v-s" disabled={i === 0} onClick={() => move(id, -1)} aria-label={`Move ${f.name} up`}>↑</button>
                      <button type="button" className="v-iconbtn v-s" disabled={i === order.length - 1} onClick={() => move(id, 1)} aria-label={`Move ${f.name} down`}>↓</button>
                      <button type="button" className="v-btn v-sm" aria-pressed={pinned} onClick={() => { if (pinned) { setPins((p) => without(p, id)); setPinOpen(null); } else { setPinOpen(pinOpen === id ? null : id); setSkips((s) => s.filter((x) => x !== id)); } }}>{pinned ? "Pinned" : "Pin amount"}</button>
                      <button type="button" className="v-btn v-sm" aria-pressed={sk} onClick={() => { setSkips((s) => (sk ? s.filter((x) => x !== id) : [...s, id])); setPins((p) => without(p, id)); }}>{sk ? "Skipped" : "Skip"}</button>
                    </span></span>
                  </div>
                  {pinOpen === id ? (
                    <div className="v-fr" style={{ marginTop: -4, borderStyle: "dashed" }}>
                      <span /><span />
                      <label className="v-field v-grow">Pin {f.name} at (₱)<input className="v-pinin" style={{ width: "100%" }} inputMode="decimal" autoFocus defaultValue={String(Math.round(((cell?.amount ?? 0) / 100)))} id={`pin-${id}`} /></label>
                      <button type="button" className="v-btn v-pri v-sm" onClick={() => { const v = (document.getElementById(`pin-${id}`) as HTMLInputElement).value; if (parsePesos(v) === undefined) return; setPins((p) => ({ ...p, [id]: v })); setPinOpen(null); }}>Set</button>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
          <div className="v-note">Use the arrows to reorder. Pinned amounts come out of the pool first; the rest fill top to bottom.</div>
          <section className="v-card v-stack" style={{ marginTop: 14, gap: 8 }}>
            <label className="v-field">This month&apos;s bonus savings go
              <select value={overflow} onChange={(e) => setOverflow(e.target.value)}>
                <option value="">Down this month&apos;s priority order (default)</option>
                {funds.map((f) => <option key={f.id} value={f.id}>To {f.name} first, then by priority</option>)}
                <option value="none">Nowhere (leave it unplaced)</option>
              </select>
            </label>
            <div className="v-xs v-muted">{result.now.bonusUnplaced > 0 ? <><Money value={money(result.now.bonusUnplaced)} /> of bonus money is not placed in any fund this month.</> : "Each fund takes up to its cap and the rest flows to the next. Skipped and full funds are passed over."}</div>
          </section>
          <section className="v-card" style={{ marginTop: 14 }}>
            <h3>Save, reset or copy</h3>
            <label className="v-field" style={{ marginTop: 10 }}>Note (optional)<input value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} placeholder="Trip in March" /></label>
            <div className="v-row v-wrap" style={{ marginTop: 10, gap: 10 }}>
              <button type="button" className="v-btn v-pri" disabled={busy || isDefault} onClick={() => run(() => saveOverride(payload([month])), "Saved.")}>Save this month</button>
              <button type="button" className="v-btn" disabled={busy} onClick={() => { setOrder(defaultOrder); setPins({}); setSkips([]); setOverflow(""); run(() => resetMonths([month]), "Back to the default."); }}>Reset month to default</button>
            </div>
            <hr className="v-hr" style={{ margin: "14px 0" }} />
            <div className="v-row v-wrap" style={{ gap: 10 }}>
              <b>Apply this order from {label(month)} to</b>
              <div className="v-field" style={{ minWidth: 150 }}><span className="v-sr">To</span><MonthPicker label="Apply until" value={to} min={month} max={months[months.length - 1]!} onChange={(v) => v && setTo(v)} /></div>
              <button type="button" className="v-btn v-pri" disabled={busy || order.join() === defaultOrder.join()} onClick={() => run(() => saveOverride(payload(range, true)), `Order applied to ${range.length} month${range.length === 1 ? "" : "s"}.`)}>Apply order</button>
            </div>
            <div className="v-xs v-muted" style={{ marginTop: 6 }}>Copies the order only. Pins and skips stay on their own month.</div>
          </section>
        </section>
        <aside className="v-stack">
          <section className="v-card"><h2>What it does</h2>
            <div style={{ marginTop: 8 }}>
              {isDefault ? <p className="v-muted" style={{ margin: 0 }}>Nothing changed. This month follows the default order.</p> : funds.map((f) => {
                const a = result.now.funds.find((x) => x.fundId === f.id), b = result.was.funds.find((x) => x.fundId === f.id);
                const now = (a?.amount ?? 0) + (a?.bonus ?? 0), was = (b?.amount ?? 0) + (b?.bonus ?? 0), df = now - was;
                return <div key={f.id} className="v-row v-sp" style={{ padding: "7px 0", borderBottom: "1px solid var(--line)" }}><span className="v-row" style={{ gap: 8 }}><i className="v-dot" style={{ background: f.color }} />{f.name}</span><span className="v-num"><b><Money value={money(now)} /></b> {Math.abs(df) > 50 ? <span className={`${df > 0 ? "v-pos" : "v-neg"} v-sm`}><Money value={money(df)} signed /></span> : <span className="v-muted v-sm">same</span>}</span></div>;
              })}
            </div>
          </section>
          <section className="v-card"><h2>Five years later</h2>
            <div style={{ marginTop: 8 }}>
              {funds.map((f) => {
                const a = result.lastNow.funds.find((x) => x.fundId === f.id)?.balanceAfter ?? 0, b = result.lastWas.funds.find((x) => x.fundId === f.id)?.balanceAfter ?? 0, df = a - b;
                return <div key={f.id} className="v-row v-sp v-sm" style={{ padding: "6px 0" }}><span>{f.name} in {label(sim.months[sim.months.length - 1]!.month)}</span><span className="v-num"><b><Money value={money(a)} /></b> {Math.abs(df) > 50 ? <span className={df > 0 ? "v-pos" : "v-neg"}><Money value={money(df)} signed /></span> : null}</span></div>;
              })}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

/** Change several months at once: tick months, then put a fund first, pin or skip it, or reset them. */
export function OverrideBulk({ year, years, funds, rows, firstMonths }: { year: number; years: number[]; funds: FundMeta[]; rows: ForecastRow[]; firstMonths: Record<string, boolean> }) {
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [topF, setTopF] = useState(funds[0]?.id ?? "");
  const [pinF, setPinF] = useState(funds[0]?.id ?? "");
  const [skipF, setSkipF] = useState(funds[0]?.id ?? "");
  const [pinV, setPinV] = useState("2000");
  const [cell, setCell] = useState<{ month: string; fund: string; v: string } | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, start] = useTransition();
  const yearRows = rows.filter((r) => r.year === year);
  const list = [...sel].sort();
  const run = (fn: () => Promise<{ ok?: boolean; error?: string }>, ok: string) => start(async () => { const r = await fn(); setMsg(r.error ? { ok: false, text: r.error } : { ok: true, text: ok }); });
  const apply = (op: "first" | "pin" | "skip", fundId: string, amount?: number) => run(() => bulkOverride({ months: list, op, fundId, amount }), "Done.");
  const toggle = (m: string) => setSel((s) => { const n = new Set(s); if (n.has(m)) n.delete(m); else n.add(m); return n; });
  const short = (n: number) => (n / 100).toLocaleString("en-PH", { maximumFractionDigits: 0 });

  return (
    <div className="v-stack">
      <div className="v-row v-sp v-wrap">
        <div>
          <Link href="/forecast" className="v-sm">← Forecast</Link>
          <h1 style={{ marginTop: 4 }}>Edit months in bulk</h1>
          <div className="v-lbl">Tick months, then change them together. Click one cell to pin or skip just that fund. For one month in detail, use the reorder list on a month.</div>
        </div>
        <div className="v-seg" role="group" aria-label="Year">{years.map((y) => <Link key={y} href={`/forecast/override?bulk=1&y=${y}`} className="v-segl" aria-current={y === year ? "true" : undefined}>{y}</Link>)}</div>
      </div>

      <div className="v-gridwrap" tabIndex={0} role="region" aria-label="Savings by fund and month">
        <table className="v-g">
          <thead>
            <tr>
              <th><span className="v-sr">Fund</span></th>
              {yearRows.map((r) => (
                <th key={r.month} className={sel.has(r.month) ? "v-sel" : ""}>
                  <div className="v-mh"><label><input type="checkbox" checked={sel.has(r.month)} onChange={() => toggle(r.month)} aria-label={`Select ${label(r.month)}`} /><span>{MON[Number(r.month.slice(5)) - 1]}</span></label><span className={`v-ordc ${firstMonths[r.month] ? "v-c" : ""}`}>{firstMonths[r.month] ? "Custom" : "Default"}</span></div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {funds.map((f) => (
              <tr key={f.id}>
                <td><span className="v-row" style={{ gap: 8 }}><i className="v-dot" style={{ background: f.color }} /><b>{f.name}</b></span></td>
                {yearRows.map((r) => {
                  const c = r.funds[f.id];
                  const kind = c?.reasons.includes("pinned") ? "v-pin" : c?.reasons.includes("skipped") ? "v-skip" : "";
                  return (
                    <td key={r.month}>
                      <button type="button" className={`v-cell ${kind} ${cell?.month === r.month && cell.fund === f.id ? "v-sel" : ""}`} aria-label={`${f.name}, ${label(r.month)}: ${((c?.amount ?? 0) / 100).toFixed(2)} pesos${kind ? (kind === "v-pin" ? ", pinned" : ", skipped") : ""}`} onClick={() => setCell({ month: r.month, fund: f.id, v: String(Math.round((c?.amount ?? 0) / 100)) })}>
                        <span className="amt">{c && c.amount > 0 ? short(c.amount) : "0"}</span><small>{c && c.bonus > 0 ? `+${Math.round(c.bonus / 100000)}k credited` : (c?.reasons[0] ?? "").replace("priority ", "#")}</small>
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
            <tr className="v-tot"><td>Pool</td>{yearRows.map((r) => <td key={r.month} style={{ padding: "8px 2px" }}><span className="amt">{short(r.pool)}</span></td>)}</tr>
          </tbody>
        </table>
      </div>
      <div className="v-row v-wrap v-sm v-muted"><span className="v-legend"><span><span className="v-pill v-ok" style={{ padding: "1px 8px" }}>pinned</span></span><span><span className="v-pill v-warn" style={{ padding: "1px 8px" }}>skipped</span></span><span>Cell number is what the fund got that month</span></span></div>

      {sel.size > 0 ? (
        <div className="v-actions" role="region" aria-label="Actions for selected months">
          <b>{sel.size} month{sel.size > 1 ? "s" : ""} ticked</b>
          <label className="v-row" style={{ gap: 6 }}>Put <select value={topF} onChange={(e) => setTopF(e.target.value)}>{funds.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select> first <button type="button" className="v-btn v-sm" disabled={busy} onClick={() => apply("first", topF)}>Apply</button></label>
          <span className="v-row" style={{ gap: 6 }}>Pin <select value={pinF} onChange={(e) => setPinF(e.target.value)}>{funds.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select><input value={pinV} inputMode="decimal" aria-label="Pin amount" onChange={(e) => setPinV(e.target.value)} /><button type="button" className="v-btn v-sm" disabled={busy} onClick={() => { const v = parsePesos(pinV); if (v !== undefined) apply("pin", pinF, v); }}>Apply</button></span>
          <span className="v-row" style={{ gap: 6 }}>Skip <select value={skipF} onChange={(e) => setSkipF(e.target.value)}>{funds.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select><button type="button" className="v-btn v-sm" disabled={busy} onClick={() => apply("skip", skipF)}>Apply</button></span>
          <button type="button" className="v-btn v-sm" disabled={busy} onClick={() => run(() => resetMonths(list), "Reset to the default.")}>Reset to default</button>
          <button type="button" className="v-btn v-sm v-ghost" onClick={() => setSel(new Set())}>Clear ticks</button>
        </div>
      ) : null}

      {cell ? (
        <div className="v-card" style={{ borderColor: "var(--accent)" }} role="dialog" aria-labelledby="popt">
          <div className="v-row v-sp v-wrap"><h2 id="popt">{funds.find((f) => f.id === cell.fund)?.name} · {label(cell.month)}</h2><button type="button" className="v-iconbtn v-s" onClick={() => setCell(null)} aria-label="Close">×</button></div>
          <div className="v-row v-wrap" style={{ marginTop: 10, gap: 10 }}>
            <label className="v-field">Pin at (₱)<input value={cell.v} inputMode="decimal" style={{ width: 140 }} onChange={(e) => setCell({ ...cell, v: e.target.value })} /></label>
            <button type="button" className="v-btn v-pri v-sm" style={{ alignSelf: "flex-end" }} disabled={busy} onClick={() => { const v = parsePesos(cell.v); if (v !== undefined) run(() => bulkOverride({ months: [cell.month], op: "pin", fundId: cell.fund, amount: v }), "Pinned."); }}>Pin amount</button>
            <button type="button" className="v-btn v-sm" style={{ alignSelf: "flex-end" }} disabled={busy} onClick={() => run(() => bulkOverride({ months: [cell.month], op: "skip", fundId: cell.fund }), "Skipped.")}>Skip this month</button>
            <button type="button" className="v-btn v-sm v-ghost" style={{ alignSelf: "flex-end" }} disabled={busy} onClick={() => run(() => bulkOverride({ months: [cell.month], op: "unpin", fundId: cell.fund }), "Cleared.")}>Clear</button>
          </div>
        </div>
      ) : null}
      {msg ? <p className={`v-flag ${msg.ok ? "" : "v-bad"}`} role="status" style={msg.ok ? { background: "var(--tint)", color: "var(--accent-text)" } : undefined}>{msg.text}</p> : null}
    </div>
  );
}
