"use client";

import Link from "next/link";
import { useState } from "react";
import { divRound, formatPesos, money, parsePesos, type Money } from "@/lib/domain/money";
import { computePay } from "@/lib/pay/compute";
import { parsePayForm } from "@/lib/pay/input";
import { PayBreakdown } from "./pay-breakdown";

export interface WizardInitial {
  annualBase: string;
  allowanceSecond: string;
  sss: string;
  pagibig: string;
  savingsPlanPercent: string;
  philhealthOverride: string;
  taxOverrideFirst: string;
  taxOverrideSecond: string;
}

type Mode = "monthly" | "annual";
const STEPS = ["Base salary", "Allowance and contributions", "Savings plan and overrides", "Review"];
const peso = (m: Money) => formatPesos(m, { symbol: false });

export function PayWizard({
  planId,
  initial,
  action,
  canCancel,
}: {
  planId: string;
  initial: WizardInitial;
  action: (formData: FormData) => void | Promise<void>;
  canCancel: boolean;
}) {
  const editing = initial.annualBase !== "";
  const [step, setStep] = useState(0);
  const [mode, setMode] = useState<Mode>(editing ? "annual" : "monthly");
  const [base, setBase] = useState(initial.annualBase); // typed in the chosen mode
  const [f, setF] = useState(initial);
  const [error, setError] = useState("");

  const typed = parsePesos(base.trim());
  const annual = typed === undefined ? undefined : money(mode === "monthly" ? typed * 12 : typed);
  const annualText = annual === undefined ? "" : peso(annual);
  const parsed = parsePayForm({ ...f, annualBase: annualText });
  const result = parsed.ok ? computePay(parsed.value) : null;
  const set = (k: keyof WizardInitial) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  function next() {
    if (step === 0) {
      if (annual === undefined || annual <= 0) return setError("Enter your salary as an amount, like 50,000.");
    } else if (!parsed.ok) {
      return setError(parsed.error);
    }
    setError("");
    setStep(step + 1);
  }
  function back() {
    setError("");
    setStep(step - 1);
  }

  return (
    <form
      action={action}
      className="form"
      onKeyDown={(e) => {
        // Enter should move to the next step, not submit a half-filled wizard.
        if (e.key === "Enter" && e.target instanceof HTMLInputElement) {
          e.preventDefault();
          if (step < 3) next();
        }
      }}
    >
      <input type="hidden" name="planId" value={planId} />
      <input type="hidden" name="annualBase" value={annualText} />
      {(["allowanceSecond", "sss", "pagibig", "savingsPlanPercent", "philhealthOverride", "taxOverrideFirst", "taxOverrideSecond"] as const).map((k) => (
        <input key={k} type="hidden" name={k} value={f[k]} />
      ))}

      <ol className="steps" aria-label="Pay setup steps">
        {STEPS.map((label, i) => (
          <li key={label} aria-current={i === step ? "step" : undefined} className={i < step ? "done" : undefined}>
            {i + 1}. {label}
          </li>
        ))}
      </ol>

      {error && <p className="notice err" role="alert">{error}</p>}

      {step === 0 && (
        <>
          <h2>What is your base salary?</h2>
          <div className="segmented" role="group" aria-label="Salary period">
            <button type="button" aria-pressed={mode === "monthly"} onClick={() => setMode("monthly")}>Monthly</button>
            <button type="button" aria-pressed={mode === "annual"} onClick={() => setMode("annual")}>Annual</button>
          </div>
          <label className="field">
            <span className="lab">{mode === "monthly" ? "Monthly base salary" : "Annual base salary"}</span>
            <input className="input" inputMode="decimal" autoFocus value={base} onChange={(e) => setBase(e.target.value)} placeholder={mode === "monthly" ? "50,000.00" : "600,000.00"} />
          </label>
          {annual !== undefined && annual > 0 && (
            <p className="notice ok" role="status">
              That is ₱{peso(annual)} a year, ₱{peso(divRound(annual, 12))} a month and ₱{peso(divRound(annual, 24))} basic each cutoff.
              I will work out the rest from this.
            </p>
          )}
        </>
      )}

      {step === 1 && (
        <>
          <h2>Allowance and contributions</h2>
          <p className="sub" style={{ margin: 0 }}>Copy these from your payslip. Leave blank for none.</p>
          <label className="field"><span className="lab">Allowance, 2nd cutoff (not taxed)</span><input className="input" inputMode="decimal" value={f.allowanceSecond} onChange={set("allowanceSecond")} placeholder="0.00" /></label>
          <label className="field"><span className="lab">SSS, 2nd cutoff</span><input className="input" inputMode="decimal" value={f.sss} onChange={set("sss")} placeholder="0.00" /></label>
          <label className="field"><span className="lab">Pag-IBIG, 2nd cutoff</span><input className="input" inputMode="decimal" value={f.pagibig} onChange={set("pagibig")} placeholder="0.00" /></label>
          {result && <p className="notice ok" role="status">PhilHealth is worked out for you: ₱{peso(result.philhealth)} (5% of basic).</p>}
        </>
      )}

      {step === 2 && (
        <>
          <h2>Savings plan and overrides</h2>
          <p className="sub" style={{ margin: 0 }}>All optional. Tax and PhilHealth are calculated; type a value only if your payslip differs.</p>
          <label className="field"><span className="lab">Savings plan, % of basic (not tax-affecting)</span><input className="input" inputMode="decimal" value={f.savingsPlanPercent} onChange={set("savingsPlanPercent")} placeholder="0" /></label>
          <label className="field"><span className="lab">PhilHealth override</span><input className="input" inputMode="decimal" value={f.philhealthOverride} onChange={set("philhealthOverride")} placeholder={result ? peso(result.philhealth) : "calculated"} /></label>
          <label className="field"><span className="lab">Tax override, 1st cutoff</span><input className="input" inputMode="decimal" value={f.taxOverrideFirst} onChange={set("taxOverrideFirst")} placeholder={result ? peso(result.first.tax) : "calculated"} /></label>
          <label className="field"><span className="lab">Tax override, 2nd cutoff</span><input className="input" inputMode="decimal" value={f.taxOverrideSecond} onChange={set("taxOverrideSecond")} placeholder={result ? peso(result.second.tax) : "calculated"} /></label>
        </>
      )}

      {step === 3 && parsed.ok && (
        <>
          <h2>Does this look right?</h2>
          <PayBreakdown profile={parsed.value} />
        </>
      )}

      <div className="wizard-actions">
        <span>
          {step > 0 ? (
            <button type="button" className="btn ghost" onClick={back}>Back</button>
          ) : canCancel ? (
            <Link href="/pay" className="btn ghost">Cancel</Link>
          ) : null}
        </span>
        {step < 3 ? (
          <button key="next" type="button" className="btn" onClick={next}>Next</button>
        ) : (
          <button key="save" type="submit" className="btn">Save pay</button>
        )}
      </div>
    </form>
  );
}
