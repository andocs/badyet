"use client";

import { useRef, useState, useTransition } from "react";
import { deletePlan, savePlan } from "@/app/(v13)/installments/actions";
import type { IsoDate } from "@/lib/domain/dates";
import { money, parsePesos } from "@/lib/domain/money";
import { validateInstallment } from "@/lib/installments/input";
import type { PlanRow } from "@/lib/installments/save";
import { summarizePlan } from "@/lib/installments/summary";
import { useConfirm, useToast } from "../feedback";
import { V13Icon } from "../icons";
import { Money } from "../money";

interface Option { id: string; name: string }

interface Draft {
  id?: string;
  name: string;
  kind: "card" | "loan";
  price: string;
  down: string;
  months: string;
  rate: string;
  firstDueOn: string;
  cutoff: "first" | "second";
  accountId: string;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const ymText = (ym: string) => `${MONTHS[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`;
const pesos = (c: number) => (c / 100).toFixed(2);

const blank = (today: string): Draft => ({ name: "", kind: "card", price: "", down: "", months: "12", rate: "0", firstDueOn: today, cutoff: "second", accountId: "" });
const draftOf = (p: PlanRow): Draft => ({
  id: p.id, name: p.name, kind: p.kind, price: pesos(p.price), down: p.down_payment > 0 ? pesos(p.down_payment) : "", months: String(p.term_count),
  rate: String(p.rate_bp / 100), firstDueOn: p.first_due_on, cutoff: p.cutoff, accountId: p.account_id ?? "",
});

/** What the form holds, as the shared validator wants it; null while a typed amount cannot be read yet. */
function toInput(d: Draft) {
  const price = parsePesos(d.price);
  const down = d.down.trim() === "" ? 0 : parsePesos(d.down);
  const rate = d.rate.trim() === "" ? 0 : Number(d.rate);
  if (price === undefined || down === undefined || !Number.isFinite(rate)) return null;
  return {
    id: d.id, name: d.name, kind: d.kind, price, downPayment: down, termCount: Number(d.months), rateBp: Math.round(rate * 100),
    firstDueOn: d.firstDueOn, cutoff: d.cutoff, accountId: d.accountId || null,
  };
}

export function InstallmentsManager({ plans, accounts, today, missing }: { plans: PlanRow[]; accounts: Option[]; today: string; missing: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const ask = useConfirm();
  const toast = useToast();
  const set = (c: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...c } : d));
  const open = (d: Draft) => { setError(null); setDraft(d); dialog.current?.showModal(); };
  const close = () => dialog.current?.close();

  const accountName = new Map(accounts.map((a) => [a.id, a.name]));
  const summaries = plans.map((p) => ({ p, s: summarizePlan({ price: p.price, downPayment: p.down_payment, termCount: p.term_count, rateBp: p.rate_bp, firstDueOn: p.first_due_on }, today as IsoDate) }));
  const active = summaries.filter((x) => !x.s.done);
  const finished = summaries.filter((x) => x.s.done);
  const monthly = active.reduce((t, x) => t + x.s.payment, 0);
  const owed = active.reduce((t, x) => t + x.s.remainingAmount, 0);

  const preview = (() => {
    if (!draft) return null;
    const input = toInput(draft);
    if (!input) return "Enter the amounts as pesos, like 36,000.";
    const v = validateInstallment(input);
    if (!v.ok) return v.error;
    const s = summarizePlan({ price: input.price, downPayment: input.downPayment, termCount: input.termCount, rateBp: input.rateBp, firstDueOn: input.firstDueOn }, today as IsoDate);
    return (
      <>
        <b><Money value={money(s.payment)} /> a month</b> for {input.termCount} months, ending {ymText(s.endsOn)}. Total <Money value={money(s.total)} />
        {s.interest > 0 ? <> (<Money value={money(s.interest)} /> of that is interest)</> : null}.
      </>
    );
  })();

  const save = () => {
    if (!draft) return;
    setError(null);
    const input = toInput(draft);
    if (!input) return setError("Enter the amounts as pesos, like 36,000.");
    start(async () => {
      const r = await savePlan(input);
      if (r.error) setError(r.error);
      else { close(); toast("Plan saved."); }
    });
  };
  const remove = async () => {
    if (!draft?.id) return;
    if (!(await ask({ title: "Delete this plan?", message: "Its budget line goes with it. Spending already recorded stays.", confirmLabel: "Delete", danger: true }))) return;
    start(async () => {
      const r = await deletePlan(draft.id!);
      if (r.error) setError(r.error);
      else { close(); toast("Plan deleted."); }
    });
  };

  if (missing) {
    return <section className="v-card"><p className="v-xs v-muted" style={{ margin: 0 }}>Installments need a database update first: apply supabase/migrations/20261210000000_installment_plans.sql, then reload.</p></section>;
  }

  const card = ({ p, s }: (typeof summaries)[number]) => {
    const pct = s.paid + s.remaining > 0 ? (s.paid / (s.paid + s.remaining)) * 100 : 0;
    return (
      <button key={p.id} type="button" className="v-card v-instcard" style={{ textAlign: "left", cursor: "pointer", width: "100%" }} onClick={() => open(draftOf(p))} aria-label={`Edit ${p.name}`}>
        <div className="v-row v-sp v-wrap">
          <b>{p.name}</b>
          <span className="v-row" style={{ gap: 6 }}>
            <span className="v-pill">{p.kind === "loan" ? "Loan" : "Card plan"}</span>
            <span className="v-pill">{p.cutoff === "first" ? "1st" : "2nd"} cutoff</span>
          </span>
        </div>
        <div className="v-row v-sp v-wrap" style={{ marginTop: 6 }}>
          <span className="v-disp" style={{ fontSize: 22 }}><Money value={money(s.payment)} /> <span className="v-xs v-muted">a month</span></span>
          <span className="v-xs v-muted">{s.done ? `Finished ${ymText(s.endsOn)}` : `Ends ${ymText(s.endsOn)}`}</span>
        </div>
        <div className="v-bar" style={{ margin: "10px 0 6px" }} role="img" aria-label={`${s.paid} of ${s.paid + s.remaining} payments made`}><i style={{ width: `${pct}%`, background: "var(--accent)" }} /></div>
        <div className="v-row v-sp v-xs v-muted v-wrap">
          <span>{s.paid} of {s.paid + s.remaining} paid{p.account_id ? ` · from ${accountName.get(p.account_id) ?? "an account"}` : ""}</span>
          <span><Money value={money(s.remainingAmount)} /> left{s.interest > 0 ? ` · ${(s.interest / 100).toLocaleString("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 })} interest` : ""}</span>
        </div>
      </button>
    );
  };

  return (
    <>
      <section className="v-card v-row v-sp v-wrap" aria-label="Totals">
        <div><div className="v-lbl">Every month</div><b className="v-disp" style={{ fontSize: 26 }}><Money value={money(monthly)} /></b></div>
        <div><div className="v-lbl">Still to pay</div><b className="v-disp" style={{ fontSize: 26 }}><Money value={money(owed)} /></b></div>
        <button type="button" className="v-btn v-pri" onClick={() => open(blank(today))}>+ Add a plan</button>
      </section>

      {plans.length === 0 ? <div className="v-note">No installments yet. Add a card plan or a loan and it appears in your budget as its own line.</div> : null}
      {active.length > 0 ? <div className="v-stack">{active.map(card)}</div> : null}
      {finished.length > 0 ? (
        <details className="v-old"><summary><b>Finished ({finished.length})</b></summary><div className="v-stack" style={{ marginTop: 10 }}>{finished.map(card)}</div></details>
      ) : null}

      <dialog ref={dialog} className="v-dlg" aria-labelledby="inst-edt" onClick={(e) => e.target === dialog.current && close()}>
        {draft ? (
          <div className="v-qa">
            <div className="v-grab" aria-hidden="true" />
            <div className="v-row v-sp"><h2 id="inst-edt">{draft.id ? "Edit plan" : "New plan"}</h2><button type="button" className="v-iconbtn v-s" onClick={close} aria-label="Close"><V13Icon name="x" /></button></div>
            <div className="v-stack" style={{ marginTop: 4 }}>
              <label className="v-field">Name<input value={draft.name} maxLength={60} placeholder="Phone on BPI card" onChange={(e) => set({ name: e.target.value })} autoFocus /></label>
              <div className="v-field">Type
                <div className="v-seg" role="group" aria-label="Type" style={{ width: "100%" }}>
                  {([["card", "Card plan"], ["loan", "Loan"]] as const).map(([v, l]) => <button key={v} type="button" style={{ flex: 1 }} aria-pressed={draft.kind === v} onClick={() => set({ kind: v })}>{l}</button>)}
                </div>
              </div>
              <div className="v-grid2">
                <label className="v-field">{draft.kind === "loan" ? "Loan amount (₱)" : "Price (₱)"}<input value={draft.price} inputMode="decimal" onChange={(e) => set({ price: e.target.value })} /></label>
                <label className="v-field">Down payment (₱, optional)<input value={draft.down} inputMode="decimal" onChange={(e) => set({ down: e.target.value })} /></label>
              </div>
              <div className="v-grid2">
                <label className="v-field">Monthly payments<input value={draft.months} inputMode="numeric" onChange={(e) => set({ months: e.target.value })} /></label>
                <label className="v-field">Interest a year (%)<input value={draft.rate} inputMode="decimal" onChange={(e) => set({ rate: e.target.value })} /></label>
              </div>
              <div className="v-grid2">
                <label className="v-field">First payment on<input type="date" value={draft.firstDueOn} onChange={(e) => set({ firstDueOn: e.target.value })} /></label>
                <div className="v-field">Paid from
                  <div className="v-seg" role="group" aria-label="Cutoff" style={{ width: "100%" }}>
                    {([["first", "1st cutoff"], ["second", "2nd cutoff"]] as const).map(([v, l]) => <button key={v} type="button" style={{ flex: 1 }} aria-pressed={draft.cutoff === v} onClick={() => set({ cutoff: v })}>{l}</button>)}
                  </div>
                </div>
              </div>
              <label className="v-field">Pays out of (optional)
                <select value={draft.accountId} onChange={(e) => set({ accountId: e.target.value })}><option value="">Not tied to an account</option>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
              </label>
              <div className="v-note" aria-live="polite">{preview}</div>
              {error ? <p className="v-flag v-bad" role="alert">{error}</p> : null}
              <div className="v-row">
                <button type="button" className="v-btn v-pri v-grow" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save plan"}</button>
                {draft.id ? <button type="button" className="v-btn" disabled={busy} onClick={remove}>Delete</button> : null}
              </div>
              <p className="v-xs v-muted" style={{ margin: 0 }}>Saving adds or updates one line in Budget (in an Installments category) for the monthly payment, from the first payment month to the last. A payment counts as paid once its date has passed.</p>
            </div>
          </div>
        ) : null}
      </dialog>
    </>
  );
}
