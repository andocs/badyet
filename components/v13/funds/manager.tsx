"use client";

import { useState, useTransition } from "react";
import { archiveFund, reorderFunds, saveFund } from "@/app/(v13)/funds/actions";
import { money, parsePesos } from "@/lib/domain/money";
import { useConfirm } from "../feedback";
import { Money } from "../money";
import { MonthOfYear } from "../pickers";

export interface FundCard {
  id: string;
  name: string;
  color: string;
  rule: "steps" | "cap" | "reset" | "fixed";
  target: number | null;
  tranches: number[] | null;
  maxPerMonth: number | null;
  fixedAmount: number | null;
  resetMonth: number | null;
  linkedAccountId: string | null;
  shareBp: number | null;
  /** Balance now (from the linked account, or typed in). */
  balance: number;
}

const COLORS = [
  "#34D399", "#7FA8FF", "#F6C453", "#C4A0FF", "#5CD0E6", "#F28BC8",
  "#10B981", "#3B82F6", "#F59E0B", "#8B5CF6", "#06B6D4", "#EC4899",
  "#EF4444", "#F97316", "#84CC16", "#14B8A6", "#6366F1", "#A8A29E",
];
const RULES: ["steps" | "cap" | "reset" | "fixed", string, string][] = [
  ["steps", "Fill in steps", "One tranche at a time (like an emergency fund)"],
  ["cap", "Fill to cap", "Keep going until the target is full"],
  ["reset", "Reset each year", "Starts again every January (like travel)"],
  ["fixed", "Fixed monthly", "Same amount every month until the cap"],
];
const EFFECT: Record<string, string> = {
  steps: "In steps: takes up to your monthly limit until the current tranche is full, then moves on to the next tranche.",
  cap: "To cap: takes what the pool allows, in priority order, until it hits the cap. Then it drops out.",
  reset: "Resets every January: the balance returns to zero and filling starts over.",
  fixed: "Fixed: the same amount each month if the pool can cover it, until the cap.",
};
const peso = (n: number | null) => (n === null ? "" : (n / 100).toFixed(2));

interface Draft {
  id?: string;
  name: string;
  color: string;
  linked: boolean;
  accountId: string;
  shareBp: string;
  startBalance: string;
  rule: FundCard["rule"];
  target: string;
  max: string;
  tranches: string;
  fixed: string;
  resetMonth: number;
}

const draftOf = (f?: FundCard): Draft => ({
  id: f?.id,
  name: f?.name ?? "",
  color: f?.color ?? COLORS[0]!,
  linked: !!f?.linkedAccountId,
  accountId: f?.linkedAccountId ?? "",
  shareBp: f?.shareBp ? String(f.shareBp / 100) : "",
  startBalance: f ? peso(f.balance) : "",
  rule: f?.rule ?? "cap",
  target: peso(f?.target ?? null),
  max: peso(f?.maxPerMonth ?? null),
  tranches: (f?.tranches ?? []).map((t) => (t / 100).toFixed(2)).join(", "),
  fixed: peso(f?.fixedAmount ?? null),
  resetMonth: f?.resetMonth ?? 1,
});

/** The funds in default priority order, and an editor for the selected one. */
export function FundsManager({ funds, accounts }: { funds: FundCard[]; accounts: { id: string; name: string }[] }) {
  const [order, setOrder] = useState(funds.map((f) => f.id));
  const [sel, setSel] = useState<string | "new">(funds[0]?.id ?? "new");
  const [d, setD] = useState<Draft>(() => draftOf(funds[0]));
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const ask = useConfirm();
  const byId = new Map(funds.map((f) => [f.id, f]));
  const list = order.map((id) => byId.get(id)).filter((f): f is FundCard => !!f);
  const set = (c: Partial<Draft>) => setD((x) => ({ ...x, ...c }));

  const pick = (id: string | "new") => {
    setSel(id);
    setD(draftOf(id === "new" ? undefined : byId.get(id)));
    setError(null);
    setNote(null);
  };
  const move = (i: number, by: -1 | 1) => {
    const next = [...order];
    const j = i + by;
    [next[i], next[j]] = [next[j]!, next[i]!];
    setOrder(next);
    start(async () => {
      const r = await reorderFunds(next);
      if (r.error) setError(r.error);
    });
  };

  const save = () => {
    setError(null);
    setNote(null);
    const money1 = (s: string) => (s.trim() === "" ? null : parsePesos(s));
    const target = money1(d.target), max = money1(d.max), fixed = money1(d.fixed), startBalance = money1(d.startBalance);
    if ([target, max, fixed, startBalance].some((x) => x === undefined)) return setError("Check the amounts: pesos like 1,250.50.");
    const tranches = d.rule === "steps" ? d.tranches.split(",").map((t) => parsePesos(t.trim())).filter((t): t is NonNullable<typeof t> => t !== undefined && t > 0) : null;
    start(async () => {
      const r = await saveFund({
        id: d.id, name: d.name, color: d.color, rule: d.rule, target, tranches, maxPerMonth: max, fixedAmount: d.rule === "fixed" ? fixed : null,
        resetMonth: d.rule === "reset" ? d.resetMonth : null, linkedAccountId: d.linked ? d.accountId || null : null,
        shareBp: d.linked && d.shareBp.trim() !== "" ? Math.round(Number(d.shareBp) * 100) : null, startBalance: d.linked ? null : startBalance,
      });
      if (r.error) setError(r.error);
      else setNote("Saved.");
    });
  };
  const archive = async () => {
    if (!d.id) return;
    if (!(await ask({ title: "Archive this fund?", message: "It leaves the forecast.", confirmLabel: "Archive", danger: true }))) return;
    start(async () => {
      const r = await archiveFund(d.id!);
      if (r.error) setError(r.error);
      else pick("new");
    });
  };

  const cap = (f: FundCard) => f.target ?? f.tranches?.[f.tranches.length - 1] ?? 0;
  return (
    <div className="v-cols5">
      <section aria-labelledby="po">
        <div className="v-row v-sp" style={{ marginBottom: 8 }}><h2 id="po">Default priority</h2><span className="v-xs v-muted">Top gets filled first</span></div>
        {list.map((f, i) => {
          const p = cap(f) > 0 ? Math.min(100, (f.balance / cap(f)) * 100) : 0;
          return (
            <div key={f.id} className="v-row" style={{ alignItems: "stretch", gap: 8 }}>
              <button type="button" className="v-fund v-grow" aria-pressed={sel === f.id} onClick={() => pick(f.id)}>
                <span className="v-n">{i + 1}</span>
                <i className="v-dot" style={{ background: f.color, width: 14, height: 14 }} />
                <span className="v-grow"><b>{f.name}</b><span className="v-xs v-muted" style={{ display: "block" }}>{RULES.find((r) => r[0] === f.rule)![1]}</span>
                  <div className="v-bar" role="img" aria-label={`${f.name} ${Math.round(p)} percent of target`}><i style={{ width: `${p}%`, background: f.color }} /></div></span>
                <span style={{ textAlign: "right" }}><b className="v-num"><Money value={money(f.balance)} /></b>{cap(f) > 0 ? <span className="v-xs v-muted v-num" style={{ display: "block" }}>of <Money value={money(cap(f))} /></span> : null}</span>
              </button>
              <div className="v-mv">
                <button type="button" className="v-iconbtn v-s" onClick={() => move(i, -1)} disabled={i === 0 || busy} aria-label={`Move ${f.name} up`}>↑</button>
                <button type="button" className="v-iconbtn v-s" onClick={() => move(i, 1)} disabled={i === list.length - 1 || busy} aria-label={`Move ${f.name} down`}>↓</button>
              </div>
            </div>
          );
        })}
        {list.length === 0 ? <p className="v-muted">No funds yet. Add one to start filling it from your savings pool.</p> : null}
        <button type="button" className="v-btn v-pri" style={{ marginTop: 8 }} onClick={() => pick("new")}>+ New fund</button>
        <div className="v-note" style={{ marginTop: 12 }}>Any month can use a different order, a pinned amount or a skip. Those live on the Forecast, never here.</div>
      </section>

      <section className="v-card" aria-labelledby="edh">
        <div className="v-row v-sp"><h2 id="edh">{d.id ? d.name || "Fund" : "New fund"}</h2>{d.id ? <span className="v-pill">Priority {order.indexOf(d.id) + 1} of {order.length}</span> : null}</div>
        <div className="v-stack" style={{ marginTop: 14 }}>
          <div className="v-grid2">
            <label className="v-field">Name<input value={d.name} maxLength={40} onChange={(e) => set({ name: e.target.value })} /></label>
            <div className="v-field">Colour
              <div className="v-row v-wrap" style={{ gap: 8, paddingTop: 8 }} role="group" aria-label="Colour">
                {COLORS.map((c) => <button key={c} type="button" className="v-sw-c" style={{ background: c }} aria-label={`Colour ${c}`} aria-pressed={d.color === c} onClick={() => set({ color: c })} />)}
              </div>
            </div>
          </div>
          <div className="v-field">Starting balance
            <div className="v-seg" role="group" aria-label="Starting balance" style={{ width: "100%" }}>
              <button type="button" style={{ flex: 1 }} aria-pressed={d.linked} onClick={() => set({ linked: true })}>Linked to an account</button>
              <button type="button" style={{ flex: 1 }} aria-pressed={!d.linked} onClick={() => set({ linked: false })}>Typed in</button>
            </div>
          </div>
          {d.linked ? (
            <div className="v-grid2">
              <label className="v-field">Account
                <select value={d.accountId} onChange={(e) => set({ accountId: e.target.value })}><option value="">Pick an account</option>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
              </label>
              <label className="v-field">Share of it (%) <span className="v-xs v-muted">leave empty if this fund is the whole account</span>
                <input value={d.shareBp} inputMode="decimal" onChange={(e) => set({ shareBp: e.target.value })} placeholder="100" />
              </label>
            </div>
          ) : (
            <label className="v-field">Balance today (₱)<input value={d.startBalance} inputMode="decimal" onChange={(e) => set({ startBalance: e.target.value })} /></label>
          )}
          <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
            <legend className="v-lbl">Fill rule</legend>
            <div className="v-rulegrid">
              {RULES.map(([v, n, s]) => <label key={v}><input type="radio" name="r" checked={d.rule === v} onChange={() => set({ rule: v })} />{n}<small>{s}</small></label>)}
            </div>
          </fieldset>
          <div className="v-grid2">
            <label className="v-field">{d.rule === "steps" ? "Hard cap (optional, ₱)" : "Target or cap (₱)"}<input value={d.target} inputMode="decimal" onChange={(e) => set({ target: e.target.value })} /></label>
            <label className="v-field">Most per month (optional, ₱)<input value={d.max} inputMode="decimal" placeholder="no limit" onChange={(e) => set({ max: e.target.value })} /></label>
          </div>
          {d.rule === "steps" ? <label className="v-field">Tranches (₱, comma separated)<input value={d.tranches} onChange={(e) => set({ tranches: e.target.value })} placeholder="100,000.00" /><span className="v-xs" style={{ fontWeight: 500 }}>Fills the first one, then the next; the last repeats.</span></label> : null}
          {d.rule === "fixed" ? <label className="v-field">Fixed amount per month (₱)<input value={d.fixed} inputMode="decimal" onChange={(e) => set({ fixed: e.target.value })} /></label> : null}
          {d.rule === "reset" ? <div className="v-field">Starts again in<MonthOfYear value={d.resetMonth} label="Month it starts again" onChange={(m) => set({ resetMonth: m })} /></div> : null}
          <div className="v-note"><b>{EFFECT[d.rule]!.split(":")[0]}:</b>{EFFECT[d.rule]!.slice(EFFECT[d.rule]!.indexOf(":") + 1)}</div>
          {error ? <p className="v-flag v-bad" role="alert">{error}</p> : null}
          {note ? <p className="v-flag" role="status" style={{ background: "var(--tint)", color: "var(--accent-text)" }}>{note}</p> : null}
          <div className="v-row"><button type="button" className="v-btn v-pri" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save fund"}</button>{d.id ? <button type="button" className="v-btn" disabled={busy} onClick={archive}>Archive</button> : null}</div>
        </div>
      </section>
    </div>
  );
}
