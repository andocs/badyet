"use client";

import { useOptimistic, useRef, useState, useTransition } from "react";
import { archiveCategory, createPool, saveCategory, setOfficeDay, setUsualOfficeDays, settleDay, undoSettle, takeFromPool } from "@/app/(v13)/budget/actions";
import { money, parsePesos } from "@/lib/domain/money";
import { ACCOUNT_COLORS } from "@/lib/accounts/v13";
import type { FormState } from "@/lib/form-state";
import { V13Icon } from "../icons";
import { Money } from "../money";

const WD = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const dayText = (date: string, weekday: number) => `${WD[weekday - 1]} ${Number(date.slice(8))} ${MON[Number(date.slice(5, 7)) - 1]}`;

function useAct() {
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const act = (fn: () => Promise<FormState>, after?: () => void) =>
    start(async () => {
      const r = await fn();
      setError(r.error ?? null);
      if (!r.error) after?.();
    });
  return { error, busy, act };
}
const Err = ({ error }: { error: string | null }) => (error ? <p className="v-flag v-bad" role="alert">{error}</p> : null);

type RtoChange = { type: "day"; date: string; office: boolean } | { type: "weekday"; weekday: number };

export interface DayView { date: string; weekday: number; usual: boolean; office: boolean; extra: boolean }

/** Usual office days, this cutoff's days (tap one you went in on outside your usual days), the day budget and the contingency used. */
export function RtoCard({ usual, days, today, dayBudget, contingency, extraUsed, rtoLines, contingencyName, range, planned, skipped }: {
  usual: number[]; days: DayView[]; today: string; dayBudget: number; contingency: number; extraUsed: number;
  rtoLines: { name: string; amount: number }[]; contingencyName: string | null; range: string; planned: number; skipped: number;
}) {
  // A tapped weekday or day changes on screen at once; the server catches up in the background and the screen settles on its answer.
  const [st, apply] = useOptimistic({ usual, days }, (cur, c: RtoChange) => {
    if (c.type === "day") return { ...cur, days: cur.days.map((d) => (d.date === c.date ? { ...d, office: c.office, extra: c.office && !d.usual } : d)) };
    const wasUsual = cur.usual.includes(c.weekday);
    return {
      usual: wasUsual ? cur.usual.filter((x) => x !== c.weekday) : [...cur.usual, c.weekday],
      // A day you tapped yourself keeps your tap; every other day of that weekday follows the new usual setting.
      days: cur.days.map((d) => {
        if (d.weekday !== c.weekday) return d;
        const tapped = d.office !== d.usual;
        const usualNow = !wasUsual;
        const office = tapped ? d.office : usualNow;
        return { ...d, usual: usualNow, office, extra: office && !usualNow };
      }),
    };
  });
  const shown = st.days;
  const [tapErr, setTapErr] = useState<string | null>(null);
  const [, startTap] = useTransition();
  const toggleDay = (d: DayView) =>
    startTap(async () => {
      setTapErr(null);
      apply({ type: "day", date: d.date, office: !d.office });
      const r = await setOfficeDay({ date: d.date, office: !d.office, usual: d.usual, dayBudget });
      if (r.error) setTapErr(r.error);
    });
  const toggleWeekday = (day: number) =>
    startTap(async () => {
      setTapErr(null);
      const on = st.usual.includes(day);
      apply({ type: "weekday", weekday: day });
      const r = await setUsualOfficeDays(on ? st.usual.filter((x) => x !== day) : [...st.usual, day]);
      if (r.error) setTapErr(r.error);
    });
  const extra = shown.filter((d) => d.extra).length;
  const plannedNow = shown.filter((d) => d.office && d.usual).length;
  const skippedNow = shown.filter((d) => d.usual && !d.office).length;
  const extraSpent = extra * dayBudget;
  void planned;
  void skipped;
  void extraUsed;
  return (
    <section className="v-card" aria-labelledby="rt">
      <h2 id="rt">Office days (RTO)</h2>
      <div style={{ marginTop: 12 }}>
        <div className="v-lbl" style={{ marginBottom: 8 }}>Usual office days</div>
        <div className="v-wk" role="group" aria-label="Usual office days">
          {WD.map((n, i) => {
            const day = i + 1;
            const on = st.usual.includes(day);
            return <button key={n} type="button" aria-pressed={on} onClick={() => toggleWeekday(day)}>{n}</button>;
          })}
        </div>
        <div className="v-lbl" style={{ margin: "16px 0 8px" }}>This cutoff, {range}. Tap a day you went in outside your usual days.</div>
        <div className="v-dgrid">
          {shown.map((d) => (
            <button key={d.date} type="button" className={`v-dy ${d.office ? "v-on" : ""} ${d.extra ? "v-x" : ""} ${d.date === today ? "v-today" : ""}`} aria-pressed={d.office}
              aria-label={`${dayText(d.date, d.weekday)}, ${d.office ? (d.extra ? "extra office day" : "office day") : "not an office day"}${d.date === today ? ", today" : ""}`}
              onClick={() => toggleDay(d)}>
              <span>{WD[d.weekday - 1]}</span><b>{Number(d.date.slice(8))}</b><span className="v-tag">{d.extra ? "extra" : " "}</span>
            </button>
          ))}
        </div>
        <div className="v-legend2"><span><i className="v-k1" />Usual day</span><span><i className="v-k2" />Extra day (from the contingency)</span></div>
        <div className="v-rtosum">
          <div className="v-row v-sp v-sm"><span><b>{plannedNow} planned</b>{skippedNow ? ` · ${skippedNow} skipped` : ""}</span><b className="v-num"><Money value={money(plannedNow * dayBudget)} /></b></div>
          <div className="v-row v-sp v-sm"><span><b>{extra} extra day{extra === 1 ? "" : "s"}</b></span><b className="v-num"><Money value={money(extraSpent)} /> of <Money value={money(contingency)} /></b></div>
          <div className={`v-bar ${extraSpent > contingency ? "v-bad" : ""}`} role="img" aria-label="Contingency used"><i style={{ width: `${contingency ? Math.min(100, (extraSpent / contingency) * 100) : 0}%` }} /></div>
        </div>
        <div className="v-lbl" style={{ margin: "16px 0 6px" }}>RTO lines</div>
        <div className="v-row v-wrap" style={{ gap: 6 }}>
          {rtoLines.map((l) => <span key={l.name} className="v-pill v-ok">{l.name} · <Money value={money(l.amount)} /> / cutoff</span>)}
          <span className="v-pill v-warn">{contingencyName ?? "No contingency line"}</span>
        </div>
        <p className="v-xs v-muted" style={{ margin: "10px 0 0" }}>The app works out a day&apos;s budget (<Money value={money(dayBudget)} /> now) from your RTO lines and the usual days. Change which lines count in a line&apos;s editor.</p>
        <Err error={tapErr} />
      </div>
    </section>
  );
}

export interface SettleView { date: string; weekday: number; spent: number; budget: number; diff: number; settledTo: string | null }

/** Office days that ended under or over their budget: choose where the difference goes, or undo. */
export function SettleCard({ rows, excess }: { rows: SettleView[]; excess: number }) {
  const { error, busy, act } = useAct();
  const open = rows.filter((r) => !r.settledTo).length;
  if (rows.length === 0) return null;
  return (
    <section className="v-card" aria-labelledby="sl">
      <div className="v-row v-sp v-wrap"><h2 id="sl">Settle office days</h2><span className={`v-pill ${open ? "v-warn" : "v-ok"}`}>{open ? `${open} to settle` : "All settled"}</span></div>
      <div className="v-lbl" style={{ margin: "2px 0 8px" }}>When an office day ends under or over its budget, choose where the difference goes.</div>
      {rows.map((r) => {
        const under = r.diff > 0;
        const amt = Math.abs(r.diff);
        const label = dayText(r.date, r.weekday);
        if (r.settledTo) {
          return (
            <div key={r.date} className="v-stl v-done">
              <div className="v-grow v-sm"><b>{label}</b> · {under ? <><Money value={money(amt)} /> left</> : <><Money value={money(amt)} /> over</>} → <b>{r.settledTo}</b></div>
              <button type="button" className="v-btn v-sm v-ghost" disabled={busy} onClick={() => act(() => undoSettle(r.date))}>Undo</button>
            </div>
          );
        }
        return (
          <div key={r.date} className="v-stl">
            <div className="v-sm"><b>{label}</b> · spent <Money value={money(r.spent)} /> of <Money value={money(r.budget)} />. <b><Money value={money(amt)} /> {under ? "left" : "over"}.</b> {under ? "Put it in:" : "Take it from:"}</div>
            <div className="v-row v-wrap" style={{ gap: 8, marginTop: 8 }}>
              {under ? (
                <>
                  <button type="button" className="v-btn v-sm v-pri" disabled={busy} onClick={() => act(() => settleDay({ date: r.date, under: true, to: "pool", amount: amt }))}>Contingency pool</button>
                  <button type="button" className="v-btn v-sm" disabled={busy} onClick={() => act(() => settleDay({ date: r.date, under: true, to: "wants", amount: amt }))}>Wants</button>
                </>
              ) : (
                <>
                  <button type="button" className="v-btn v-sm v-pri" disabled={busy} onClick={() => act(() => settleDay({ date: r.date, under: false, to: "wants", amount: amt }))}>Wants</button>
                  <button type="button" className="v-btn v-sm" disabled={busy || excess < amt} onClick={() => act(() => settleDay({ date: r.date, under: false, to: "excess", amount: amt }))}>Contingency excess (<Money value={money(excess)} />)</button>
                </>
              )}
            </div>
          </div>
        );
      })}
      <Err error={error} />
    </section>
  );
}

export interface PoolView { id: string; name: string; balance: number; excess: number; perCutoff: number; keepUpTo: number | null; log: { when: string; what: string; amount: number }[] }

/** Pools: money that builds across cutoffs. Use some for something unplanned, or move it to Wants. */
export function PoolsCard({ pools, lines }: { pools: PoolView[]; lines: { id: string; name: string }[] }) {
  const { error, busy, act } = useAct();
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const dialog = useRef<HTMLDialogElement>(null);
  const [form, setForm] = useState({ name: "", lineId: "", keep: "" });
  const take = (p: PoolView, to: "use" | "to_wants") => {
    const v = parsePesos(amounts[p.id] ?? "");
    if (v === undefined || v <= 0) return;
    act(() => takeFromPool({ poolId: p.id, amount: Math.min(v, Math.max(0, p.balance)), to }));
  };
  return (
    <section className="v-card" aria-labelledby="pt">
      <div className="v-row v-sp"><h2 id="pt">Pools</h2><button type="button" className="v-btn v-sm" onClick={() => dialog.current?.showModal()}>+ New pool</button></div>
      <div className="v-lbl" style={{ margin: "2px 0 4px" }}>Money that builds up across cutoffs. Take from it when something unplanned comes up, or move the excess to Wants.</div>
      {pools.length === 0 ? <p className="v-muted v-sm">No pools yet. Mark a line as the RTO contingency, or add a pool.</p> : null}
      {pools.map((p) => {
        const max = Math.max(p.balance, p.keepUpTo ?? 0, 1) * 1.15;
        return (
          <div key={p.id} className="v-pool">
            <div className="v-row v-sp v-top">
              <div><b>{p.name}</b><div className="v-xs v-muted">Adds <Money value={money(p.perCutoff)} /> each cutoff{p.keepUpTo !== null ? <> · keep up to <Money value={money(p.keepUpTo)} /></> : null}</div></div>
              <div style={{ textAlign: "right" }}><div className="v-num" style={{ font: "800 22px var(--font-display)" }}><Money value={money(p.balance)} /></div>{p.excess > 0 ? <span className="v-pill v-warn"><Money value={money(p.excess)} /> excess</span> : null}</div>
            </div>
            <div className="v-pbar" role="img" aria-label={`${p.name} balance`}><i style={{ width: `${Math.max(0, p.balance) / max * 100}%` }} />{p.keepUpTo !== null ? <u style={{ left: `${p.keepUpTo / max * 100}%` }} title="Keep up to" /> : null}</div>
            <div className="v-row v-wrap" style={{ gap: 8, marginTop: 10 }}>
              <label className="v-sr" htmlFor={`pa-${p.id}`}>Amount from {p.name}</label>
              <input id={`pa-${p.id}`} className="v-amtin2" inputMode="decimal" placeholder="₱" value={amounts[p.id] ?? ""} onChange={(e) => setAmounts((a) => ({ ...a, [p.id]: e.target.value }))} />
              <button type="button" className="v-btn v-sm" disabled={busy} onClick={() => take(p, "use")}>Use it</button>
              <button type="button" className="v-btn v-sm" disabled={busy} onClick={() => take(p, "to_wants")}>Move to Wants</button>
              {p.excess > 0 ? <button type="button" className="v-btn v-sm v-ghost" onClick={() => setAmounts((a) => ({ ...a, [p.id]: (p.excess / 100).toFixed(2) }))}>Fill excess</button> : null}
            </div>
            {p.log.length ? <div className="v-plog">{p.log.map((l, i) => <div key={i}>{l.when} · {l.what} · <Money value={money(l.amount)} signed /></div>)}</div> : null}
          </div>
        );
      })}
      <Err error={error} />
      <dialog ref={dialog} className="v-fdlg" aria-labelledby="np" onClick={(e) => e.target === dialog.current && dialog.current?.close()}>
        <div className="v-qa">
          <div className="v-row v-sp"><h2 id="np">New pool</h2><button type="button" className="v-iconbtn v-s" onClick={() => dialog.current?.close()} aria-label="Close"><V13Icon name="x" /></button></div>
          <div className="v-frm">
            <label className="v-field">Name<input value={form.name} maxLength={40} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Car maintenance" /></label>
            <label className="v-field">Funded each cutoff by
              <select value={form.lineId} onChange={(e) => setForm({ ...form, lineId: e.target.value })}><option value="">No line (I add to it by hand)</option>{lines.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select>
            </label>
            <label className="v-field">Keep up to (₱, optional)<input value={form.keep} inputMode="decimal" onChange={(e) => setForm({ ...form, keep: e.target.value })} /></label>
            <button type="button" className="v-btn v-pri" disabled={busy} onClick={() => {
              const keep = form.keep.trim() === "" ? null : parsePesos(form.keep);
              if (keep === undefined) return;
              act(() => createPool({ name: form.name, lineId: form.lineId || null, keepUpTo: keep }), () => { setForm({ name: "", lineId: "", keep: "" }); dialog.current?.close(); });
            }}>Create pool</button>
          </div>
        </div>
      </dialog>
    </section>
  );
}

export interface CategoryView { id: string; name: string; color: string; groupId: string; lines: number }

/** Categories: add, rename, recolour (behind the pencil) and archive. Archived categories keep their history. */
export function CategoriesCard({ categories, groups }: { categories: CategoryView[]; groups: { id: string; name: string }[] }) {
  const { error, busy, act } = useAct();
  const dialog = useRef<HTMLDialogElement>(null);
  const [f, setF] = useState<{ id?: string; name: string; groupId: string; color: string; lines: number }>({ name: "", groupId: groups[0]?.id ?? "", color: ACCOUNT_COLORS[0], lines: 0 });
  const open = (c?: CategoryView) => {
    setF(c ? { id: c.id, name: c.name, groupId: c.groupId, color: c.color, lines: c.lines } : { name: "", groupId: groups[0]?.id ?? "", color: ACCOUNT_COLORS[0], lines: 0 });
    dialog.current?.showModal();
  };
  return (
    <section className="v-card" aria-labelledby="ch">
      <div className="v-row v-sp"><h2 id="ch">Categories</h2><button type="button" className="v-btn v-sm" onClick={() => open()}>+ Category</button></div>
      <div style={{ marginTop: 8 }}>
        {categories.map((c) => (
          <div key={c.id} className="v-cl">
            <span className="v-sw-c" style={{ background: c.color }} />
            <span className="v-grow"><b>{c.name}</b><span className="v-xs v-muted" style={{ display: "block" }}>{c.lines} line{c.lines === 1 ? "" : "s"}</span></span>
            <button type="button" className="v-iconbtn v-s" aria-label={`Edit ${c.name}`} onClick={() => open(c)}>✎</button>
          </div>
        ))}
      </div>
      <div className="v-xs v-muted" style={{ marginTop: 6 }}>Archived categories keep their history.</div>
      <Err error={error} />
      <dialog ref={dialog} className="v-fdlg" aria-labelledby="cd" onClick={(e) => e.target === dialog.current && dialog.current?.close()}>
        <div className="v-qa">
          <div className="v-row v-sp"><h2 id="cd">{f.id ? "Edit category" : "New category"}</h2><button type="button" className="v-iconbtn v-s" onClick={() => dialog.current?.close()} aria-label="Close"><V13Icon name="x" /></button></div>
          <div className="v-frm">
            <label className="v-field">Name<input value={f.name} maxLength={60} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
            <label className="v-field">Group<select value={f.groupId} onChange={(e) => setF({ ...f, groupId: e.target.value })}>{groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select></label>
            <div className="v-chips" role="group" aria-label="Colour">{ACCOUNT_COLORS.map((c) => <button key={c} type="button" className="v-swatch" style={{ background: c }} aria-pressed={f.color === c} aria-label={c} onClick={() => setF({ ...f, color: c })} />)}</div>
            <div className="v-row"><button type="button" className="v-btn v-pri v-grow" disabled={busy} onClick={() => act(() => saveCategory({ id: f.id, name: f.name, groupId: f.groupId, color: f.color }), () => dialog.current?.close())}>Save</button>
              {f.id ? <button type="button" className="v-btn" disabled={busy} onClick={() => act(() => archiveCategory(f.id!), () => dialog.current?.close())}>Archive</button> : null}</div>
            {f.id && f.lines > 0 ? <p className="v-xs v-muted" style={{ margin: 0 }}>A category with budget lines cannot be archived until they move.</p> : null}
          </div>
        </div>
      </dialog>
    </section>
  );
}
