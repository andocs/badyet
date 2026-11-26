"use client";

import { useRef, useState, useTransition } from "react";
import { deleteLine, markReimbursement, saveLine } from "@/app/(v13)/budget/actions";
import { money, parsePesos } from "@/lib/domain/money";
import { applyMoves, type Move } from "@/lib/budget/moves";
import type { ReimbursementStatus } from "@/lib/budget/reimburse";
import { withPayroll, type PayrollRow } from "@/lib/budget/payroll";
import { cutoffText, groupsForCutoff, ruleText, type GroupView, type LineView } from "@/lib/budget/view";
import { useConfirm, useToast } from "../feedback";
import { MonthPicker } from "../pickers";
import { Money } from "../money";
import { V13Icon } from "../icons";

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const ymLabel = (m: string) => `${MON[Number(m.slice(5)) - 1]} ${m.slice(0, 4)}`;

interface Option { id: string; name: string }
interface Draft {
  id?: string;
  name: string;
  categoryId: string;
  rule: "fixed" | "pct" | "rest";
  value: string;
  /** The 2nd cutoff's amount (fixed line on both cutoffs); empty = the same as the first. */
  valueSecond: string;
  /** Reimbursement: how much comes back each month, which cutoff it lands in, and the day. */
  rbAmount: string;
  rbCutoff: "first" | "second";
  rbDay: string;
  cutoff: "first" | "second" | "both";
  accountId: string;
  startsOn: string;
  endsOn: string;
  isDraft: boolean;
  daily: boolean;
  tick: "none" | "rto" | "rto_contingency";
}

const blank = (categoryId: string): Draft => ({ name: "", categoryId, rule: "fixed", value: "", valueSecond: "", rbAmount: "", rbCutoff: "first", rbDay: "", cutoff: "both", accountId: "", startsOn: "", endsOn: "", isDraft: false, daily: false, tick: "none" });
const draftOf = (l: LineView): Draft => ({
  id: l.id,
  name: l.name,
  categoryId: l.categoryId,
  rule: l.rule,
  value: l.rule === "pct" ? String((l.pctBp ?? 0) / 100) : l.rule === "fixed" && l.fixed !== null ? (l.fixed / 100).toFixed(2) : "",
  valueSecond: l.fixedSecond !== null ? (l.fixedSecond / 100).toFixed(2) : "",
  rbAmount: l.reimburse ? (l.reimburse.amount / 100).toFixed(2) : "",
  rbCutoff: l.reimburse?.cutoff ?? "first",
  rbDay: l.reimburse?.day ? String(l.reimburse.day) : "",
  cutoff: l.cutoff,
  accountId: l.accountId ?? "",
  startsOn: l.startsOn ?? "",
  endsOn: l.endsOn ?? "",
  isDraft: l.isDraft,
  daily: l.countsToDaily,
  tick: l.kind === "rto" ? "rto" : l.kind === "rto_contingency" ? "rto_contingency" : "none",
});

/** The budget lines by group, and the editor sheet. Tap a line to edit it. */
export function BudgetBoard({ groups: monthGroups, colors, categories, accounts, showSpent, takeHome, cutoff = null, cutoffTakeHome = 0, planId = null, payroll = {}, moves = [], reimbursements = [] }: { /** This month's reimbursements, when this month is shown. */ reimbursements?: ReimbursementStatus[] } & { /** Office-day money moved this month. */ moves?: Move[] } & { /** Payslip deductions shown under the budget category they are set to, by category id. */ payroll?: Record<string, PayrollRow[]>; groups: GroupView[]; colors: string[]; categories: (Option & { groupId: string })[]; accounts: Option[]; showSpent: boolean; takeHome: number; cutoff?: "first" | "second" | null; cutoffTakeHome?: number; planId?: string | null }) {
  // One cutoff's view: each line at its amount in that cutoff, lines with nothing in it left out, totals and shares of that cutoff's take-home.
  const [marking, startMark] = useTransition();
  const mark = (input: { lineId: string; month: string; cutoff: "first" | "second"; received: boolean; postponed: boolean }) =>
    startMark(async () => {
      const r = await markReimbursement(input);
      if (r.error) toast(r.error, "bad");
    });
  const moved = applyMoves(cutoff ? groupsForCutoff(monthGroups, cutoff, cutoffTakeHome) : monthGroups, moves, cutoff);
  const groups: GroupView[] = withPayroll(moved.groups, payroll, cutoff ? cutoffTakeHome : takeHome, cutoff);
  const dialog = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const ask = useConfirm();
  const toast = useToast();
  const thisYear = new Date().getFullYear();
  const set = (c: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...c } : d));

  const open = (d: Draft) => {
    setError(null);
    setDraft(d);
    dialog.current?.showModal();
  };
  const close = () => dialog.current?.close();

  const preview = (() => {
    if (!draft) return null;
    if (draft.rule === "rest") return "Takes whatever the other lines leave.";
    if (draft.rule === "fixed") {
      const v = parsePesos(draft.value);
      if (v === undefined) return "Enter an amount.";
      const w = draft.cutoff === "both" && draft.valueSecond.trim() !== "" ? parsePesos(draft.valueSecond) : undefined;
      if (draft.cutoff === "both" && w !== undefined) return <><b><Money value={money(v + w)} /> a month</b>: <Money value={money(v)} /> in the 1st cutoff, <Money value={money(w)} /> in the 2nd.</>;
      return draft.cutoff === "both" ? <><b><Money value={money(v * 2)} /> a month</b>: <Money value={money(v)} /> from each cutoff. Never changes unless you edit it.</> : "Never changes unless you edit it.";
    }
    const pct = Number(draft.value);
    return Number.isFinite(pct) ? (
      <>
        <b><Money value={money(Math.round((takeHome * pct) / 100))} /> a month</b> at this month&apos;s take-home. It follows take-home as it grows.
      </>
    ) : "Enter a percent.";
  })();

  const save = () => {
    if (!draft) return;
    setError(null);
    const pct = Number(draft.value);
    const amount = parsePesos(draft.value);
    if (draft.rule === "fixed" && amount === undefined) return setError("Enter the amount per month, like 1,250.50.");
    if (draft.rule === "pct" && (!Number.isFinite(pct) || pct < 0 || pct > 100)) return setError("A percent line takes 0 to 100%.");
    const second = draft.valueSecond.trim() === "" ? null : parsePesos(draft.valueSecond);
    if (second === undefined) return setError("Enter the 2nd cutoff's amount, like 10,000, or leave it empty to use the same amount.");
    const rb = draft.rbAmount.trim() === "" ? null : parsePesos(draft.rbAmount);
    if (rb === undefined) return setError("Enter how much is reimbursed each month, like 2,099.");
    const rbDay = draft.rbDay.trim() === "" ? null : Number(draft.rbDay);
    if (rbDay !== null && (!Number.isInteger(rbDay) || rbDay < 1 || rbDay > 31)) return setError("The deposit day is 1 to 31.");
    start(async () => {
      const r = await saveLine({
        planId,
        id: draft.id,
        name: draft.name,
        categoryId: draft.categoryId,
        rule: draft.rule,
        amount: draft.rule === "fixed" ? (amount ?? null) : null,
        amountSecond: draft.rule === "fixed" && draft.cutoff === "both" ? second : null,
        reimburse: rb !== null && rb > 0 ? { amount: rb, cutoff: draft.rbCutoff, day: rbDay } : null,
        pctBp: draft.rule === "pct" ? Math.round(pct * 100) : null,
        cutoff: draft.cutoff,
        accountId: draft.accountId || null,
        startsOn: draft.startsOn || null,
        endsOn: draft.endsOn || null,
        isDraft: draft.isDraft,
        countsToDaily: draft.daily,
        kind: draft.rule === "rest" ? "normal" : draft.tick === "none" ? "normal" : draft.tick,
      });
      if (r.error) setError(r.error);
      else { close(); toast("Line saved."); }
    });
  };
  const remove = async () => {
    if (!draft?.id) return;
    if (!(await ask({ title: "Delete this line?", message: "Its raise top-ups go with it. Past spending stays.", confirmLabel: "Delete", danger: true }))) return;
    start(async () => {
      const r = await deleteLine(draft.id!);
      if (r.error) setError(r.error);
      else { close(); toast("Line deleted."); }
    });
  };

  return (
    <>
      {groups.map((g, gi) => {
        const color = colors[gi % colors.length]!;
        const first = categories.find((c) => c.groupId === g.id);
        return (
          <section key={g.id} className="v-card v-grp" style={{ "--g": color } as React.CSSProperties} aria-label={g.name}>
            <header className="v-gh">
              <div className="v-row v-sp"><h2><i className="v-dot" style={{ background: color }} />{g.name}</h2><b className="v-num v-big2"><Money value={g.total} /></b></div>
              <div className="v-bar" role="img" aria-label={`${Math.round(g.share)} percent of take-home`}><i style={{ width: `${g.share}%`, background: color }} /></div>
              <div className="v-row v-sp v-xs v-muted"><span>{Math.round(g.share)}% of {cutoff ? "the cutoff's " : ""}take-home · {g.lines.filter((l) => l.amount !== null).length} lines</span>{showSpent ? <span className="v-num"><Money value={g.spentTotal} /> sent or spent so far</span> : null}</div>
            </header>
            <div className="v-blh" aria-hidden="true"><span>Line</span><span>Rule</span><span>Cutoff</span><span style={{ textAlign: "right" }}>{cutoff === "first" ? "1st cutoff" : cutoff === "second" ? "2nd cutoff" : "This month"}</span></div>
            {g.lines.map((l) => {
              const pc = showSpent && l.spent && l.amount ? Math.min(100, (l.spent.amount / l.amount) * 100) : 0;
              return (
                <div key={l.id} className="v-bl" role="button" tabIndex={0} onClick={() => open(draftOf(l))} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && open(draftOf(l))} aria-label={`Edit ${l.name}`}>
                  <span className="v-bn">
                    <i className="v-dot" style={{ background: color }} />
                    <span>
                      <b>{l.name}</b>
                      <small>{l.categoryName}{l.accountName ? ` → ${l.accountName}` : ""}</small>
                      {l.topUps.length > 0 ? <span className="v-pill v-ok">+<Money value={money(l.topUps.reduce((t, x) => t + x.amount, 0))} /> from a raise</span> : null}
                      {l.startsOn ? <span className="v-pill v-warn">starts {ymLabel(l.startsOn)}</span> : null}
                      {l.endsOn ? <span className="v-pill v-warn">ends {ymLabel(l.endsOn)}</span> : null}
                      {l.isDraft ? <span className="v-pill v-est">draft</span> : null}
                      {l.kind === "rto" ? <span className="v-pill">RTO day</span> : l.kind === "rto_contingency" ? <span className="v-pill">RTO contingency</span> : null}
                      {l.countsToDaily ? <span className="v-pill">daily</span> : null}
                    </span>
                  </span>
                  <span className="v-br"><span className="v-pill v-rl">{ruleText(l)}</span></span>
                  <span className="v-bcut">
                    <span className="v-cutp" role="img" aria-label={cutoffText(l.cutoff)}>
                      <i className={l.cutoff !== "second" ? "v-on" : ""}>1</i><i className={l.cutoff !== "first" ? "v-on" : ""}>2</i>
                    </span>
                  </span>
                  <span className="v-ba">
                    <b className="v-num">{l.amount === null ? "—" : <Money value={l.amount} />}</b>
                    {!cutoff && l.perCutoff && l.cutoff === "both" && l.perCutoff.first !== l.perCutoff.second ? <small className="v-num">1st <Money value={l.perCutoff.first} /> · 2nd <Money value={l.perCutoff.second} /></small> : null}
                    {(moved.notes[l.id] ?? []).map((n) => <small key={`${n.text}${n.counted}`} className={`v-num ${n.amount < 0 ? "v-neg" : "v-pos"}`}><Money value={money(n.amount)} signed /> {n.text}{n.counted ? "" : " (saved balance)"}</small>)}
                    {(() => {
                      if (!l.reimburse) return null;
                      const when = l.reimburse.day ? ` on the ${l.reimburse.day}` : ` in the ${l.reimburse.cutoff === "first" ? "1st" : "2nd"} cutoff`;
                      const r = reimbursements.find((x) => x.lineId === l.id);
                      if (!r || r.state === "expected") return <small>back <Money value={money(r?.amount ?? l.reimburse.amount)} />{when}{r && r.carried > 0 ? " (incl. postponed)" : ""}</small>;
                      // Inside a row that opens the editor, so each button keeps its click and keys to itself.
                      const button = (text: string, received: boolean, postponed: boolean) => (
                        <button type="button" className="v-btn v-sm v-ghost" disabled={marking} onKeyDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); mark({ lineId: r.lineId, month: r.month, cutoff: r.cutoff, received, postponed }); }}>{text}</button>
                      );
                      return (
                        <small className={r.state === "received" ? "v-pos" : "v-warnt"}>
                          {r.state === "received" ? "Received " : r.state === "postponed" ? "Postponed " : "Waiting for "}<Money value={money(r.amount)} />{r.state === "postponed" ? " to next month" : r.carried > 0 ? " (incl. postponed)" : ""}{" "}
                          {r.state === "waiting" ? <>{button("Mark received", true, false)}{button("Postponed?", false, true)}</> : button(r.state === "received" ? "Not yet" : "Undo", false, false)}
                        </small>
                      );
                    })()}
                    {showSpent && l.spent && l.amount ? (
                      <>
                        <span className="v-bar" role="img" aria-label={`${Math.round(pc)} percent ${l.spent.word}`}><i style={{ width: `${pc}%`, background: color }} /></span>
                        <small><Money value={l.spent.amount} /> {l.spent.word}</small>
                      </>
                    ) : null}
                  </span>
                </div>
              );
            })}
            {(moved.rows[g.id] ?? []).map((r) => (
              <div key={r.key} className="v-bl" aria-label={r.label} style={{ cursor: "default" }}>
                <span className="v-bn"><i className="v-dot" style={{ background: color, opacity: 0.45 }} /><span><b>{r.label}</b><span className="v-xs v-muted" style={{ display: "block" }}>{r.counted ? "office-day money you moved" : "from a pool's saved balance, not in the total"}</span></span></span>
                <span className="v-br"><span className="v-pill v-rl">Moved</span></span>
                <span className="v-bcut">
                  <span className="v-cutp" role="img" aria-label={cutoffText(r.cutoff)}>
                    <i className={r.cutoff !== "second" ? "v-on" : ""}>1</i><i className={r.cutoff !== "first" ? "v-on" : ""}>2</i>
                  </span>
                </span>
                <span className="v-ba"><b className={`v-num ${r.amount < 0 ? "v-neg" : "v-pos"}`}><Money value={money(r.amount)} signed /></b></span>
              </div>
            ))}
            {(payroll[g.id] ?? []).filter((d) => !cutoff || d[cutoff] > 0).map((d) => (
              <div key={`${d.kind}-${d.label}`} className="v-bl" aria-label={`${d.label}, taken from your payslip`} style={{ cursor: "default" }}>
                <span className="v-bn"><i className="v-dot" style={{ background: color, opacity: 0.45 }} /><span><b>{d.label}</b><span className="v-xs v-muted" style={{ display: "block" }}>from your payslip</span></span></span>
                <span className="v-br"><span className="v-pill v-rl">Payslip</span></span>
                <span className="v-bcut">
                  <span className="v-cutp" role="img" aria-label={cutoffText(d.cutoff)}>
                    <i className={d.cutoff !== "second" ? "v-on" : ""}>1</i><i className={d.cutoff !== "first" ? "v-on" : ""}>2</i>
                  </span>
                </span>
                <span className="v-ba">
                  <b className="v-num"><Money value={money(cutoff ? d[cutoff] : d.amount)} /></b>
                  {!cutoff && d.cutoff === "both" && d.first !== d.second ? <small className="v-num">1st <Money value={money(d.first)} /> · 2nd <Money value={money(d.second)} /></small> : null}
                </span>
              </div>
            ))}
            <button type="button" className="v-btn v-sm v-ghost" style={{ marginTop: 8 }} onClick={() => open(blank(first?.id ?? categories[0]?.id ?? ""))} disabled={categories.length === 0}>+ Line in {g.name}</button>
          </section>
        );
      })}

      <dialog ref={dialog} className="v-dlg" aria-labelledby="edt" onClick={(e) => e.target === dialog.current && close()}>
        {draft ? (
          <div className="v-qa">
            <div className="v-grab" aria-hidden="true" />
            <div className="v-row v-sp"><h2 id="edt">{draft.id ? "Edit line" : "New line"}</h2><button type="button" className="v-iconbtn v-s" onClick={close} aria-label="Close"><V13Icon name="x" /></button></div>
            <div className="v-stack" style={{ marginTop: 4 }}>
              <div className="v-grid2">
                <label className="v-field">Name<input value={draft.name} maxLength={60} onChange={(e) => set({ name: e.target.value })} autoFocus /></label>
                <label className="v-field">Category
                  <select value={draft.categoryId} onChange={(e) => set({ categoryId: e.target.value })}>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
                </label>
              </div>
              <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
                <legend className="v-lbl">Rule</legend>
                <div className="v-rulegrid">
                  {([["fixed", "Fixed", "Same peso amount"], ["pct", "% of take-home", "Grows with raises"], ["rest", "Whatever is left", "Takes the remainder"]] as const).map(([v, l, s]) => (
                    <label key={v}><input type="radio" name="r" checked={draft.rule === v} onChange={() => set({ rule: v, tick: v === "rest" ? "none" : draft.tick })} />{l}<small>{s}</small></label>
                  ))}
                </div>
              </fieldset>
              <div className="v-grid2">
                <label className="v-field">{draft.rule === "pct" ? "Percent" : draft.rule === "rest" ? "Amount (not used)" : draft.cutoff === "both" ? "1st cutoff amount (₱)" : "Amount (₱)"}
                  <input value={draft.value} inputMode="decimal" disabled={draft.rule === "rest"} onChange={(e) => set({ value: e.target.value })} />
                </label>
                <div className="v-field">Cutoff
                  <div className="v-seg" role="group" aria-label="Cutoff" style={{ width: "100%" }}>
                    {([["first", "1st"], ["second", "2nd"], ["both", "Both"]] as const).map(([v, l]) => <button key={v} type="button" style={{ flex: 1 }} aria-pressed={draft.cutoff === v} onClick={() => set({ cutoff: v })}>{l}</button>)}
                  </div>
                </div>
              </div>
              {draft.rule === "fixed" && draft.cutoff === "both" ? (
                <label className="v-field">2nd cutoff amount (₱, empty = same as the 1st)
                  <input value={draft.valueSecond} inputMode="decimal" placeholder={draft.value} onChange={(e) => set({ valueSecond: e.target.value })} />
                </label>
              ) : null}
              <label className="v-field">Goes to (optional)
                  <select value={draft.accountId} onChange={(e) => set({ accountId: e.target.value })}><option value="">Nowhere, just a limit</option>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
                </label>
              <fieldset style={{ border: "1px solid var(--line)", borderRadius: 10, padding: "12px 14px", margin: 0 }}>
                <legend className="v-lbl" style={{ padding: "0 6px" }}>Reimbursed (optional)</legend>
                <div className="v-xs v-muted" style={{ marginBottom: 8 }}>For a bill that is paid back to you each month. The deposit adds to what that cutoff has, so it frees up the money.</div>
                <div className="v-grid2">
                  <label className="v-field">Paid back each month (₱)<input value={draft.rbAmount} inputMode="decimal" placeholder="0" onChange={(e) => set({ rbAmount: e.target.value })} /></label>
                  <label className="v-field">Deposit day (optional)<input value={draft.rbDay} inputMode="numeric" maxLength={2} placeholder="17" onChange={(e) => set({ rbDay: e.target.value })} /></label>
                </div>
                <div className="v-field">Deposited in
                  <div className="v-seg" role="group" aria-label="Reimbursement cutoff" style={{ width: "100%" }}>
                    {([["first", "1st cutoff"], ["second", "2nd cutoff"]] as const).map(([v, l]) => <button key={v} type="button" style={{ flex: 1 }} aria-pressed={draft.rbCutoff === v} onClick={() => set({ rbCutoff: v })}>{l}</button>)}
                  </div>
                </div>
              </fieldset>
              <div className="v-grid2 v-keep2">
                <div className="v-field">Starts<MonthPicker label="Starts" value={draft.startsOn} min={`${thisYear - 5}-01`} max={`${thisYear + 15}-12`} clearable placeholder="No start" onChange={(v) => set({ startsOn: v })} /></div>
                <div className="v-field">Ends<MonthPicker label="Ends" value={draft.endsOn} min={`${thisYear - 5}-01`} max={`${thisYear + 15}-12`} clearable placeholder="No end" onChange={(v) => set({ endsOn: v })} /></div>
              </div>
              <fieldset style={{ border: "1px solid var(--line)", borderRadius: 10, padding: "12px 14px", margin: 0 }}>
                <legend className="v-lbl" style={{ padding: "0 6px" }}>Counts toward</legend>
                <Tick label="Daily spend" hint="Safe-to-spend on Now is built from the lines you tick." on={draft.daily} onChange={(v) => set({ daily: v })} />
                {draft.rule !== "rest" ? (
                  <>
                    <Tick label="RTO days" hint="Part of your office-day budget. Tick as many lines as you like (commute, food); the app splits the day between them." on={draft.tick === "rto"} onChange={(v) => set({ tick: v ? "rto" : "none" })} />
                    <Tick label="RTO contingency" hint="Extra office days you mark are paid from this line's pool. Only one line can be the contingency." on={draft.tick === "rto_contingency"} onChange={(v) => set({ tick: v ? "rto_contingency" : "none" })} />
                  </>
                ) : null}
                <Tick label="Draft" hint="A draft is left out of every total until you turn it off." on={draft.isDraft} onChange={(v) => set({ isDraft: v })} />
              </fieldset>
              <div className="v-note" aria-live="polite">{preview}</div>
              {error ? <p className="v-flag v-bad" role="alert">{error}</p> : null}
              <div className="v-row">
                <button type="button" className="v-btn v-pri v-grow" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save line"}</button>
                {draft.id ? <button type="button" className="v-btn" disabled={busy} onClick={remove}>Delete</button> : null}
              </div>
            </div>
          </div>
        ) : null}
      </dialog>
    </>
  );
}

function Tick({ label, hint, on, onChange }: { label: string; hint: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="v-row" style={{ gap: 12, minHeight: 48 }}>
      <button type="button" className="v-sw" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} />
      <span className="v-grow"><b>{label}</b><span className="v-xs v-muted" style={{ display: "block" }}>{hint}</span></span>
    </label>
  );
}
