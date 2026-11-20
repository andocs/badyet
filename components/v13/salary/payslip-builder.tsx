"use client";

import { useMemo, useState, useTransition } from "react";
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

  const templates = useMemo<PayslipTemplate[]>(
    () => [
      { cutoff: "first", effectiveMonth: month, lines: drafts.first.map((d) => d.spec) },
      { cutoff: "second", effectiveMonth: month, lines: drafts.second.map((d) => d.spec) },
    ],
    [drafts, month],
  );
  const salary = useMemo(() => salaryAt(input, month), [input, month]);
  const bonuses = useMemo(() => planBonuses(input.bonusRules, input.bonusInstances, (m) => salaryAt(input, m), input.settings, input.assumptions, [month]), [input, month]);
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

  return (
    <div className="v-stack">
      <div className="v-row v-sp v-wrap">
        <div>
          <h2>Payslip builder</h2>
          <div className="v-lbl">Build each cutoff&apos;s payslip once. Regular lines repeat every month; bonuses appear in the month they land.</div>
        </div>
        <div className="v-row v-wrap" style={{ gap: 10 }}>
          <label className="v-row" style={{ gap: 8 }}>
            <span className="v-lbl">Month</span>
            <select className="v-lbl-in" value={month} onChange={(e) => (window.location.search = `?tab=payslip&month=${e.target.value}`)} aria-label="Month">
              {months.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </label>
          <span className="v-pill v-ok">Month total <Money value={pay.takeHome} /></span>
        </div>
      </div>

      <div className="v-row v-wrap" style={{ gap: 16 }}>
        <label className="v-row" style={{ gap: 8 }}>
          <span className="v-sm v-muted">Base pay in 1st cutoff</span>
          <input className="v-lbl-in" style={{ width: 76, minHeight: 40, textAlign: "right" }} inputMode="decimal" defaultValue={shareOf("first", "base_share") / 100} key={`b${shareOf("first", "base_share")}`} onBlur={(e) => setSplit("base_share", Number(e.target.value) || 0)} aria-label="Percent of base paid in the 1st cutoff" />
          <span className="v-sm v-muted">%</span>
        </label>
        <label className="v-row" style={{ gap: 8 }}>
          <span className="v-sm v-muted">Income tax in 1st cutoff</span>
          <input className="v-lbl-in" style={{ width: 76, minHeight: 40, textAlign: "right" }} inputMode="decimal" defaultValue={shareOf("first", "income_tax") / 100} key={`t${shareOf("first", "income_tax")}`} onBlur={(e) => setSplit("income_tax", Number(e.target.value) || 0)} aria-label="Percent of income tax withheld in the 1st cutoff" />
          <span className="v-sm v-muted">%</span>
        </label>
        <button type="button" className="v-btn v-sm" onClick={reset} disabled={busy}>Standard layout</button>
        <button type="button" className="v-btn v-sm v-pri" onClick={save} disabled={busy}>Save from this month on</button>
      </div>
      {error ? <p className="v-flag v-bad" role="alert">{error}</p> : null}
      {note ? <p className="v-flag" role="status" style={{ background: "var(--tint)", color: "var(--accent-text)" }}>{note}</p> : null}

      <div className="v-pair2">
        {(["first", "second"] as const).map((c) => (
          <Slip key={c} cutoff={c} slip={pay[c]} drafts={drafts[c]} salary={salary} onChange={(k, ch) => update(c, k, ch)} onMove={(k) => move(c, k)} onRemove={(k) => remove(c, k)} onAdd={(spec) => add(c, spec)} busy={busy} />
        ))}
      </div>

      <details className="v-card">
        <summary style={{ cursor: "pointer", fontWeight: 800, fontFamily: "var(--font-display)", fontSize: 18, minHeight: 32 }}>Income tax working</summary>
        <div style={{ marginTop: 10 }}>
          <div className="v-row v-sp v-sm" style={{ padding: "4px 0" }}>
            <span>Taxable pay per year <span className="v-xs v-muted">(base {fmt(salary.base)} − contributions {fmt(money((pay.sss + pay.philhealth + pay.pagibig) as number))} + taxable allowances) × 12 + one-time</span></span>
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

function Slip({ cutoff, slip, drafts, salary, onChange, onMove, onRemove, onAdd, busy }: {
  cutoff: PayCutoff; slip: Payslip; drafts: Draft[]; salary: ReturnType<typeof salaryAt>;
  onChange: (key: string, change: Partial<PayslipLineSpec>) => void; onMove: (key: string) => void; onRemove: (key: string) => void; onAdd: (spec: PayslipLineSpec) => void; busy: boolean;
}) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [kind, setKind] = useState<"deduction" | "earning">("deduction");
  const name2 = cutoff === "first" ? "1st cutoff" : "2nd cutoff";
  const other = cutoff === "first" ? "2nd" : "1st";

  const row = (i: number) => {
    const line = slip.lines[i]!;
    const d = drafts[i];
    const sign = line.kind === "deduction" ? "−" : "";
    if (d) {
      const fixed = d.spec.source === "base_share" || d.spec.source === "income_tax";
      return (
        <tr key={d.key}>
          <td className="v-nm"><b>{line.label}</b>
            <small>
              {d.spec.source === "base_share" ? `${(d.spec.shareBp ?? 5000) / 100}% of ${fmt(salary.base)}` : d.spec.source === "income_tax" ? `${(d.spec.shareBp ?? 5000) / 100}% of the month's tax` : d.spec.amountOverride != null ? "your value" : d.spec.source === "custom" ? "your line" : "standard"}
            </small>
          </td>
          <td>
            {fixed ? <span className="v-fixedv">{sign}<Money value={line.amount} /></span> : (
              <input key={`${d.key}-${line.amount}`} className="v-v" inputMode="decimal" defaultValue={(line.amount / 100).toFixed(2)} aria-label={`${line.label} amount, ${name2}`}
                onBlur={(e) => { const v = parsePesos(e.target.value.replace(/^-/, "")); if (v !== undefined) onChange(d.key, { amountOverride: v }); }} />
            )}
          </td>
          <td>
            <div className="v-acts">
              {!fixed && d.spec.amountOverride != null && d.spec.source !== "custom" ? <button type="button" className="v-btn v-sm v-ghost v-mv" onClick={() => onChange(d.key, { amountOverride: null })}>Reset</button> : null}
              {d.spec.source === "custom" ? <button type="button" className="v-iconbtn v-s" onClick={() => onRemove(d.key)} aria-label={`Remove ${line.label}`}>×</button> : null}
              {MOVABLE.has(d.spec.source) ? <button type="button" className="v-btn v-sm v-mv" onClick={() => onMove(d.key)} aria-label={`Move ${line.label} to the ${other} cutoff`}>{cutoff === "first" ? "To 2nd →" : "← To 1st"}</button> : null}
            </div>
          </td>
        </tr>
      );
    }
    // Lines the engine adds itself: allowances, savings plan, other deduction, bonuses.
    const allowance = line.source === "allowance" ? salary.allowances.find((a) => a.allowance.name === line.label && a.allowance.payslipCutoff === cutoff)?.allowance : undefined;
    return (
      <tr key={`auto-${i}`}>
        <td className="v-nm"><b>{line.label}</b>
          <small>{allowance ? (allowance.frequency === "yearly" ? "once a year · from Recurring allowances" : "every month · from Recurring allowances") : line.source === "bonus" || line.source === "bonus_tax" ? "from Bonuses" : line.source === "savings_plan" ? "payroll savings plan" : "your payroll setting"}</small>
          {allowance ? (
            <span className="v-tx">
              <button type="button" className="v-sw v-s" role="switch" aria-checked={allowance.taxable} aria-label={`${line.label} is taxable`} disabled={busy} onClick={() => setAllowance(allowance.id, { taxable: !allowance.taxable })} />
              Taxable
            </span>
          ) : null}
        </td>
        <td><span className="v-fixedv">{sign}<Money value={line.amount} /></span></td>
        <td><div className="v-acts">{allowance ? <button type="button" className="v-btn v-sm v-mv" disabled={busy} onClick={() => setAllowance(allowance.id, { cutoff: cutoff === "first" ? "second" : "first" })}>{cutoff === "first" ? "To 2nd →" : "← To 1st"}</button> : null}</div></td>
      </tr>
    );
  };

  const idx = slip.lines.map((_, i) => i);
  const earn = idx.filter((i) => slip.lines[i]!.kind === "earning");
  const ded = idx.filter((i) => slip.lines[i]!.kind === "deduction");
  return (
    <div className="v-slip">
      <div className="v-hd">
        <div><div className="v-lbl">{cutoff === "first" ? "Paid on the 10th" : "Paid on the 25th"}</div><div className="v-disp" style={{ fontSize: 22 }}>{name2}</div></div>
        <div style={{ textAlign: "right" }}><div className="v-lbl">Take-home</div><div className="v-num" style={{ font: "800 22px var(--font-display)", color: "var(--accent-text)" }}><Money value={slip.takeHome} /></div></div>
      </div>
      <div className="v-scrollx">
        <table className="v-pt">
          <thead><tr><th style={{ textAlign: "left" }}>Item</th><th>Amount</th><th /></tr></thead>
          <tbody>
            <tr className="v-grp"><td colSpan={3}>Earnings</td></tr>
            {earn.map(row)}
            <tr className="v-grp"><td colSpan={3}>Deductions</td></tr>
            {ded.map(row)}
            <tr className="v-addr"><td colSpan={3}>
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
            </td></tr>
          </tbody>
        </table>
      </div>
      <div className="v-net"><div><div className="v-lbl" style={{ color: "var(--accent-text)" }}>Net for the {name2}</div><div className="v-xs v-muted">{slip.lines.length} lines</div></div><b className="v-n v-num"><Money value={slip.takeHome} /></b></div>
    </div>
  );
}
