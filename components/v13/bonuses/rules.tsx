"use client";

import { useRef, useState, useTransition } from "react";
import { archiveRule, saveRule } from "@/app/(v13)/bonuses/actions";
import { parsePesos } from "@/lib/domain/money";
import type { BonusRule } from "@/lib/engine/types";
import { V13Icon } from "../icons";
import { useConfirm, useToast } from "../feedback";
import { Money } from "../money";
import { MonthOfYear, MonthPicker } from "../pickers";
import { Pick } from "../pick";

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const COMPONENT_DENOMINATOR = 10_000_000;

interface Form {
  id?: string;
  recurrence: "yearly" | "once";
  kind: "thirteenth" | "cip" | "custom" | "oneoff";
  name: string;
  payMonth: number;
  onceOn: string;
  cutoff: "first" | "second";
  formula: "base_multiple" | "eligible_x_component_x_multiplier" | "fixed";
  months: string;
  eligible: string;
  component: string;
  fixed: string;
  deMinimis: string;
}

const blank = (recurrence: "yearly" | "once"): Form => ({
  recurrence, kind: recurrence === "once" ? "oneoff" : "custom", name: "", payMonth: 12, onceOn: "", cutoff: "second",
  formula: "fixed", months: "1", eligible: "", component: "", fixed: "", deMinimis: "0",
});
const formOf = (r: BonusRule): Form => ({
  id: r.id, recurrence: r.recurrence, kind: r.kind, name: r.name, payMonth: r.payMonth, onceOn: r.onceOn ?? "", cutoff: r.payslipCutoff, formula: r.formula,
  months: r.baseMultipleBp ? String(r.baseMultipleBp / 10000) : "1", eligible: r.eligibleAmount ? (r.eligibleAmount / 100).toFixed(2) : "",
  component: r.componentNum ? String((r.componentNum / COMPONENT_DENOMINATOR) * 100) : "", fixed: r.fixedAmount ? (r.fixedAmount / 100).toFixed(2) : "",
  deMinimis: (r.deMinimis / 100).toFixed(2),
});
const describe = (r: BonusRule) =>
  r.formula === "base_multiple" ? `${(r.baseMultipleBp ?? 10000) / 10000}× base at that month.` : r.formula === "fixed" ? "A fixed amount." : "Eligible earnings × component × multiplier";

/** The yearly rules and one-offs, with one editor for both. Each rule names the cutoff its bonus lands in; the payslip builder reads it. */
export function RulesPanel({ rules }: { rules: BonusRule[] }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [f, setF] = useState<Form>(blank("yearly"));
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const ask = useConfirm();
  const toast = useToast();
  const thisYear = new Date().getFullYear();
  const set = (c: Partial<Form>) => setF((x) => ({ ...x, ...c }));
  const open = (form: Form) => { setError(null); setF(form); dialog.current?.showModal(); };
  const yearly = rules.filter((r) => r.recurrence === "yearly");
  const once = rules.filter((r) => r.recurrence === "once");

  const save = () => {
    setError(null);
    const months = Number(f.months);
    const comp = Number(f.component);
    const eligible = parsePesos(f.eligible);
    const fixed = parsePesos(f.fixed);
    const dm = parsePesos(f.deMinimis || "0");
    if (dm === undefined) return setError("Enter the de minimis amount, or 0.");
    start(async () => {
      const r = await saveRule({
        id: f.id, name: f.name, recurrence: f.recurrence, kind: f.kind, payMonth: f.payMonth, onceOn: f.recurrence === "once" ? f.onceOn : null, cutoff: f.cutoff, formula: f.formula,
        baseMultipleBp: f.formula === "base_multiple" && Number.isFinite(months) ? Math.round(months * 10000) : null,
        eligibleAmount: f.formula === "eligible_x_component_x_multiplier" ? (eligible ?? null) : null,
        componentNum: f.formula === "eligible_x_component_x_multiplier" && Number.isFinite(comp) ? Math.round((comp / 100) * COMPONENT_DENOMINATOR) : null,
        fixedAmount: f.formula === "fixed" ? (fixed ?? null) : null,
        deMinimis: f.kind === "thirteenth" ? 0 : dm,
      });
      if (r.error) setError(r.error);
      else { dialog.current?.close(); toast("Bonus saved."); }
    });
  };

  const row = (r: BonusRule, once: boolean) => (
    <div key={r.id} className="v-rule">
      <span className="v-av" style={{ background: once ? "var(--gold-tint)" : "var(--tint)", color: once ? "var(--gold-text)" : "var(--accent-text)" }}><V13Icon name="gift" /></span>
      <div className="v-grow">
        <b>{r.name}</b> <span className={`v-pill ${once ? "v-warn" : ""}`}>{once ? (r.onceOn ? `${MON[Number(r.onceOn.slice(5)) - 1]} ${r.onceOn.slice(0, 4)}` : "") : `Every ${MON[r.payMonth - 1]}`}</span>
        <div className="v-sm v-muted">{describe(r)} Lands in the {r.payslipCutoff === "first" ? "1st" : "2nd"} cutoff.</div>
        {r.deMinimis > 0 ? <div className="v-xs v-muted">De minimis <Money value={r.deMinimis} /></div> : null}
      </div>
      <button type="button" className="v-iconbtn v-s" aria-label={`Edit ${r.name}`} onClick={() => open(formOf(r))}>✎</button>
    </div>
  );

  return (
    <>
      <section className="v-card" aria-labelledby="rh">
        <div className="v-row v-sp"><h2 id="rh">Yearly rules</h2><button type="button" className="v-btn v-sm" onClick={() => open(blank("yearly"))}>+ Yearly</button></div>
        <div style={{ marginTop: 6 }}>{yearly.length === 0 ? <p className="v-muted v-sm">No yearly bonuses yet.</p> : yearly.map((r) => row(r, false))}</div>
      </section>
      <section className="v-card" aria-labelledby="oh">
        <div className="v-row v-sp"><h2 id="oh">One-off bonuses</h2><button type="button" className="v-btn v-sm" onClick={() => open(blank("once"))}>+ One-off</button></div>
        <div className="v-xs v-muted" style={{ margin: "2px 0 4px" }}>Announced once, not repeated. The forecast only counts the ones you add.</div>
        <div>{once.length === 0 ? <p className="v-muted v-sm">No one-offs.</p> : once.map((r) => row(r, true))}</div>
      </section>

      <dialog ref={dialog} className="v-dlg" aria-labelledby="bre" onClick={(e) => e.target === dialog.current && dialog.current?.close()}>
        <div className="v-qa" style={{ maxHeight: "92vh", overflow: "auto" }}>
          <div className="v-grab" aria-hidden="true" />
          <div className="v-row v-sp"><h2 id="bre">{f.id ? "Edit bonus" : f.recurrence === "once" ? "Plan a one-off bonus" : "Plan a yearly bonus"}</h2><button type="button" className="v-iconbtn v-s" onClick={() => dialog.current?.close()} aria-label="Close"><V13Icon name="x" /></button></div>
          <div className="v-frm">
            <label className="v-field">Name<input value={f.name} maxLength={60} onChange={(e) => set({ name: e.target.value })} autoFocus /></label>
            {f.recurrence === "yearly" ? (
              <div className="v-frm">
                <div className="v-field">Kind
                  <Pick label="Kind" value={f.kind} options={[{ value: "thirteenth", label: "13th month" }, { value: "cip", label: "CIP" }, { value: "custom", label: "Other yearly bonus" }]} onChange={(v) => { const kind = v as Form["kind"]; set({ kind, formula: kind === "thirteenth" ? "base_multiple" : kind === "cip" ? "eligible_x_component_x_multiplier" : f.formula, deMinimis: kind === "thirteenth" ? "0" : f.deMinimis }); }} />
                </div>
                <div className="v-field">Lands in<MonthOfYear value={f.payMonth} label="Month it lands" onChange={(m) => set({ payMonth: m })} /></div>
              </div>
            ) : (
              <div className="v-field">Month it lands<MonthPicker label="Month it lands" value={f.onceOn} min={`${thisYear - 5}-01`} max={`${thisYear + 10}-12`} onChange={(v) => set({ onceOn: v })} /></div>
            )}
            <div className="v-field">Lands in the
              <div className="v-seg" role="group" aria-label="Cutoff it lands in" style={{ width: "100%" }}>
                {([["first", "1st cutoff"], ["second", "2nd cutoff"]] as const).map(([v, l]) => <button key={v} type="button" style={{ flex: 1 }} aria-pressed={f.cutoff === v} onClick={() => set({ cutoff: v })}>{l}</button>)}
              </div>
            </div>
            <div className="v-field">How it is worked out
              <Pick label="How it is worked out" value={f.formula} options={[{ value: "base_multiple", label: "Months of base pay" }, { value: "eligible_x_component_x_multiplier", label: "Eligible earnings × component × multiplier (CIP)" }, { value: "fixed", label: "A fixed amount" }]} onChange={(v) => set({ formula: v as Form["formula"] })} />
            </div>
            {f.formula === "base_multiple" ? <label className="v-field">Months of base pay<input value={f.months} inputMode="decimal" onChange={(e) => set({ months: e.target.value })} /></label> : null}
            {f.formula === "fixed" ? <label className="v-field">Amount (₱)<input value={f.fixed} inputMode="decimal" onChange={(e) => set({ fixed: e.target.value })} /></label> : null}
            {f.formula === "eligible_x_component_x_multiplier" ? (
              <div className="v-two">
                <label className="v-field">Eligible earnings (₱)<input value={f.eligible} inputMode="decimal" onChange={(e) => set({ eligible: e.target.value })} /></label>
                <label className="v-field">Your component (%)<input value={f.component} inputMode="decimal" placeholder="13.81505" onChange={(e) => set({ component: e.target.value })} /></label>
              </div>
            ) : null}
            <label className="v-field">De minimis (₱, tax-free part){f.kind === "thirteenth" ? " — none for the 13th month" : ""}
              <input value={f.kind === "thirteenth" ? "0" : f.deMinimis} inputMode="decimal" disabled={f.kind === "thirteenth"} onChange={(e) => set({ deMinimis: e.target.value })} />
            </label>
            {error ? <p className="v-flag v-bad" role="alert">{error}</p> : null}
            <div className="v-row">
              <button type="button" className="v-btn v-pri v-grow" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save bonus"}</button>
              {f.id ? <button type="button" className="v-btn" disabled={busy} onClick={async () => { if (await ask({ title: "Remove this bonus?", message: "It leaves your plans. Years already received keep their history.", confirmLabel: "Remove", danger: true })) start(async () => { const r = await archiveRule(f.id!); if (r.error) setError(r.error); else { dialog.current?.close(); toast("Bonus removed."); } }); }}>Remove</button> : null}
            </div>
          </div>
        </div>
      </dialog>
    </>
  );
}
