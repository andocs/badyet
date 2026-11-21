"use client";

import { useMemo, useOptimistic, useState, useTransition } from "react";
import { resetTemplates, saveTemplates, setAllowance } from "@/app/(v13)/pay/actions";
import type { YearMonth } from "@/lib/domain/dates";
import { money, parsePesos, type Money as MoneyValue } from "@/lib/domain/money";
import { planBonuses } from "@/lib/engine/bonus";
import { buildMonthPay, defaultTemplate, taxBreakdown, templateFor, type Payslip, type PayslipLineSpec, type PayslipTemplate } from "@/lib/engine/payslip";
import type { PayCutoff } from "@/lib/engine/types";
import { TAX_ROWS } from "@/lib/pay/tax-table";
import { salaryAt, type SalaryInput } from "@/lib/salary/view";
import { Money } from "../money";

interface Draft {
  key: string;
  spec: PayslipLineSpec;
}
type Drafts = Record<PayCutoff, Draft[]>;

let counter = 0;
const draftsFrom = (t: PayslipTemplate): Draft[] => t.lines.map((spec) => ({ key: `d${counter++}`, spec: { ...spec } }));
const fresh = (templates: readonly PayslipTemplate[], month: YearMonth): Drafts => ({
  first: draftsFrom(templateFor(templates, "first", month)),
  second: draftsFrom(templateFor(templates, "second", month)),
});
const MOVABLE = new Set(["sss", "philhealth", "pagibig", "custom"]);

/**
 * The payslip builder: both cutoffs side by side for a month. Edit the layout (split of base and tax, where each deduction sits, your own
 * lines, amounts) and watch the take-home change; save it to apply from that month on. Allowances sit where their own setting says.
 */
export function PayslipBuilder({ input, month, months }: { input: SalaryInput; month: YearMonth; months: { value: YearMonth; label: string }[] }) {
  const [drafts, setDrafts] = useState<Drafts>(() => fresh(input.templates, month));
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, start] = useTransition();
  // Moving an allowance to the other cutoff or switching Taxable shows in the payslips at once; the server catches up behind it.
  const [allowances, applyAllowance] = useOptimistic(input.allowances, (cur, c: { id: string; cutoff?: PayCutoff; taxable?: boolean }) =>
    cur.map((a) => (a.id === c.id ? { ...a, ...(c.cutoff ? { payslipCutoff: c.cutoff } : {}), ...(c.taxable !== undefined ? { taxable: c.taxable } : {}) } : a)),
  );
  const eff = useMemo(() => ({ ...input, allowances }), [input, allowances]);
  const [, startAllowance] = useTransition();
  const changeAllowance = (id: string, change: { cutoff?: PayCutoff; taxable?: boolean }) =>
    startAllowance(async () => {
      applyAllowance({ id, ...change });
      await setAllowance(id, change);
    });

  const templates = useMemo<PayslipTemplate[]>(
    () => [
      { cutoff: "first", effectiveMonth: month, lines: drafts.first.map((d) => d.spec) },
      { cutoff: "second", effectiveMonth: month, lines: drafts.second.map((d) => d.spec) },
    ],
    [drafts, month],
  );
  const salary = useMemo(() => salaryAt(eff, month), [eff, month]);
  const bonuses = useMemo(() => planBonuses(eff.bonusRules, eff.bonusInstances, (m) => salaryAt(eff, m), eff.settings, eff.assumptions, [month]), [eff, month]);
  const pay = useMemo(() => buildMonthPay(salary, input.settings, bonuses, templates), [salary, input.settings, bonuses, templates]);
  const working = useMemo(() => taxBreakdown(TAX_ROWS, money((pay.regularTaxable * 12 + pay.oneTimeTaxable) as number)), [pay]);

  const update = (cutoff: PayCutoff, key: string, change: Partial<PayslipLineSpec>) =>
    setDrafts((d) => ({ ...d, [cutoff]: d[cutoff].map((x) => (x.key === key ? { ...x, spec: { ...x.spec, ...change } } : x)) }));
  const move = (cutoff: PayCutoff, key: string) =>
    setDrafts((d) => {
      const other: PayCutoff = cutoff === "first" ? "second" : "first";
      const item = d[cutoff].find((x) => x.key === key);
      return item ? { [cutoff]: d[cutoff].filter((x) => x.key !== key), [other]: [...d[other], item] } as Drafts : d;
    });
  const remove = (cutoff: PayCutoff, key: string) => setDrafts((d) => ({ ...d, [cutoff]: d[cutoff].filter((x) => x.key !== key) }));
  const add = (cutoff: PayCutoff, spec: PayslipLineSpec) => setDrafts((d) => ({ ...d, [cutoff]: [...d[cutoff], { key: `d${counter++}`, spec }] }));

  const shareOf = (cutoff: PayCutoff, source: "base_share" | "income_tax") => drafts[cutoff].find((d) => d.spec.source === source)?.spec.shareBp ?? 5000;
  const setSplit = (source: "base_share" | "income_tax", firstPct: number) => {
    const bp = Math.round(Math.min(100, Math.max(0, firstPct)) * 100);
    setDrafts((d) => ({
      first: d.first.map((x) => (x.spec.source === source ? { ...x, spec: { ...x.spec, shareBp: bp } } : x)),
      second: d.second.map((x) => (x.spec.source === source ? { ...x, spec: { ...x.spec, shareBp: 10_000 - bp } } : x)),
    }));
  };

  const act = (fn: () => Promise<{ ok?: boolean; error?: string }>, done: string) => {
    setError(null);
    setNote(null);
    start(async () => {
      const r = await fn();
      if (r.error) setError(r.error);
      else setNote(done);
    });
  };
  const save = () =>
    act(
      () =>
        saveTemplates({
          month,
          first: drafts.first.map((d) => ({ kind: d.spec.kind, label: d.spec.label, source: d.spec.source, shareBp: d.spec.shareBp ?? null, amountOverride: d.spec.amountOverride ?? null })),
          second: drafts.second.map((d) => ({ kind: d.spec.kind, label: d.spec.label, source: d.spec.source, shareBp: d.spec.shareBp ?? null, amountOverride: d.spec.amountOverride ?? null })),
        }),
      "Saved. This layout applies from this month on.",
    );
  const reset = () => {
    setDrafts({ first: draftsFrom(defaultTemplate("first")), second: draftsFrom(defaultTemplate("second")) });
    act(() => resetTemplates(month), "Back to the standard layout from this month on.");
  };

  const total = (kind: "earning" | "deduction") => money([...pay.first.lines, ...pay.second.lines].filter((l) => l.kind === kind).reduce((s, l) => s + Number(l.amount), 0));

  return (
    <div className="v-stack">
      <div className="v-row v-sp v-wrap v-pbhead">
        <div>
          <h2>Payslip builder</h2>
          <div className="v-lbl">Build each cutoff&apos;s payslip once. Regular lines repeat every month; bonuses appear in the month they land.</div>
        </div>
        <label className="v-row" style={{ gap: 8 }}>
          <span className="v-lbl">Month</span>
          <select className="v-lbl-in" value={month} onChange={(e) => (window.location.search = `?tab=payslip&month=${e.target.value}`)} aria-label="Month">
            {months.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </label>
      </div>

      <div className="v-pbgrid">
        <div className="v-stack">
          <section className="v-card v-pbbar" aria-label="Layout">
            <div className="v-pbtop">
              <div className="v-pbtot">
                <div className="v-lbl">Monthly total</div>
                <div className="v-big v-num" style={{ fontSize: 30, color: "var(--accent-text)" }}><Money value={pay.takeHome} /></div>
              </div>
              <div className="v-pbact">
                <button type="button" className="v-btn v-sm" onClick={reset} disabled={busy}>Standard layout</button>
                <button type="button" className="v-btn v-sm v-pri" onClick={save} disabled={busy}>Save from this month on</button>
              </div>
            </div>
            <div className="v-pbgroups">
              {([["base_share", "Base pay"], ["income_tax", "Income tax"]] as const).map(([source, name]) => (
                <div key={source} className="v-pbgrp">
                  {(["first", "second"] as const).map((c) => {
                    const ord = c === "first" ? "1st" : "2nd";
                    return (
                      <label key={c} className="v-pbf">
                        <span className="v-sm v-muted">{name} in {ord} cutoff</span>
                        <span className="v-row" style={{ gap: 6 }}>
                          <input className="v-lbl-in" style={{ width: 84, textAlign: "right" }} inputMode="decimal" defaultValue={shareOf(c, source) / 100} key={`${source}${c}${shareOf(c, source)}`}
                            onBlur={(e) => { const n = Number(e.target.value) || 0; setSplit(source, c === "first" ? n : 100 - n); }} aria-label={`Percent of ${name.toLowerCase()} in the ${ord} cutoff`} />
                          <span className="v-sm v-muted">%</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              ))}
            </div>
          </section>
          {error ? <p className="v-flag v-bad" role="alert">{error}</p> : null}
          {note ? <p className="v-flag" role="status" style={{ background: "var(--tint)", color: "var(--accent-text)" }}>{note}</p> : null}
          {(["first", "second"] as const).map((c) => (
            <Slip key={c} cutoff={c} slip={pay[c]} drafts={drafts[c]} salary={salary} onAllowance={changeAllowance} onChange={(k, ch) => update(c, k, ch)} onMove={(k) => move(c, k)} onRemove={(k) => remove(c, k)} onAdd={(spec) => add(c, spec)} />
          ))}
        </div>
        <aside className="v-card v-pbsum2" aria-labelledby="pbs">
          <h2 id="pbs">Summary</h2>
          <div className="v-ln"><span>Total earnings</span><b className="v-num"><Money value={total("earning")} /></b></div>
          <div className="v-ln"><span>Total deductions</span><b className="v-num"><Money value={total("deduction")} /></b></div>
          <div className="v-pbtake"><span className="v-lbl">Take-home pay</span><b className="v-num"><Money value={pay.takeHome} /></b></div>
          <p className="v-xs v-muted" style={{ margin: 0 }}>Saving applies this layout to both cutoffs from this month on.</p>
        </aside>
      </div>

      <details className="v-card">
        <summary style={{ cursor: "pointer", fontWeight: 800, fontFamily: "var(--font-display)", fontSize: 18, minHeight: 32 }}>Income tax working</summary>
        <div style={{ marginTop: 10 }}>
          <div className="v-row v-sp v-sm" style={{ padding: "4px 0" }}>
            <span>Taxable pay per year <span className="v-xs v-muted">(base <span className="amt">{fmt(salary.base)}</span> − contributions <span className="amt">{fmt(money((pay.sss + pay.philhealth + pay.pagibig) as number))}</span> + taxable allowances) × 12 + one-time</span></span>
            <b><Money value={money((pay.regularTaxable * 12 + pay.oneTimeTaxable) as number)} /></b>
          </div>
          <div className="v-scrollx">
            <table className="v-br">
              <thead><tr><th>Bracket</th><th>Amount in it</th><th>Rate</th><th>Tax</th></tr></thead>
              <tbody>
                {working.steps.map((s) => (
                  <tr key={s.lower} className={s.hit ? "v-hit" : ""} style={s.amountIn === 0 ? { color: "var(--muted)" } : undefined}>
                    <td>{fmt(s.lower)} to {s.upper === null ? "and above" : fmt(s.upper)}</td>
                    <td className="v-num">{s.amountIn === 0 ? "—" : <Money value={s.amountIn} />}</td>
                    <td className="v-num">{s.rateBp / 100}%</td>
                    <td className="v-num">{s.amountIn === 0 ? "—" : <Money value={s.tax} />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="v-row v-sp v-sm" style={{ padding: "6px 0" }}><span>Tax for the year</span><b><Money value={working.annualTax} /></b></div>
          <div className="v-row v-sp v-sm"><span>Withheld this month (a twelfth, plus one-time tax), split across both cutoffs</span><b><Money value={pay.tax} /></b></div>
        </div>
      </details>
    </div>
  );
}

const fmt = (m: MoneyValue | number) => `₱${(Number(m) / 100).toLocaleString("en-PH", { maximumFractionDigits: 0 })}`;

function Slip({ cutoff, slip, drafts, salary, onAllowance, onChange, onMove, onRemove, onAdd }: {
  cutoff: PayCutoff; slip: Payslip; drafts: Draft[]; salary: ReturnType<typeof salaryAt>; onAllowance: (id: string, change: { cutoff?: PayCutoff; taxable?: boolean }) => void;
  onChange: (key: string, change: Partial<PayslipLineSpec>) => void; onMove: (key: string) => void; onRemove: (key: string) => void; onAdd: (spec: PayslipLineSpec) => void;
}) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [kind, setKind] = useState<"deduction" | "earning">("deduction");
  const name2 = cutoff === "first" ? "1st cutoff" : "2nd cutoff";
  const other = cutoff === "first" ? "2nd" : "1st";
  const moveLabel = cutoff === "first" ? "To 2nd →" : "← To 1st";

  const row = (i: number) => {
    const line = slip.lines[i]!;
    const d = drafts[i];
    const sign = line.kind === "deduction" ? "−" : "";
    if (d) {
      const fixed = d.spec.source === "base_share" || d.spec.source === "income_tax";
      return (
        <div key={d.key} className="v-plr">
          <div className="v-grow v-nm"><b>{line.label}</b>
            <small>
              {d.spec.source === "base_share" ? <>{(d.spec.shareBp ?? 5000) / 100}% of <span className="amt">{fmt(salary.base)}</span></> : d.spec.source === "income_tax" ? `${(d.spec.shareBp ?? 5000) / 100}% of the month's tax` : d.spec.amountOverride != null ? "your value" : d.spec.source === "custom" ? "your line" : "standard"}
            </small>
          </div>
          <div className="v-pla">
            {fixed ? <span className="v-fixedv">{sign}<Money value={line.amount} /></span> : (
              <input key={`${d.key}-${line.amount}`} className="v-v" inputMode="decimal" defaultValue={(line.amount / 100).toFixed(2)} aria-label={`${line.label} amount, ${name2}`}
                onBlur={(e) => { const v = parsePesos(e.target.value.replace(/^-/, "")); if (v !== undefined) onChange(d.key, { amountOverride: v }); }} />
            )}
          </div>
          <div className="v-acts">
            {!fixed && d.spec.amountOverride != null && d.spec.source !== "custom" ? <button type="button" className="v-btn v-sm v-ghost v-mv" onClick={() => onChange(d.key, { amountOverride: null })}>Reset</button> : null}
            {d.spec.source === "custom" ? <button type="button" className="v-iconbtn v-s" onClick={() => onRemove(d.key)} aria-label={`Remove ${line.label}`}>×</button> : null}
            {MOVABLE.has(d.spec.source) ? <button type="button" className="v-btn v-sm v-mv" onClick={() => onMove(d.key)} aria-label={`Move ${line.label} to the ${other} cutoff`}>{moveLabel}</button> : null}
          </div>
        </div>
      );
    }
    // Lines the engine adds itself: allowances, savings plan, other deduction, bonuses.
    const allowance = line.source === "allowance" ? salary.allowances.find((a) => a.allowance.name === line.label && a.allowance.payslipCutoff === cutoff)?.allowance : undefined;
    return (
      <div key={`auto-${i}`} className="v-plr">
        <div className="v-grow v-nm"><b>{line.label}</b>
          <small>{allowance ? (allowance.frequency === "yearly" ? "once a year · from Recurring allowances" : "every month · from Recurring allowances") : line.source === "bonus" || line.source === "bonus_tax" ? "from Bonuses" : line.source === "savings_plan" ? "payroll savings plan" : "your payroll setting"}</small>
          {allowance ? (
            <span className="v-tx">
              <button type="button" className="v-sw v-s" role="switch" aria-checked={allowance.taxable} aria-label={`${line.label} is taxable`} onClick={() => onAllowance(allowance.id, { taxable: !allowance.taxable })} />
              Taxable
            </span>
          ) : null}
        </div>
        <div className="v-pla"><span className="v-fixedv">{sign}<Money value={line.amount} /></span></div>
        <div className="v-acts">{allowance ? <button type="button" className="v-btn v-sm v-mv" onClick={() => onAllowance(allowance.id, { cutoff: cutoff === "first" ? "second" : "first" })}>{moveLabel}</button> : null}</div>
      </div>
    );
  };

  const idx = slip.lines.map((_, i) => i);
  const earn = idx.filter((i) => slip.lines[i]!.kind === "earning");
  const ded = idx.filter((i) => slip.lines[i]!.kind === "deduction");
  return (
    <details className="v-slip" open>
      <summary className="v-pbsum">
        <span className="v-pill v-ok">{cutoff === "first" ? "1st" : "2nd"}</span>
        <span className="v-grow"><span className="v-lbl" style={{ display: "block" }}>{cutoff === "first" ? "Paid on the 10th" : "Paid on the 25th"}</span><b className="v-disp" style={{ fontSize: 20 }}>{name2}</b></span>
        <span className="v-pbtk"><span className="v-lbl" style={{ display: "block" }}>Take-home pay</span><b className="v-num"><Money value={slip.takeHome} /></b></span>
      </summary>
      <div className="v-pl">
        <h3 className="v-pgh">Earnings</h3>
        {earn.map(row)}
        <h3 className="v-pgh">Deductions</h3>
        {ded.map(row)}
        <div className="v-addl2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="+ Add a line, e.g. Salary loan" aria-label={`New line name, ${name2}`} maxLength={60} />
          <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="₱ amount" aria-label={`New line amount, ${name2}`} />
          <select value={kind} onChange={(e) => setKind(e.target.value as "deduction" | "earning")} aria-label="Type"><option value="deduction">Deduction</option><option value="earning">Earning</option></select>
          <button type="button" className="v-btn v-sm v-pri" onClick={() => {
            const v = parsePesos(amount);
            if (!name.trim() || v === undefined || v <= 0) return;
            onAdd({ kind, label: name.trim(), source: "custom", amountOverride: v });
            setName(""); setAmount("");
          }}>Add</button>
        </div>
      </div>
    </details>
  );
}
