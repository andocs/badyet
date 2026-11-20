"use client";

import { useState, useTransition } from "react";
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

/** Confirm (when expected) and remove, for one salary event. */
export function EventActions({ id, status, kind }: { id: string; status: "confirmed" | "expected"; kind: string }) {
  const { error, busy, run } = useRun();
  return (
    <div className="v-row v-wrap" style={{ gap: 8, marginTop: 8 }}>
      {status === "expected" ? (
        <button type="button" className="v-btn v-sm" disabled={busy} onClick={() => run(() => confirmEvent(id))}>It happened: confirm</button>
      ) : null}
      {kind !== "start" ? (
        <button
          type="button"
          className="v-btn v-sm v-ghost"
          disabled={busy}
          onClick={() => {
            if (window.confirm("Remove this event? Budget top-ups tied to it go too.")) run(() => deleteEvent(id));
          }}
        >
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
export function AllowanceControls({ id, name, cutoff, taxable }: { id: string; name: string; cutoff: "first" | "second"; taxable: boolean }) {
  const { error, busy, run } = useRun();
  return (
    <>
      <div className="v-xs v-muted" style={{ marginTop: 8 }}>Lands in the</div>
      <div className="v-seg v-fit" role="group" aria-label={`${name} lands in`}>
        <button type="button" aria-pressed={cutoff === "first"} disabled={busy} onClick={() => run(() => setAllowance(id, { cutoff: "first" }))}>1st cutoff</button>
        <button type="button" aria-pressed={cutoff === "second"} disabled={busy} onClick={() => run(() => setAllowance(id, { cutoff: "second" }))}>2nd cutoff</button>
      </div>
      <div className="v-row v-wrap" style={{ gap: 12, marginTop: 8 }}>
        <label className="v-row" style={{ gap: 8 }}>
          <span className="v-xs v-muted">Taxable</span>
          <button type="button" className="v-sw" role="switch" aria-checked={taxable} aria-label={`${name} is taxable`} disabled={busy} onClick={() => run(() => setAllowance(id, { taxable: !taxable }))} />
        </label>
        <button
          type="button"
          className="v-btn v-sm v-ghost"
          disabled={busy}
          onClick={() => {
            if (window.confirm(`Remove ${name}?`)) run(() => deleteAllowance(id));
          }}
        >
          Remove
        </button>
      </div>
      {error ? <p className="v-flag v-bad" role="alert">{error}</p> : null}
    </>
  );
}
