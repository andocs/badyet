"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { completeSetup } from "@/app/(v13)/setup/actions";
import { ACCOUNT_KINDS } from "@/lib/accounts/v13";
import { addMonths, type YearMonth } from "@/lib/domain/dates";
import { money, parsePesos } from "@/lib/domain/money";
import { buildMonthPay } from "@/lib/engine/payslip";
import { DEFAULT_ASSUMPTIONS, DEFAULT_PAY_SETTINGS } from "@/lib/engine/rows";
import { resolveSalaryTimeline } from "@/lib/engine/salary";
import { V13Icon } from "./icons";
import { Money } from "./money";
import { DayOfMonth, MonthPicker } from "./pickers";

const STEPS = ["Accounts", "Salary", "Paydays", "Budget", "Funds"];
const ord = (n: number) => `${n}${n % 10 === 1 && n !== 11 ? "st" : n % 10 === 2 && n !== 12 ? "nd" : n % 10 === 3 && n !== 13 ? "rd" : "th"}`;

interface Acct { name: string; kind: string; last4: string; balance: string }
type LineCutoff = "both" | "first" | "second";
interface Line { on: boolean; name: string; group: "Essentials" | "Wants" | "Savings"; rule: "fixed" | "pct"; cutoff: LineCutoff; value: string }
export interface ExistingNames { accounts: string[]; lines: string[]; funds: string[] }
const norm = (n: string) => n.trim().toLowerCase();
/** Indexes of names used more than once in the list, or already taken by something that exists. */
const clashes = (names: string[], existing: string[]) => {
  const taken = new Set(existing.map(norm));
  const seen = new Set<string>();
  const out = new Set<number>();
  names.forEach((n, i) => {
    const k = norm(n);
    if (k === "") return;
    if (taken.has(k) || seen.has(k)) out.add(i);
    seen.add(k);
  });
  return out;
};


/** What the lines take a month, in centavos (a percent is of each cutoff's half of the take-home). */
function monthlyOf(lines: Line[], takeHome: number): number {
  return lines.reduce((t, l) => {
    const times = l.cutoff === "both" ? 2 : 1;
    if (l.rule === "fixed") return t + (parsePesos(l.value) ?? 0) * times;
    return t + Math.round(((takeHome / 2) * (Number(l.value) || 0) * times) / 100);
  }, 0);
}

const pesos = (centavos: number) => `₱${Math.round(centavos / 100).toLocaleString("en-PH")}`;

/** One line under each budget line saying plainly how much comes out of which cutoff. */
function lineNote(l: Line, takeHome: number | null): string {
  const where = l.cutoff === "both" ? "each cutoff" : l.cutoff === "first" ? "the 1st cutoff only" : "the 2nd cutoff only";
  const times = l.cutoff === "both" ? 2 : 1;
  if (l.rule === "fixed") {
    const v = parsePesos(l.value);
    if (v === undefined || v === 0) return `A fixed amount, taken from ${where}.`;
    return `${pesos(v)} from ${where}${times === 2 ? `, ${pesos(v * 2)} a month` : ""}.`;
  }
  const n = Number(l.value) || 0;
  const month = takeHome ? `, about ${pesos((takeHome / 2) * (n / 100) * times)} a month` : "";
  return `${n}% of ${l.cutoff === "both" ? "each cutoff's" : "that cutoff's"} take-home${month}, from ${where}.`;
}

/** First run, five skippable steps, with the setup so far worked out beside the form by the same engine the app uses. */
export function SetupWizard({ thisMonth, rerun, existing }: { thisMonth: YearMonth; rerun: boolean; existing: ExistingNames }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [skipped, setSkipped] = useState<Set<number>>(new Set());
  const [accts, setAccts] = useState<Acct[]>([{ name: "", kind: "ewallet", last4: "", balance: "" }]);
  const [base, setBase] = useState("");
  const [start, setStart] = useState<YearMonth>(thisMonth);
  const [title, setTitle] = useState("");
  const [grade, setGrade] = useState("");
  const [sss, setSss] = useState("");
  const [pagibig, setPagibig] = useState("");
  const [p1, setP1] = useState(10);
  const [p2, setP2] = useState(25);
  const [lines, setLines] = useState<Line[]>([]);
  const [emergency, setEmergency] = useState(true);
  const [travel, setTravel] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, startT] = useTransition();

  const baseV = parsePesos(base);
  const sssV = parsePesos(sss);
  const piV = parsePesos(pagibig);
  const filled = accts.filter((a) => a.name.trim() !== "");
  const total = filled.reduce((t, a) => t + (parsePesos(a.balance) ?? 0), 0);

  const take = useMemo(() => {
    if (baseV === undefined || baseV <= 0) return null;
    const salary = resolveSalaryTimeline([{ id: "s", effectiveMonth: start, kind: "start", newBase: baseV, status: "confirmed" }], [], DEFAULT_ASSUMPTIONS, [start], { includeExpected: true })[0]!;
    return buildMonthPay(salary, { ...DEFAULT_PAY_SETTINGS, sssOverride: sssV ?? null, pagibigOverride: piV ?? null }, []);
  }, [baseV, start, sssV, piV]);

  const active = lines.filter((l) => l.on);
  const left = take ? take.takeHome - monthlyOf(active, take.takeHome) : null;
  const acctClash = clashes(accts.map((a) => a.name), existing.accounts);
  const lineClash = clashes(lines.map((l) => l.name), existing.lines);
  const fundClash = [emergency && existing.funds.some((n) => norm(n) === "emergency fund"), travel && existing.funds.some((n) => norm(n) === "travel")];
  const blocked = (step === 0 && !skipped.has(0) && acctClash.size > 0) || (step === 3 && !skipped.has(3) && lineClash.size > 0);

  const payload = () => ({
    accounts: skipped.has(0) ? [] : filled.map((a) => ({ name: a.name, kind: a.kind, last4: a.last4, opening: a.balance })),
    salary: skipped.has(1) || baseV === undefined || baseV <= 0 ? null : { base: baseV, startMonth: start, title: title || null, grade: grade || null, sss: sssV ?? null, pagibig: piV ?? null },
    paydays: skipped.has(2) ? null : { first: p1, second: p2 },
    lines: skipped.has(3) ? null : active.map((l) => ({ name: l.name, group: l.group, rule: l.rule, amount: l.rule === "fixed" ? (parsePesos(l.value) ?? 0) : null, pctBp: l.rule === "pct" ? Math.round((Number(l.value) || 0) * 100) : null, cutoff: l.cutoff })),
    funds: skipped.has(4) ? null : { emergency, travel },
  });
  const finish = () => {
    setError(null);
    startT(async () => {
      const r = await completeSetup(payload());
      if (r.error) setError(r.error);
      else router.push("/");
    });
  };
  const skip = () => { setSkipped((s) => new Set(s).add(step)); setStep(step + 1); };
  const addLine = () => setLines((x) => [...x, { on: true, name: "", group: "Wants", rule: "pct", cutoff: "both", value: "" }]);
  const next = () => { setSkipped((s) => { const n = new Set(s); n.delete(step); return n; }); setStep(step + 1); };
  const setLine = (i: number, c: Partial<Line>) => setLines((x) => x.map((l, j) => (j === i ? { ...l, ...c } : l)));

  return (
    <main className="v-main">
      <div className="v-stack v-l">
        <div className="v-row v-sp v-wrap">
          <div>
            <h1>{rerun ? "Setup wizard" : "Let's set you up"}</h1>
            <ol className="v-steps" aria-label="Steps">
              {STEPS.map((s, i) => (
                <li key={s} aria-current={i === step ? "step" : undefined} className={i < step ? "v-done" : ""}><span className="v-st"><b>{i + 1}</b><span className="v-tx">{s}</span></span></li>
              ))}
            </ol>
          </div>
          <Link className="v-btn" href={rerun ? "/settings" : "/"}>{rerun ? "Close" : "Skip all"}</Link>
        </div>
        {rerun ? <div className="v-note"><b>Running it again adds to what you have.</b> New accounts and budget lines are added; your starting salary and paydays are updated; funds are added after the ones you have.</div> : null}

        <div className="v-wzgrid">
          <div className="v-card v-wzcard">
            {step === 0 ? (
              <>
                <h2>Where does your money live?</h2>
                <p className="v-muted">Add the accounts you use. Each balance becomes the first anchor, as of today. Last four digits only, never a full number.</p>
                {accts.map((a, i) => (
                  <div key={i} className="v-rowf">
                    <label className="v-field">Name<input value={a.name} maxLength={30} aria-invalid={acctClash.has(i)} onChange={(e) => setAccts((x) => x.map((y, j) => (j === i ? { ...y, name: e.target.value } : y)))} />{acctClash.has(i) ? <span className="v-flag v-bad" role="alert">You already have an account called {a.name.trim()}.</span> : null}</label>
                    <label className="v-field">Type<select value={a.kind} onChange={(e) => setAccts((x) => x.map((y, j) => (j === i ? { ...y, kind: e.target.value } : y)))}>{ACCOUNT_KINDS.map((k) => <option key={k} value={k}>{k === "ewallet" ? "e-wallet" : k}</option>)}</select></label>
                    <label className="v-field">Last 4<input value={a.last4} maxLength={4} inputMode="numeric" onChange={(e) => setAccts((x) => x.map((y, j) => (j === i ? { ...y, last4: e.target.value } : y)))} /></label>
                    <label className="v-field">{a.kind === "credit" ? "You owe today (₱)" : "Balance today (₱)"}<input value={a.balance} inputMode="decimal" onChange={(e) => setAccts((x) => x.map((y, j) => (j === i ? { ...y, balance: e.target.value } : y)))} /></label>
                    <button type="button" className="v-iconbtn v-s v-rm" aria-label={`Remove ${a.name || "account"}`} onClick={() => setAccts((x) => x.filter((_, j) => j !== i))}>×</button>
                  </div>
                ))}
                <button type="button" className="v-btn v-sm" style={{ marginTop: 12 }} onClick={() => setAccts((x) => [...x, { name: "", kind: "ewallet", last4: "", balance: "" }])}>+ Add an account</button>
              </>
            ) : null}

            {step === 1 ? (
              <>
                <h2>What do you earn?</h2>
                <p className="v-muted">Base pay per month before deductions. This creates your starting salary.</p>
                <div className="v-frm">
                  <div className="v-two">
                    <label className="v-field">Base per month (₱)<input value={base} inputMode="decimal" onChange={(e) => setBase(e.target.value)} placeholder="58,000" /></label>
                    <div className="v-field">Starting from<MonthPicker label="Starting from" value={start} min={addMonths(thisMonth, -60)} max={addMonths(thisMonth, 24)} onChange={(v) => v && setStart(v)} /></div>
                  </div>
                  <div className="v-two">
                    <label className="v-field">Job title (optional)<input value={title} maxLength={60} onChange={(e) => setTitle(e.target.value)} /></label>
                    <label className="v-field">Grade (optional)<input value={grade} maxLength={30} onChange={(e) => setGrade(e.target.value)} /></label>
                  </div>
                  <div className="v-two">
                    <label className="v-field">SSS per month (₱, leave empty for the official table)<input value={sss} inputMode="decimal" onChange={(e) => setSss(e.target.value)} placeholder="From the SSS table" /></label>
                    <label className="v-field">Pag-IBIG per month (₱, leave empty for the official rate)<input value={pagibig} inputMode="decimal" onChange={(e) => setPagibig(e.target.value)} placeholder="2% up to ₱200" /></label>
                  </div>
                  <div className="v-note"><b>Your payslips differ between the 10th and the 25th?</b> You can place income tax, contributions and allowances on each cutoff in the payslip builder after setup. Raises and bonuses are added later from Salary and tax and Bonuses.</div>
                </div>
              </>
            ) : null}

            {step === 2 ? (
              <>
                <h2>When do you get paid?</h2>
                <p className="v-muted">Cutoffs run payday to payday. The usual twice-a-month pattern is filled in.</p>
                <div className="v-frm">
                  <div className="v-two">
                    <div className="v-field">First payday<DayOfMonth label="First payday" value={p1} min={1} max={27} onChange={setP1} /></div>
                    <div className="v-field">Second payday<DayOfMonth label="Second payday" value={p2} min={2} max={28} onChange={setP2} /></div>
                  </div>
                  <div className="v-pre" aria-live="polite">Paid the {ord(p1)} covers the {ord(p1 + 1)} to the {ord(p2 - 1)}. Paid the {ord(p2)} covers the {ord(p2)} to the {ord(p1)} of next month.</div>
                </div>
              </>
            ) : null}

            {step === 3 ? (
              <>
                <h2>How do you split your pay?</h2>
                <p className="v-muted">Add the lines you budget for, in Essentials, Wants or Savings (for example Rent, Groceries, Eating out). Choose whether each one comes out of both cutoffs or only one. A &quot;Whatever is left&quot; line is added for the rest.</p>
                {lines.map((l, i) => (
                  <div key={i} className={`v-ln2 ${l.on ? "" : "v-off2"}`}>
                    <button type="button" className="v-chk" role="checkbox" aria-checked={l.on} aria-label={`Use ${l.name || "this line"}`} onClick={() => setLine(i, { on: !l.on })}><V13Icon name="check" /></button>
                    <input value={l.name} maxLength={60} placeholder="Line name" aria-invalid={lineClash.has(i)} onChange={(e) => setLine(i, { name: e.target.value })} aria-label="Line name" />
                    <div className="v-ln2s">
                      <select value={l.rule} onChange={(e) => setLine(i, { rule: e.target.value as Line["rule"] })} aria-label={`Rule for ${l.name}`}><option value="pct">% of pay</option><option value="fixed">Fixed ₱</option></select>
                      <input value={l.value} inputMode="decimal" onChange={(e) => setLine(i, { value: e.target.value })} aria-label={`${l.rule === "pct" ? "Percent" : "Amount"} for ${l.name}`} />
                      <select value={l.group} onChange={(e) => setLine(i, { group: e.target.value as Line["group"] })} aria-label={`Group for ${l.name}`}><option>Essentials</option><option>Wants</option><option>Savings</option></select>
                      <select value={l.cutoff} onChange={(e) => setLine(i, { cutoff: e.target.value as LineCutoff })} aria-label={`Cutoff for ${l.name}`}><option value="both">Each cutoff</option><option value="first">1st cutoff only</option><option value="second">2nd cutoff only</option></select>
                    </div>
                    <p className="v-xs v-muted" style={{ margin: "2px 0 0", flexBasis: "100%" }}>{lineNote(l, take?.takeHome ?? null)}</p>
                    {lineClash.has(i) ? <p className="v-flag v-bad" role="alert" style={{ flexBasis: "100%", margin: 0 }}>You already have a budget line called {l.name.trim()}.</p> : null}
                  </div>
                ))}
                <button type="button" className="v-btn v-sm" style={{ marginTop: 12 }} onClick={addLine}>+ Add a line</button>
              </>
            ) : null}

            {step === 4 ? (
              <>
                <h2>Where should savings go?</h2>
                <p className="v-muted">Pick a starter set, or none. Caps and account links come later on the Funds page.</p>
                <div className="v-stack">
                  <button type="button" className="v-fundopt" role="checkbox" aria-checked={emergency} onClick={() => setEmergency(!emergency)}><span className="v-chk" aria-hidden="true"><V13Icon name="check" /></span><span><b>Emergency fund</b><span className="v-xs v-muted" style={{ display: "block" }}>Fills in ₱100,000 steps.</span></span></button>
                  <button type="button" className="v-fundopt" role="checkbox" aria-checked={travel} onClick={() => setTravel(!travel)}><span className="v-chk" aria-hidden="true"><V13Icon name="check" /></span><span><b>Travel</b><span className="v-xs v-muted" style={{ display: "block" }}>Fills to ₱50,000 and starts again every January.</span></span></button>
                  {fundClash[0] || fundClash[1] ? <p className="v-flag v-bad" role="alert">You already have {fundClash[0] && fundClash[1] ? "an Emergency fund and a Travel fund" : fundClash[0] ? "an Emergency fund" : "a Travel fund"}. Untick {fundClash[0] && fundClash[1] ? "them" : "it"} to continue.</p> : null}
                  {error ? <p className="v-flag v-bad" role="alert">{error}</p> : null}
                  <div className="v-row v-wrap" style={{ gap: 10 }}>
                    <button type="button" className="v-btn v-pri" disabled={busy || fundClash[0] || fundClash[1]} onClick={finish}>{busy ? "Saving…" : "Finish setup"}</button>
                    <button type="button" className="v-btn" onClick={() => setStep(3)}>Back</button>
                  </div>
                  <p className="v-xs v-muted" style={{ margin: 0 }}>You will land on Now. It will be honest and empty until you add an expense.</p>
                </div>
              </>
            ) : null}

            {step < 4 ? (
              <div className="v-wzfoot">
                {step > 0 ? <button type="button" className="v-btn" onClick={() => setStep(step - 1)}>Back</button> : null}
                <span className="v-gap" />
                <button type="button" className="v-btn v-ghost" onClick={skip}>Skip</button>
                <button type="button" className="v-btn v-pri" onClick={next} disabled={blocked || (step === 1 && (baseV === undefined || baseV <= 0))}>Next</button>
              </div>
            ) : null}
          </div>

          <aside className="v-wzslip" aria-label="Your setup so far">
            <div className="v-slip">
              <div className="v-hd"><div><div className="v-lbl">Your setup so far</div><div className="v-disp" style={{ fontSize: 22 }}>{take ? <><Money value={money(Math.round(take.takeHome / 2))} /> a cutoff</> : "Just getting started"}</div></div></div>
              <div className="v-sec"><h3>Accounts</h3><div className="v-ln"><span>{filled.length} account{filled.length === 1 ? "" : "s"}</span><span className="v-num"><Money value={money(total)} /></span></div></div>
              {take ? (
                <div className="v-sec"><h3>Salary</h3>
                  <div className="v-ln"><span>Base per month</span><span className="v-num"><Money value={money(baseV ?? 0)} /></span></div>
                  <div className="v-ln"><span>SSS, PhilHealth, Pag-IBIG</span><span className="v-num">−<Money value={money(take.sss + take.philhealth + take.pagibig)} /></span></div>
                  <div className="v-ln"><span>Income tax</span><span className="v-num">−<Money value={take.tax} /></span></div>
                  <div className="v-ln v-t"><span>Take-home a month</span><span className="v-num"><Money value={take.takeHome} /></span></div>
                </div>
              ) : null}
              {step >= 2 ? <div className="v-sec"><h3>Paydays</h3><div className="v-ln"><span>The {ord(p1)} and the {ord(p2)}</span>{take ? <span className="v-num"><Money value={money(Math.round(take.takeHome / 2))} /> each</span> : null}</div></div> : null}
              {step >= 3 && take && left !== null ? (
                <div className="v-sec"><h3>Budget</h3>
                  <div className="v-ln"><span>{active.length} lines a month</span><span className="v-num"><Money value={money(take.takeHome - left)} /></span></div>
                  <div className="v-ln v-t"><span className={left < 0 ? "v-neg" : "v-pos"}>Whatever is left</span><span className={`v-num ${left < 0 ? "v-neg" : "v-pos"}`}><Money value={money(left)} /></span></div>
                </div>
              ) : null}
              <div className="v-net"><div><div className="v-lbl" style={{ color: "var(--accent-text)" }}>Skip anything</div><div className="v-xs v-muted">Settings can re-run any step.</div></div><span className="v-pip" style={{ width: 40, height: 40 }} aria-hidden="true" /></div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
