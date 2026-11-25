"use client";

import { useState, useTransition } from "react";
import { saveOtherDeductionsAction } from "@/app/(v13)/pay/actions";
import { money, parsePesos } from "@/lib/domain/money";
import { MAX_OTHER_DEDUCTIONS, type OtherDeductionDraft } from "@/lib/pay/other-deduction";
import { useToast } from "../feedback";
import { Money } from "../money";

const blank = (): OtherDeductionDraft => ({ label: "", cutoff: "both", amount: "", amountSecond: "" });

/** What one row takes in the 1st and 2nd cutoff, or null while it is not readable yet. */
function perCutoff(d: OtherDeductionDraft): { first: number; second: number } | null {
  const a = d.amount.trim() === "" ? undefined : parsePesos(d.amount);
  if (a === undefined || a <= 0) return null;
  const b = d.cutoff === "both" && d.amountSecond.trim() !== "" ? parsePesos(d.amountSecond) : a;
  if (b === undefined) return null;
  return { first: d.cutoff === "second" ? 0 : a, second: d.cutoff === "first" ? 0 : b };
}

/**
 * Payroll deductions that are not the necessary ones, such as your HMO plan or a loan. Each is on the 1st cutoff, the 2nd, or both,
 * with its own amount in each. They lower your take-home, show in their own section on the payslip, and the Budget page lists them
 * without counting them in the planned total.
 */
export function OtherDeductionCard({ items }: { items: OtherDeductionDraft[] }) {
  const toast = useToast();
  const [busy, start] = useTransition();
  const [rows, setRows] = useState<OtherDeductionDraft[]>(items);
  const [error, setError] = useState<string | null>(null);
  const set = (i: number, patch: Partial<OtherDeductionDraft>) => setRows((r) => r.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  const save = () => {
    setError(null);
    start(async () => {
      const r = await saveOtherDeductionsAction({ items: rows });
      if (r.error) setError(r.error);
      else {
        setRows((x) => x.filter((d) => d.label.trim() !== "" || d.amount.trim() !== ""));
        toast("Saved.");
      }
    });
  };

  return (
    <section className="v-card v-stack" aria-labelledby="od-h">
      <div>
        <h2 id="od-h">Other payroll deductions</h2>
        <div className="v-xs v-muted">Something your employer takes from a payslip that is not tax, SSS, PhilHealth or Pag-IBIG, such as an HMO plan or a loan. Pick the cutoff it comes off. It lowers your take-home and shows in its own section on the payslip.</div>
      </div>
      {rows.length === 0 ? <div className="v-xs v-muted">None yet.</div> : null}
      {rows.map((d, i) => {
        const pc = perCutoff(d);
        return (
          <div key={i} className="v-stack" style={{ gap: 10, paddingTop: i === 0 ? 0 : 12, borderTop: i === 0 ? "none" : "1px solid var(--line)" }}>
            <div className="v-two">
              <label className="v-field">Name<input value={d.label} maxLength={30} placeholder="HMO plan" onChange={(e) => set(i, { label: e.target.value })} /></label>
              <label className="v-field">{d.cutoff === "both" ? "1st cutoff amount (₱)" : "Amount (₱)"}<input value={d.amount} inputMode="decimal" placeholder="0" onChange={(e) => set(i, { amount: e.target.value })} /></label>
            </div>
            <div className="v-two">
              <div className="v-field">Cutoff
                <div className="v-seg" role="group" aria-label={`Cutoff for ${d.label || "this deduction"}`} style={{ width: "100%" }}>
                  {([["first", "1st"], ["second", "2nd"], ["both", "Both"]] as const).map(([v, l]) => <button key={v} type="button" style={{ flex: 1 }} aria-pressed={d.cutoff === v} onClick={() => set(i, { cutoff: v })}>{l}</button>)}
                </div>
              </div>
              {d.cutoff === "both" ? (
                <label className="v-field">2nd cutoff amount (₱, empty = same as the 1st)<input value={d.amountSecond} inputMode="decimal" placeholder={d.amount} onChange={(e) => set(i, { amountSecond: e.target.value })} /></label>
              ) : null}
            </div>
            <div className="v-row v-sp">
              <div className="v-xs v-muted" aria-live="polite">
                {pc ? <><b><Money value={money(pc.first + pc.second)} /> a month</b>{pc.first > 0 && pc.second > 0 ? <>: <Money value={money(pc.first)} /> in the 1st cutoff, <Money value={money(pc.second)} /> in the 2nd.</> : <>, all in the {pc.first > 0 ? "1st" : "2nd"} cutoff.</>}</> : null}
              </div>
              <button type="button" className="v-btn v-ghost" onClick={() => setRows((r) => r.filter((_, j) => j !== i))} aria-label={`Remove ${d.label || "this deduction"}`}>Remove</button>
            </div>
          </div>
        );
      })}
      {error ? <p className="v-flag v-bad" role="alert">{error}</p> : null}
      <div className="v-row" style={{ gap: 8 }}>
        <button type="button" className="v-btn" disabled={rows.length >= MAX_OTHER_DEDUCTIONS} onClick={() => setRows((r) => [...r, blank()])}>Add a deduction</button>
        <button type="button" className="v-btn v-pri" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save"}</button>
      </div>
    </section>
  );
}
