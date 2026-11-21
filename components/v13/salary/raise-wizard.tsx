"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { addSalaryEvent } from "@/app/(v13)/pay/actions";
import { addMonths, type YearMonth } from "@/lib/domain/dates";
import { money, mulBp, parsePesos, sub } from "@/lib/domain/money";
import { monthRange } from "@/lib/engine/months";
import { buildMonthPay } from "@/lib/engine/payslip";
import type { Allowance, PayCutoff, SalaryEvent } from "@/lib/engine/types";
import type { RaisePayload } from "@/lib/salary/event-input";
import type { PlaceableLine } from "@/lib/salary/load";
import { eventEffect, salaryAt, type SalaryInput } from "@/lib/salary/view";
import { Money } from "../money";
import { MonthOfYear, MonthPicker } from "../pickers";

type Kind = "merit" | "promotion" | "allowance" | "adjustment";
const KINDS: [Kind, string, string][] = [
  ["merit", "Merit raise", "A percent or a new amount on your base"],
  ["promotion", "Promotion", "New base, maybe a new title and grade"],
  ["allowance", "Allowance change", "A new monthly or yearly allowance"],
  ["adjustment", "One-off adjustment", "A single payment, like a back-pay"],
];
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const label = (m: YearMonth) => `${MON[Number(m.slice(5)) - 1]} ${m.slice(0, 4)}`;
const STEPS = ["What happened", "The numbers", "The extra", "Check the tax", "Save"];

interface Alloc { lineId: string; mode: "amount" | "percent"; value: string }

/**
 * Add a raise, promotion, allowance or one-off in five steps, with the payslip before and after beside the form. The numbers are worked
 * out here by the same engine the rest of the app uses; the server checks them again and saves.
 */
export function RaiseWizard({ input, thisMonth, placeable, initialKind }: { input: SalaryInput; thisMonth: YearMonth; placeable: PlaceableLine[]; initialKind: Kind | null }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [kind, setKind] = useState<Kind>(initialKind ?? "merit");
  // An allowance you already get can start in the past (up to three years back); everything else starts from next month.
  const months = useMemo(() => (kind === "allowance" ? monthRange(addMonths(thisMonth, -36), 97) : monthRange(addMonths(thisMonth, 1), 60)), [thisMonth, kind]);
  const [status, setStatus] = useState<"confirmed" | "expected">("confirmed");
  const [month, setMonth] = useState<YearMonth>(addMonths(thisMonth, 1));
  const [mode, setMode] = useState<"pct" | "amt">("pct");
  const [pct, setPct] = useState("3.5");
  const [newBase, setNewBase] = useState("");
  const [title, setTitle] = useState("");
  const [grade, setGrade] = useState("");
  const [alName, setAlName] = useState("");
  const [alAmount, setAlAmount] = useState("");
  const [alFreq, setAlFreq] = useState<"monthly" | "yearly">("monthly");
  const [alMonth, setAlMonth] = useState(6);
  const [alCutoff, setAlCutoff] = useState<PayCutoff>("second");
  const [taxable, setTaxable] = useState(false);
  const [adj, setAdj] = useState("");
  const [allocs, setAllocs] = useState<Alloc[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();

  // What the form says, as numbers. null means not filled in properly yet.
  const parsed = useMemo(() => {
    const pctNum = Number(pct);
    const base = parsePesos(newBase);
    const alAmt = parsePesos(alAmount);
    const adjAmt = parsePesos(adj);
    return {
      pctBp: Number.isFinite(pctNum) && pctNum > 0 && pctNum <= 1000 ? Math.round(pctNum * 100) : null,
      base: base !== undefined && base > 0 ? base : null,
      alAmt: alAmt !== undefined && alAmt > 0 ? alAmt : null,
      adjAmt: adjAmt !== undefined && adjAmt !== 0 ? adjAmt : null,
    };
  }, [pct, newBase, alAmount, adj]);

  const numbersOk =
    kind === "merit" ? (mode === "pct" ? parsed.pctBp !== null : parsed.base !== null) : kind === "promotion" ? parsed.base !== null : kind === "allowance" ? parsed.alAmt !== null && alName.trim() !== "" : parsed.adjAmt !== null;

  // The input with the new event added, and its effect.
  const after = useMemo<SalaryInput | null>(() => {
    if (!numbersOk) return null;
    const base = { id: "new", effectiveMonth: month, status } as const;
    let event: SalaryEvent;
    let allowances: Allowance[] = [...input.allowances];
    if (kind === "merit") event = { ...base, kind: "merit", pctBp: mode === "pct" ? parsed.pctBp : null, newBase: mode === "amt" ? parsed.base : null };
    else if (kind === "promotion") event = { ...base, kind: "promotion", newBase: parsed.base };
    else if (kind === "allowance") {
      allowances = [...allowances, { id: "new-al", payslipCutoff: alCutoff, name: alName.trim(), amount: parsed.alAmt!, frequency: alFreq, payMonth: alFreq === "yearly" ? alMonth : null, taxable, startsOn: month, endsOn: null }];
      event = { ...base, kind: "allowance", allowanceId: "new-al" };
    } else event = { ...base, kind: "adjustment", oneOffAmount: parsed.adjAmt, oneOffTaxable: taxable };
    return { ...input, events: [...input.events, event], allowances };
  }, [numbersOk, input, month, status, kind, mode, parsed, alCutoff, alName, alFreq, alMonth, taxable]);

  const view = useMemo(() => {
    if (!after) return null;
    const pay = (i: SalaryInput) => buildMonthPay(salaryAt(i, month), i.settings, [], i.templates);
    const b = pay(input);
    const a = pay(after);
    return { b, a, sb: salaryAt(input, month), sa: salaryAt(after, month), effect: eventEffect(input, after, month) };
  }, [after, input, month]);

  const monthly = kind !== "adjustment" && !(kind === "allowance" && alFreq === "yearly");
  const extra = view && monthly ? money(Math.max(0, view.effect.perMonth)) : money(0);
  // Budget top-ups only make sense for new money. An allowance that already started is already in your take-home.
  const canPlace = monthly && month > thisMonth;
  const lineOf = (id: string) => placeable.find((l) => l.id === id);
  const placed = allocs.reduce((t, a) => {
    const v = Number(a.value);
    if (!Number.isFinite(v) || v < 0) return t;
    return t + (a.mode === "percent" ? mulBp(extra, Math.round(v * 100)) : Math.round(v * 100));
  }, 0);
  const left = sub(extra, money(placed));
  const overPlaced = left < -50;
  const available = placeable.filter((l) => !allocs.some((a) => a.lineId === l.id));

  function payload(): RaisePayload {
    return {
      kind,
      status,
      month,
      pctBp: kind === "merit" && mode === "pct" ? (parsed.pctBp ?? undefined) : undefined,
      newBase: (kind === "merit" && mode === "amt") || kind === "promotion" ? (parsed.base ?? undefined) : undefined,
      title: kind === "promotion" ? title : undefined,
      grade: kind === "promotion" ? grade : undefined,
      allowance: kind === "allowance" ? { name: alName.trim(), amount: parsed.alAmt ?? 0, frequency: alFreq, payMonth: alFreq === "yearly" ? alMonth : undefined, cutoff: alCutoff, taxable } : undefined,
      adjustment: kind === "adjustment" ? { amount: parsed.adjAmt ?? 0, taxable } : undefined,
      allocations: canPlace
        ? allocs.flatMap((a): RaisePayload["allocations"] => {
            const v = Number(a.value);
            const line = lineOf(a.lineId);
            if (!line || !Number.isFinite(v) || v <= 0) return [];
            return a.mode === "percent" ? [{ lineId: a.lineId, mode: "percent" as const, pctBp: Math.round(v * 100) }] : [{ lineId: a.lineId, mode: "amount" as const, amount: Math.round((v * 100) / line.cutoffs) }];
          })
        : [],
    };
  }

  const save = () => {
    setError(null);
    start(async () => {
      const r = await addSalaryEvent(payload());
      if (r.error) setError(r.error);
      else router.push("/pay");
    });
  };

  const canNext = step === 1 ? numbersOk : true;
  const skippable = step === 2;

  return (
    <main className="v-main">
      <div className="v-stack v-l">
        <div className="v-row v-sp v-wrap">
          <div>
            <h1>Raise or promotion</h1>
            <ol className="v-steps" aria-label="Steps">
              {STEPS.map((s, i) => (
                <li key={s} aria-current={i === step ? "step" : undefined} className={i < step ? "v-done" : ""}>
                  <span className="v-st"><b>{i + 1}</b><span className="v-tx">{s}</span></span>
                </li>
              ))}
            </ol>
          </div>
          <Link className="v-btn" href="/pay">Close</Link>
        </div>

        <div className="v-wzgrid">
          <div className="v-card v-wzcard">
            {step === 0 ? (
              <>
                <h2>What changed at work?</h2>
                <p className="v-muted">Pick the closest one. You can add more events later.</p>
                <div className="v-choice" role="radiogroup" aria-label="What happened">
                  {KINDS.map(([v, l, d]) => (
                    <label key={v}><input type="radio" name="k" checked={kind === v} onChange={() => { setKind(v); if (v !== "allowance" && month <= thisMonth) setMonth(addMonths(thisMonth, 1)); }} />{l}<small>{d}</small></label>
                  ))}
                </div>
                <div style={{ marginTop: 20 }}>
                  <div className="v-lbl" style={{ marginBottom: 6 }}>How sure is it?</div>
                  <div className="v-seg" role="group" aria-label="How sure is it">
                    <button type="button" aria-pressed={status === "confirmed"} onClick={() => setStatus("confirmed")}>It has happened</button>
                    <button type="button" aria-pressed={status === "expected"} onClick={() => setStatus("expected")}>I&apos;m expecting it</button>
                  </div>
                  <p className="v-xs v-muted" style={{ margin: "8px 0 0" }}>Expected raises are drawn as hollow markers and feed the forecast, so you can plan ahead. Confirm one when it happens.</p>
                </div>
              </>
            ) : null}

            {step === 1 ? (
              <>
                <h2>The details</h2>
                <p className="v-muted">Watch the payslip on the right change as you type.</p>
                <div className="v-frm">
                  {kind === "merit" ? (
                    <div className="v-seg" role="group" aria-label="How to enter it">
                      <button type="button" aria-pressed={mode === "pct"} onClick={() => setMode("pct")}>A percent</button>
                      <button type="button" aria-pressed={mode === "amt"} onClick={() => setMode("amt")}>A new base</button>
                    </div>
                  ) : null}
                  <div className="v-two">
                    {kind === "merit" && mode === "pct" ? <label className="v-field">Raise %<input inputMode="decimal" value={pct} onChange={(e) => setPct(e.target.value)} /></label> : null}
                    {(kind === "merit" && mode === "amt") || kind === "promotion" ? <label className="v-field">New base per month (₱)<input inputMode="decimal" value={newBase} onChange={(e) => setNewBase(e.target.value)} placeholder="80,000" /></label> : null}
                    {kind === "allowance" ? <label className="v-field">Name<input value={alName} maxLength={60} onChange={(e) => setAlName(e.target.value)} placeholder="Transport allowance" /></label> : null}
                    {kind === "allowance" ? <label className="v-field">Amount (₱)<input inputMode="decimal" value={alAmount} onChange={(e) => setAlAmount(e.target.value)} /></label> : null}
                    {kind === "adjustment" ? <label className="v-field">Amount (₱, negative for a deduction)<input inputMode="decimal" value={adj} onChange={(e) => setAdj(e.target.value)} placeholder="5,000" /></label> : null}
                    <div className="v-field">{kind === "allowance" ? "Started or starts in" : "Effective month"}
                      <MonthPicker label="Effective month" value={month} min={months[0]!} max={months[months.length - 1]!} onChange={(v) => v && setMonth(v)} />
                    </div>
                  </div>
                  {kind === "allowance" ? <p className="v-xs v-muted" style={{ margin: 0 }}>Already getting this allowance? Pick the month it started, up to three years back. It then shows in your earlier payslips and the timeline too.</p> : null}
                  {kind === "promotion" ? (
                    <div className="v-two">
                      <label className="v-field">New title<input value={title} maxLength={60} onChange={(e) => setTitle(e.target.value)} /></label>
                      <label className="v-field">Grade<input value={grade} maxLength={30} onChange={(e) => setGrade(e.target.value)} /></label>
                    </div>
                  ) : null}
                  {kind === "allowance" ? (
                    <div className="v-two">
                      <label className="v-field">How often
                        <select value={alFreq} onChange={(e) => setAlFreq(e.target.value as "monthly" | "yearly")}><option value="monthly">Every month</option><option value="yearly">Once a year</option></select>
                      </label>
                      {alFreq === "yearly" ? (
                        <div className="v-field" style={{ gridColumn: "1 / -1" }}>Month it lands<MonthOfYear value={alMonth} label="Month it lands" onChange={setAlMonth} /></div>
                      ) : null}
                      <label className="v-field">Lands in the
                        <select value={alCutoff} onChange={(e) => setAlCutoff(e.target.value as PayCutoff)}><option value="first">1st cutoff</option><option value="second">2nd cutoff</option></select>
                      </label>
                    </div>
                  ) : null}
                  {kind === "allowance" || kind === "adjustment" ? (
                    <label className="v-row" style={{ gap: 10, minHeight: 44 }}>
                      <button type="button" className="v-sw" role="switch" aria-checked={taxable} aria-label="Payroll taxes it" onClick={() => setTaxable(!taxable)} />
                      <span>Payroll taxes it</span>
                    </label>
                  ) : null}
                </div>
              </>
            ) : null}

            {step === 2 ? (
              <>
                <h2>Where does the extra go?</h2>
                <p className="v-muted">Optional. Put part of the new take-home on budget lines. Whatever you leave unplaced lands in Whatever is left, so it still gets saved.</p>
                {!view || !canPlace || extra <= 0 ? (
                  <div className="v-note"><b>Nothing monthly to place.</b> {monthly && month <= thisMonth ? "This one has already started, so it is already part of your take-home." : "This one does not change your monthly take-home."}</div>
                ) : (
                  <div className="v-stack">
                    <div className="v-row v-sp"><span className="v-muted">New take-home each month</span><b className="v-disp" style={{ fontSize: 24 }}><Money value={extra} /></b></div>
                    <div>
                      {allocs.map((a, i) => {
                        const line = lineOf(a.lineId)!;
                        const v = Number(a.value);
                        return (
                          <div key={a.lineId} className="v-row v-wrap" style={{ gap: 10, padding: "10px 0", borderBottom: "1px solid var(--line)" }}>
                            <span className="v-grow"><b>{line.name}</b><span className="v-xs v-muted" style={{ display: "block" }}>from {label(month)} onward{line.cutoffs === 2 && a.mode === "amount" ? ", split across both cutoffs" : ""}</span></span>
                            <span className="v-seg" role="group" aria-label="Enter as" style={{ padding: 2 }}>
                              <button type="button" aria-pressed={a.mode === "amount"} onClick={() => setAllocs((x) => x.map((r, j) => (j === i ? { ...r, mode: "amount" } : r)))} style={{ padding: "4px 10px", minHeight: 32 }}>₱</button>
                              <button type="button" aria-pressed={a.mode === "percent"} onClick={() => setAllocs((x) => x.map((r, j) => (j === i ? { ...r, mode: "percent" } : r)))} style={{ padding: "4px 10px", minHeight: 32 }}>%</button>
                            </span>
                            <input className="v-lbl-in" value={a.value} inputMode="decimal" style={{ width: 100, textAlign: "right", minHeight: 40 }} aria-label={`${a.mode === "percent" ? "Percent" : "Pesos"} for ${line.name}`} onChange={(e) => setAllocs((x) => x.map((r, j) => (j === i ? { ...r, value: e.target.value } : r)))} />
                            <span className="v-num v-xs v-muted" style={{ minWidth: 84, textAlign: "right" }}>{a.mode === "percent" && Number.isFinite(v) ? <Money value={mulBp(extra, Math.round(v * 100))} /> : ""}</span>
                            <button type="button" className="v-iconbtn v-s" onClick={() => setAllocs((x) => x.filter((_, j) => j !== i))} aria-label={`Remove ${line.name}`}>×</button>
                          </div>
                        );
                      })}
                      <div className="v-row v-sp" style={{ padding: "12px 0" }}>
                        <b className={overPlaced ? "v-neg" : ""}>{overPlaced ? "Over by" : "Left to Whatever is left"}</b>
                        <b className={`v-num ${overPlaced ? "v-neg" : "v-pos"}`}><Money value={money(Math.abs(left))} /></b>
                      </div>
                    </div>
                    {available.length > 0 ? (
                      <label className="v-field"><span className="v-sr">Add a budget line</span>
                        <select value="" onChange={(e) => e.target.value && setAllocs((x) => [...x, { lineId: e.target.value, mode: "amount", value: String(Math.max(0, Math.round(left / 100))) }])}>
                          <option value="">Add a budget line…</option>
                          {available.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                        </select>
                      </label>
                    ) : null}
                    <p className="v-xs v-muted" style={{ margin: 0 }}>These top-ups stay tied to this raise. If the raise changes or is removed, they change or go with it.</p>
                  </div>
                )}
              </>
            ) : null}

            {step === 3 ? (
              <>
                <h2>Does the tax look right?</h2>
                <p className="v-muted">This is the same working your payslip uses. If your real payslip differs, you can override it in the payslip builder.</p>
                {view ? (
                  <div className="v-frm">
                    {kind === "adjustment" ? (
                      <div className="v-note">A one-off is taxed on top of your regular year at your marginal rate{taxable ? "" : " (you marked it as not taxed)"}. Your payroll may withhold differently.</div>
                    ) : (
                      <div className="v-pre">After this, income tax is <Money value={view.a.tax} /> a month, {view.a.tax >= view.b.tax ? "up" : "down"} <Money value={money(Math.abs(view.a.tax - view.b.tax))} /> from before.</div>
                    )}
                    <div className="v-note"><b>Contributions:</b> SSS <Money value={view.a.sss} />, PhilHealth <Money value={view.a.philhealth} />, Pag-IBIG <Money value={view.a.pagibig} /> a month.</div>
                  </div>
                ) : <div className="v-note">Fill in the details first.</div>}
              </>
            ) : null}

            {step === 4 ? (
              <div className="v-stack">
                <h2>Ready to save</h2>
                <p className="v-muted">It will appear on Salary and tax, and the budget, bonuses and forecast will follow.</p>
                <div className="v-card v-flat" style={{ display: "grid", gap: 6 }}>
                  <div className="v-row v-sp"><b>{KINDS.find((k) => k[0] === kind)![1]}{status === "expected" ? " (expected)" : ""}</b><span className="v-pill">{label(month)}</span></div>
                  {view && monthly ? <div className="v-sm v-muted" style={{ marginTop: 6 }}><Money value={view.effect.perMonth} signed /> a month. 5-year total <Money value={view.effect.total} signed />.</div> : null}
                </div>
                {overPlaced ? <p className="v-flag v-bad" role="alert">The budget top-ups are more than the extra take-home. Go back and lower them.</p> : null}
                {error ? <p className="v-flag v-bad" role="alert">{error}</p> : null}
                <div className="v-row v-wrap" style={{ gap: 10 }}>
                  <button type="button" className="v-btn v-pri" disabled={busy || !numbersOk || overPlaced} onClick={save}>{busy ? "Saving…" : "Save event"}</button>
                  <button type="button" className="v-btn" onClick={() => setStep(3)}>Back</button>
                </div>
              </div>
            ) : null}

            {step < 4 ? (
              <div className="v-wzfoot">
                {step > 0 ? <button type="button" className="v-btn" onClick={() => setStep(step - 1)}>Back</button> : null}
                <span className="v-gap" />
                {skippable ? <button type="button" className="v-btn v-ghost" onClick={() => { setAllocs([]); setStep(3); }}>Skip</button> : null}
                <button type="button" className="v-btn v-pri" disabled={!canNext} onClick={() => setStep(step + 1)}>Next</button>
              </div>
            ) : null}
          </div>

          <aside className="v-wzslip" aria-label="Payslip before and after">
            <div className="v-slip">
              <div className="v-hd">
                <div><div className="v-lbl">Payslip, before and after</div><div className="v-disp" style={{ fontSize: 22 }}>{view ? `From ${label(month)}` : "Fill in the details"}</div></div>
                {view && monthly ? <div style={{ textAlign: "right" }}><div className="v-lbl">Per cutoff</div><div className="v-num v-pos" style={{ font: "800 20px var(--font-display)" }}><Money value={money(Math.round(view.effect.perMonth / 2))} signed /></div></div> : null}
              </div>
              {view ? <Compare view={view} /> : <div className="v-sec"><p className="v-muted">The payslip appears once the numbers are filled in.</p></div>}
            </div>
            {view && kind !== "adjustment" ? (
              <div className="v-card" style={{ marginTop: 12 }}>
                <div className="v-lbl">Over the next five years</div>
                <div className="v-big v-num v-pos" style={{ fontSize: 30 }}><Money value={view.effect.total} signed /></div>
                <div className="v-sm v-muted">more take-home, about{view.effect.bonusPart > 0 ? <>. Includes <Money value={view.effect.bonusPart} signed /> on 13th-month pay and CIP</> : ""}.</div>
              </div>
            ) : null}
          </aside>
        </div>
      </div>
    </main>
  );
}

function Compare({ view }: { view: { b: ReturnType<typeof buildMonthPay>; a: ReturnType<typeof buildMonthPay>; sb: ReturnType<typeof salaryAt>; sa: ReturnType<typeof salaryAt> } }) {
  const untaxed = (s: ReturnType<typeof salaryAt>) => s.allowances.filter((x) => !x.allowance.taxable).reduce((t, x) => t + x.amount, 0) + s.oneOffs.filter((o) => !o.taxable).reduce((t, o) => t + o.amount, 0);
  const taxed = (s: ReturnType<typeof salaryAt>) => s.allowances.filter((x) => x.allowance.taxable).reduce((t, x) => t + x.amount, 0) + s.oneOffs.filter((o) => o.taxable).reduce((t, o) => t + o.amount, 0);
  const rows: [string, number, number][] = [
    ["Base pay", view.sb.base, view.sa.base],
    ["Allowances", untaxed(view.sb), untaxed(view.sa)],
    ["Taxed allowance or one-off", taxed(view.sb), taxed(view.sa)],
    ["SSS", -view.b.sss, -view.a.sss],
    ["PhilHealth", -view.b.philhealth, -view.a.philhealth],
    ["Pag-IBIG", -view.b.pagibig, -view.a.pagibig],
    ["Income tax", -view.b.tax, -view.a.tax],
  ].filter((r) => Math.abs(r[1] as number) + Math.abs(r[2] as number) > 0) as [string, number, number][];
  const dif = (a: number, b: number) => {
    const d = b - a;
    return Math.abs(d) < 1 ? <span className="v-dif">same</span> : <span className={`v-dif ${d > 0 ? "v-up" : "v-dn"}`}><Money value={money(d)} signed /></span>;
  };
  return (
    <div className="v-scrollx">
      <table className="v-cmp">
        <thead><tr><th>Per month</th><th>Before</th><th>After</th><th>Change</th></tr></thead>
        <tbody>
          {rows.map(([l, b, a]) => (
            <tr key={l}><td>{l}</td><td className="v-num"><Money value={money(b)} /></td><td className="v-num"><Money value={money(a)} /></td><td className="v-num">{dif(b, a)}</td></tr>
          ))}
          <tr className="v-tot"><td>Take-home</td><td className="v-num"><Money value={view.b.takeHome} /></td><td className="v-num"><Money value={view.a.takeHome} /></td><td className="v-num">{dif(view.b.takeHome, view.a.takeHome)}</td></tr>
        </tbody>
      </table>
    </div>
  );
}

