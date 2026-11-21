"use client";

import { useRef, useState, useTransition } from "react";
import { deleteLine, saveLine } from "@/app/(v13)/budget/actions";
import { money, parsePesos } from "@/lib/domain/money";
import { cutoffText, ruleText, type GroupView, type LineView } from "@/lib/budget/view";
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
  cutoff: "first" | "second" | "both";
  accountId: string;
  startsOn: string;
  endsOn: string;
  isDraft: boolean;
  daily: boolean;
  tick: "none" | "rto" | "rto_contingency";
}

const blank = (categoryId: string): Draft => ({ name: "", categoryId, rule: "fixed", value: "", cutoff: "both", accountId: "", startsOn: "", endsOn: "", isDraft: false, daily: false, tick: "none" });
const draftOf = (l: LineView): Draft => ({
  id: l.id,
  name: l.name,
  categoryId: l.categoryId,
  rule: l.rule,
  value: l.rule === "pct" ? String((l.pctBp ?? 0) / 100) : l.rule === "fixed" && l.fixed !== null ? (l.fixed / 100).toFixed(2) : "",
  cutoff: l.cutoff,
  accountId: l.accountId ?? "",
  startsOn: l.startsOn ?? "",
  endsOn: l.endsOn ?? "",
  isDraft: l.isDraft,
  daily: l.countsToDaily,
  tick: l.kind === "rto" ? "rto" : l.kind === "rto_contingency" ? "rto_contingency" : "none",
});

/** The budget lines by group, and the editor sheet. Tap a line to edit it. */
export function BudgetBoard({ groups, colors, categories, accounts, showSpent, takeHome }: { groups: GroupView[]; colors: string[]; categories: (Option & { groupId: string })[]; accounts: Option[]; showSpent: boolean; takeHome: number }) {
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
      return v === undefined ? "Enter an amount." : "Never changes unless you edit it.";
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
    start(async () => {
      const r = await saveLine({
        id: draft.id,
        name: draft.name,
        categoryId: draft.categoryId,
        rule: draft.rule,
        amount: draft.rule === "fixed" ? (amount ?? null) : null,
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
              <div className="v-row v-sp v-xs v-muted"><span>{Math.round(g.share)}% of take-home · {g.lines.filter((l) => l.amount !== null).length} lines</span>{showSpent ? <span className="v-num"><Money value={g.spentTotal} /> sent or spent so far</span> : null}</div>
            </header>
            <div className="v-blh" aria-hidden="true"><span>Line</span><span>Rule</span><span>Cutoff</span><span style={{ textAlign: "right" }}>This month</span></div>
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
                <label className="v-field">{draft.rule === "pct" ? "Percent" : draft.rule === "rest" ? "Amount (not used)" : "Amount per cutoff (₱)"}
                  <input value={draft.value} inputMode="decimal" disabled={draft.rule === "rest"} onChange={(e) => set({ value: e.target.value })} />
                </label>
                <div className="v-field">Cutoff
                  <div className="v-seg" role="group" aria-label="Cutoff" style={{ width: "100%" }}>
                    {([["first", "1st"], ["second", "2nd"], ["both", "Both"]] as const).map(([v, l]) => <button key={v} type="button" style={{ flex: 1 }} aria-pressed={draft.cutoff === v} onClick={() => set({ cutoff: v })}>{l}</button>)}
                  </div>
                </div>
              </div>
              <div className="v-grid2">
                <label className="v-field">Goes to (optional)
                  <select value={draft.accountId} onChange={(e) => set({ accountId: e.target.value })}><option value="">Nowhere, just a limit</option>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
                </label>
                <div className="v-grid2" style={{ gap: 8 }}>
                  <div className="v-field">Starts<MonthPicker label="Starts" value={draft.startsOn} min={`${thisYear - 5}-01`} max={`${thisYear + 15}-12`} clearable placeholder="No start" onChange={(v) => set({ startsOn: v })} /></div>
                  <div className="v-field">Ends<MonthPicker label="Ends" value={draft.endsOn} min={`${thisYear - 5}-01`} max={`${thisYear + 15}-12`} clearable placeholder="No end" onChange={(v) => set({ endsOn: v })} /></div>
                </div>
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
