"use client";

import { useState, useTransition } from "react";
import { saveSavingsPlanAction } from "@/app/(v13)/pay/actions";
import { money, parsePesos } from "@/lib/domain/money";
import { savingsPlanPerCutoff } from "@/lib/engine/payslip";
import { useToast } from "../feedback";
import { Money } from "../money";
import { Pick } from "../pick";

interface Fund { id: string; name: string }

type Mode = "off" | "percent" | "amount";

/**
 * The payroll savings plan: what your employer takes from each payslip into savings. It lowers take-home, and when it names a fund the
 * forecast counts it as saved into that fund (without taking it out of your budget a second time).
 */
export function SavingsPlanCard({ plan, funds, base }: { plan: { bp: number; amount: number | null; fundId: string | null }; funds: Fund[]; base: number }) {
  const toast = useToast();
  const [busy, start] = useTransition();
  const [mode, setMode] = useState<Mode>(plan.amount != null && plan.amount > 0 ? "amount" : plan.bp > 0 ? "percent" : "off");
  const [percent, setPercent] = useState(plan.bp > 0 ? String(plan.bp / 100) : "");
  const [amount, setAmount] = useState(plan.amount != null && plan.amount > 0 ? (plan.amount / 100).toFixed(2) : "");
  const [fundId, setFundId] = useState(plan.fundId ?? "");
  const [error, setError] = useState<string | null>(null);

  const pct = Number(percent);
  const pesos = amount.trim() === "" ? undefined : parsePesos(amount);
  const perCutoff =
    mode === "percent" && Number.isFinite(pct) && pct > 0 ? savingsPlanPerCutoff({ savingsPlanBp: Math.round(pct * 100), savingsPlanAmount: null }, money(base))
    : mode === "amount" && pesos !== undefined && pesos > 0 ? money(pesos)
    : null;

  const save = () => {
    setError(null);
    if (mode === "percent" && !(Number.isFinite(pct) && pct > 0 && pct <= 100)) return setError("The percent of your basic pay is more than 0 and up to 100.");
    if (mode === "amount" && !(pesos !== undefined && pesos > 0)) return setError("Enter the amount taken each cutoff, like 2,000.");
    start(async () => {
      const r = await saveSavingsPlanAction({ mode, percentBp: mode === "percent" ? Math.round(pct * 100) : null, amount: mode === "amount" ? pesos : null, fundId: mode === "off" ? null : fundId || null });
      if (r.error) setError(r.error);
      else toast("Savings plan saved.");
    });
  };

  return (
    <section className="v-card v-stack" aria-labelledby="sp-h">
      <div>
        <h2 id="sp-h">Payroll savings plan</h2>
        <div className="v-xs v-muted">Money your employer takes from each payslip into savings. It lowers your take-home; the forecast counts it as saved into the fund you pick.</div>
      </div>
      <div className="v-seg" role="group" aria-label="Savings plan">
        {([["off", "None"], ["percent", "% of basic"], ["amount", "Fixed ₱"]] as const).map(([v, l]) => (
          <button key={v} type="button" aria-pressed={mode === v} onClick={() => setMode(v)}>{l}</button>
        ))}
      </div>
      {mode === "percent" ? <label className="v-field">Percent of your basic pay, each cutoff<input value={percent} inputMode="decimal" placeholder="6" onChange={(e) => setPercent(e.target.value)} /></label> : null}
      {mode === "amount" ? <label className="v-field">Amount taken each cutoff (₱)<input value={amount} inputMode="decimal" placeholder="2,000" onChange={(e) => setAmount(e.target.value)} /></label> : null}
      {mode !== "off" ? (
        <div className="v-field">Counts as saved into
          <Pick label="Counts as saved into" value={fundId} options={[{ value: "", label: "No fund (just a payslip deduction)" }, ...funds.map((x) => ({ value: x.id, label: x.name }))]} onChange={setFundId} />
        </div>
      ) : null}
      {perCutoff !== null ? (
        <div className="v-note" aria-live="polite">
          <b><Money value={perCutoff} /></b> each cutoff, <b><Money value={money(perCutoff * 2)} /></b> a month
          {fundId ? ` into ${funds.find((f) => f.id === fundId)?.name ?? "that fund"}` : ", with no fund chosen, so the forecast won't count it as saved"}.
        </div>
      ) : null}
      {error ? <p className="v-flag v-bad" role="alert">{error}</p> : null}
      <div className="v-row"><button type="button" className="v-btn v-pri" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save savings plan"}</button></div>
    </section>
  );
}
