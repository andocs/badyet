"use client";

import { useState, useTransition } from "react";
import { saveOtherDeductionAction } from "@/app/(v13)/pay/actions";
import { money } from "@/lib/domain/money";
import { useToast } from "../feedback";
import { Money } from "../money";

/**
 * A payroll deduction that is not one of the necessary ones, such as your HMO plan. It comes off every cutoff and has its own
 * section on the payslip; the Budget page lists it without counting it in the planned total.
 */
export function OtherDeductionCard({ label: label0, amount: amount0 }: { label: string; amount: number }) {
  const toast = useToast();
  const [busy, start] = useTransition();
  const [label, setLabel] = useState(label0);
  const [amount, setAmount] = useState(amount0 > 0 ? (amount0 / 100).toFixed(2) : "");
  const [error, setError] = useState<string | null>(null);
  const typed = Number(amount.replace(/,/g, ""));

  const save = () => {
    setError(null);
    start(async () => {
      const r = await saveOtherDeductionAction({ label, amount });
      if (r.error) setError(r.error);
      else toast("Saved.");
    });
  };

  return (
    <section className="v-card v-stack" aria-labelledby="od-h">
      <div>
        <h2 id="od-h">Other payroll deduction</h2>
        <div className="v-xs v-muted">Something your employer takes from each payslip that is not tax, SSS, PhilHealth or Pag-IBIG, such as an HMO plan. It lowers your take-home and shows in its own section on the payslip.</div>
      </div>
      <div className="v-two">
        <label className="v-field">Name<input value={label} maxLength={30} placeholder="HMO plan" onChange={(e) => setLabel(e.target.value)} /></label>
        <label className="v-field">Taken each cutoff (₱)<input value={amount} inputMode="decimal" placeholder="0" onChange={(e) => setAmount(e.target.value)} /></label>
      </div>
      {Number.isFinite(typed) && typed > 0 ? <div className="v-note" aria-live="polite"><b><Money value={money(Math.round(typed * 100))} /></b> each cutoff, <b><Money value={money(Math.round(typed * 200))} /></b> a month.</div> : null}
      {error ? <p className="v-flag v-bad" role="alert">{error}</p> : null}
      <div className="v-row"><button type="button" className="v-btn v-pri" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save"}</button></div>
    </section>
  );
}
