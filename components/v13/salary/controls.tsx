"use client";

import { createContext, useContext, useOptimistic, useState, useTransition } from "react";
import { confirmEvent, deleteEvent, deleteAllowance, saveAssumptions, setAllowance } from "@/app/(v13)/pay/actions";
import type { FormState } from "@/lib/form-state";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function useRun() {
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const run = (fn: () => Promise<FormState>) =>
    start(async () => {
      const r = await fn();
      setError(r.error ?? null);
    });
  return { error, busy, run };
}

interface ItemState {
  gone: boolean;
  status: "confirmed" | "expected";
  cutoff: "first" | "second";
  taxable: boolean;
}
const ItemCtx = createContext<{ state: ItemState; apply: (c: Partial<ItemState>) => void } | null>(null);
const useItem = () => {
  const v = useContext(ItemCtx);
  if (!v) throw new Error("Used outside an OptimisticItem");
  return v;
};

/**
 * A row you can change in place. A confirm, a cutoff move, a taxable switch or a removal shows at once; the server catches up in the
 * background, and if it says no the row goes back to how it was and shows why.
 */
export function OptimisticItem({ initial, className, style, children }: { initial: ItemState; className?: string; style?: React.CSSProperties; children: React.ReactNode }) {
  const [state, apply] = useOptimistic(initial, (cur, c: Partial<ItemState>) => ({ ...cur, ...c }));
  return (
    <ItemCtx.Provider value={{ state, apply }}>
      <div className={className} style={style} hidden={state.gone}>{children}</div>
    </ItemCtx.Provider>
  );
}

/** The "expected" tag, which disappears the moment you confirm the event. */
export function ExpectedPill() {
  const { state } = useItem();
  return state.status === "expected" ? <> <span className="v-pill v-est">expected</span></> : null;
}

/** Confirm (when expected) and remove, for one salary event. */
export function EventActions({ id, kind }: { id: string; kind: string }) {
  const { state, apply } = useItem();
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();
  const go = (change: Partial<ItemState>, fn: () => Promise<FormState>) =>
    start(async () => {
      setError(null);
      apply(change);
      const r = await fn();
      if (r.error) setError(r.error);
    });
  return (
    <div className="v-row v-wrap" style={{ gap: 8, marginTop: 8 }}>
      {state.status === "expected" ? <button type="button" className="v-btn v-sm" onClick={() => go({ status: "confirmed" }, () => confirmEvent(id))}>It happened: confirm</button> : null}
      {kind !== "start" ? (
        <button type="button" className="v-btn v-sm v-ghost" onClick={() => { if (window.confirm("Remove this event? Budget top-ups tied to it go too.")) go({ gone: true }, () => deleteEvent(id)); }}>
          Remove
        </button>
      ) : null}
      {error ? <span className="v-flag v-bad" role="alert">{error}</span> : null}
    </div>
  );
}

/** "Assume a raise every year": the switch, the percent and the month. Saved when a field changes. */
export function ProjectedRaises({ on, pctBp, month }: { on: boolean; pctBp: number; month: number }) {
  const { error, busy, run } = useRun();
  const [state, setState] = useState({ on, pct: String(pctBp / 100), month });
  const save = (next: typeof state) => {
    setState(next);
    const pct = Number(next.pct);
    if (!Number.isFinite(pct) || pct < 0) return;
    run(() => saveAssumptions({ on: next.on, pctBp: Math.round(pct * 100), month: next.month }));
  };
  return (
    <>
      <label className="v-row" style={{ gap: 12, minHeight: 48 }}>
        <button type="button" className="v-sw" role="switch" aria-checked={state.on} aria-label="Assume a yearly raise" disabled={busy} onClick={() => save({ ...state, on: !state.on })} />
        <span className="v-grow"><b>Assume a raise every year</b></span>
      </label>
      <div className="v-grid2" style={{ marginTop: 8, gap: 10 }}>
        <label className="v-field">
          Raise (%)
          <input inputMode="decimal" value={state.pct} disabled={!state.on} onChange={(e) => setState({ ...state, pct: e.target.value })} onBlur={() => save(state)} />
        </label>
        <label className="v-field">
          In the month of
          <select value={state.month} disabled={!state.on} onChange={(e) => save({ ...state, month: Number(e.target.value) })}>
            {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
        </label>
      </div>
      {error ? <p className="v-flag v-bad" role="alert">{error}</p> : null}
    </>
  );
}

/** Where an allowance lands, whether it is taxable, and removing it. */
export function AllowanceControls({ id, name }: { id: string; name: string }) {
  const { state, apply } = useItem();
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();
  const go = (change: Partial<ItemState>, fn: () => Promise<FormState>) =>
    start(async () => {
      setError(null);
      apply(change);
      const r = await fn();
      if (r.error) setError(r.error);
    });
  return (
    <>
      <div className="v-xs v-muted" style={{ marginTop: 8 }}>Lands in the</div>
      <div className="v-seg v-fit" role="group" aria-label={`${name} lands in`}>
        <button type="button" aria-pressed={state.cutoff === "first"} onClick={() => go({ cutoff: "first" }, () => setAllowance(id, { cutoff: "first" }))}>1st cutoff</button>
        <button type="button" aria-pressed={state.cutoff === "second"} onClick={() => go({ cutoff: "second" }, () => setAllowance(id, { cutoff: "second" }))}>2nd cutoff</button>
      </div>
      <div className="v-row v-wrap" style={{ gap: 12, marginTop: 8 }}>
        <label className="v-row" style={{ gap: 8 }}>
          <span className="v-xs v-muted">Taxable</span>
          <button type="button" className="v-sw" role="switch" aria-checked={state.taxable} aria-label={`${name} is taxable`} onClick={() => go({ taxable: !state.taxable }, () => setAllowance(id, { taxable: !state.taxable }))} />
        </label>
        <button type="button" className="v-btn v-sm v-ghost" onClick={() => { if (window.confirm(`Remove ${name}?`)) go({ gone: true }, () => deleteAllowance(id)); }}>Remove</button>
      </div>
      {error ? <p className="v-flag v-bad" role="alert">{error}</p> : null}
    </>
  );
}
