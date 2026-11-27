"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { addPlan, editPlan, removePlan } from "@/app/(v13)/budget/actions";
import { cutoffRefLabel, type PlanSpan } from "@/lib/budget/plans";
import { Pick } from "../pick";

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** The next 36 months from this one, for the plan date pickers. */
function monthsFrom(start: string): string[] {
  const out: string[] = [];
  let y = Number(start.slice(0, 4));
  let m = Number(start.slice(5, 7));
  for (let i = 0; i < 36; i += 1) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    m += 1;
    if (m > 12) { m = 1; y += 1; }
  }
  return out;
}

interface Form { id: string | null; name: string; fromMonth: string; fromCut: string; toMonth: string; toCut: string }

/** Which budget the board shows (the normal one or a plan), and making, changing or deleting plans. */
export function PlanBar({ plans, selected, activeNow, thisMonth }: { plans: PlanSpan[]; selected: string | null; activeNow: string | null; thisMonth: string }) {
  const router = useRouter();
  const [form, setForm] = useState<Form | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const months = monthsFrom(thisMonth);
  const sel = plans.find((p) => p.id === selected) ?? null;

  const openNew = () => { setError(null); setForm({ id: null, name: "", fromMonth: thisMonth, fromCut: "first", toMonth: months[2]!, toCut: "second" }); };
  const openEdit = (p: PlanSpan) => { setError(null); setForm({ id: p.id, name: p.name, fromMonth: p.from.month, fromCut: p.from.cutoff, toMonth: p.to.month, toCut: p.to.cutoff }); };
  const save = () =>
    start(async () => {
      if (!form) return;
      setError(null);
      const body = { name: form.name, from: { month: form.fromMonth, cutoff: form.fromCut }, to: { month: form.toMonth, cutoff: form.toCut } };
      const r = form.id ? await editPlan({ ...body, id: form.id }) : await addPlan(body);
      if (r.error) return setError(r.error);
      setForm(null);
      if (!form.id && "id" in r && r.id) router.push(`/budget?p=${r.id}`);
    });
  const del = (p: PlanSpan) =>
    start(async () => {
      if (!window.confirm(`Delete "${p.name}" and its lines? The normal budget applies to those cutoffs again.`)) return;
      const r = await removePlan(p.id);
      if (r.error) setError(r.error);
      else router.push("/budget?p=normal");
    });

  const cutPick = (label: string, month: string, cut: string, set: (m: string, c: string) => void) => (
    <fieldset className="v-row v-wrap" style={{ gap: 8, border: 0, padding: 0, margin: 0 }}>
      <legend className="v-lbl" style={{ marginBottom: 4 }}>{label}</legend>
      <span className="v-pickrow"><Pick label={`${label}: month`} value={month} options={[...new Set([month, ...months])].sort().map((m) => ({ value: m, label: `${MON[Number(m.slice(5)) - 1]} ${m.slice(0, 4)}` }))} onChange={(v) => set(v, cut)} />
      <Pick label={`${label}: cutoff`} value={cut} options={[{ value: "first", label: "1st cutoff" }, { value: "second", label: "2nd cutoff" }]} onChange={(v) => set(month, v)} /></span>
    </fieldset>
  );

  return (
    <section className="v-card v-stack" aria-labelledby="plh" style={{ gap: 10 }}>
      <div className="v-row v-sp v-wrap">
        <h2 id="plh">Budget plans</h2>
        <button type="button" className="v-btn v-sm" onClick={openNew}>+ New plan</button>
      </div>
      <div className="v-row v-wrap" style={{ gap: 8 }} role="group" aria-label="Budget shown">
        <Link href="/budget?p=normal" className={`v-btn v-sm ${selected === null ? "v-pri" : ""}`} aria-current={selected === null ? "true" : undefined}>
          Normal budget{activeNow === null ? " · in force" : ""}
        </Link>
        {plans.map((p) => (
          <Link key={p.id} href={`/budget?p=${p.id}`} className={`v-btn v-sm ${selected === p.id ? "v-pri" : ""}`} aria-current={selected === p.id ? "true" : undefined}>
            {p.name}{activeNow === p.id ? " · in force" : ""}
          </Link>
        ))}
      </div>
      <p className="v-xs v-muted" style={{ margin: 0 }}>
        {sel
          ? <>Showing <b>{sel.name}</b>: {cutoffRefLabel(sel.from)} to {cutoffRefLabel(sel.to)}. It replaces the normal budget for those cutoffs. Lines you add or change here only change this plan.</>
          : plans.length === 0
            ? "A plan is a whole budget for a range of cutoffs, for example a trip or a lean few months. It starts as a copy of this one."
            : "Showing the normal budget: it applies to every cutoff no plan covers."}
      </p>
      {sel && !form ? (
        <div className="v-row" style={{ gap: 8 }}>
          <button type="button" className="v-btn v-sm" onClick={() => openEdit(sel)}>Edit plan</button>
          <button type="button" className="v-btn v-sm v-ghost" disabled={busy} onClick={() => del(sel)}>Delete plan</button>
        </div>
      ) : null}
      {form ? (
        <div className="v-stack" style={{ gap: 10, borderTop: "1px solid var(--line)", paddingTop: 10 }}>
          <label className="v-field">Name<input value={form.name} maxLength={40} placeholder="e.g. Japan trip" onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
          <div className="v-row v-wrap" style={{ gap: 16 }}>
            {cutPick("Starts", form.fromMonth, form.fromCut, (m, c) => setForm({ ...form, fromMonth: m, fromCut: c }))}
            {cutPick("Ends (included)", form.toMonth, form.toCut, (m, c) => setForm({ ...form, toMonth: m, toCut: c }))}
          </div>
          {!form.id ? <p className="v-xs v-muted" style={{ margin: 0 }}>Your current budget lines are copied into the plan. Change them after.</p> : null}
          {error ? <p className="v-flag v-bad" role="alert" style={{ margin: 0 }}>{error}</p> : null}
          <div className="v-row" style={{ gap: 8 }}>
            <button type="button" className="v-btn v-pri v-sm" disabled={busy || form.name.trim() === ""} onClick={save}>{form.id ? "Save plan" : "Create plan"}</button>
            <button type="button" className="v-btn v-sm" onClick={() => setForm(null)}>Cancel</button>
          </div>
        </div>
      ) : error ? <p className="v-flag v-bad" role="alert" style={{ margin: 0 }}>{error}</p> : null}
    </section>
  );
}
