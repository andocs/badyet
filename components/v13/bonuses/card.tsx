"use client";

import { useRef, useState, useTransition } from "react";
import { saveInstance } from "@/app/(v13)/bonuses/actions";
import { money, parsePesos } from "@/lib/domain/money";
import type { BonusCard, DestKind, DestView } from "@/lib/bonuses/view";
import { EXEMPTION_CAP } from "@/lib/windfall/compute";
import { Money } from "../money";
import { V13Icon } from "../icons";

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const ymLabel = (m: string) => `${MON[Number(m.slice(5)) - 1]} ${m.slice(0, 4)}`;
const KIND_LABEL: Record<DestKind, string> = { fund: "Fund", gift: "Gifts", purchase: "Big purchase", debt: "Debt", wants: "Treat", account: "Account" };
export const DEST_COLOR: Record<DestKind, string> = { fund: "var(--accent)", gift: "var(--pink)", purchase: "var(--teal)", debt: "var(--red)", wants: "var(--muted)", account: "var(--blue)" };

interface Row { kind: DestKind; targetId: string | null; label: string | null; name: string; amount: string; done: boolean }
const rowOf = (d: DestView): Row => ({ kind: d.kind, targetId: d.targetId, label: d.label, name: d.name, amount: (d.amount / 100).toFixed(2), done: d.done });

/** One bonus for one year: gross to net, then where each peso goes (tick them off as you do it). */
export function BonusCardView({ card, funds, baseMultiplier }: { card: BonusCard; funds: { id: string; name: string }[]; baseMultiplier: number }) {
  const [editing, setEditing] = useState(false);
  const [rows, setRows] = useState<Row[]>(() => card.dests.map(rowOf));
  const [custom, setCustom] = useState({ name: "", amount: "", kind: "gift" as DestKind });
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  // The row being ticked off, so its check shows a spinner until the server has it.
  const [pending, setPending] = useState<number | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const [rec, setRec] = useState({ gross: "", dm: "", net: "" });

  const toInput = (list: Row[], extra: { multiplierNum?: number | null; received?: { gross: number; deMinimis: number; net: number } | null } = {}) => ({
    ruleId: card.ruleId,
    year: card.year,
    multiplierNum: extra.multiplierNum !== undefined ? extra.multiplierNum : card.multiplierNum,
    splits: list.map((r) => ({ kind: r.kind, targetId: r.targetId, label: r.kind === "fund" ? null : r.label ?? r.name, amount: parsePesos(r.amount) ?? 0, done: r.done })),
    received: extra.received ?? null,
  });
  const run = (list: Row[], extra: Parameters<typeof toInput>[1], after?: () => void, undo?: () => void) => {
    setError(null);
    start(async () => {
      const r = await saveInstance(toInput(list, extra));
      setPending(null);
      if (r.error) { setError(r.error); undo?.(); }
      else after?.();
    });
  };

  const placed = rows.reduce((t, r) => t + (parsePesos(r.amount) ?? 0), 0);
  const left = card.net - placed;
  const isCip = card.kind === "cip";
  const mult = card.multiplierNum ?? baseMultiplier;
  const picks = [["Low ×0.5", 0.5], ["Base ×1.0", 1], ["High ×1.5", 1.5]] as const;
  const usedBefore = EXEMPTION_CAP - card.roomBefore + card.exempt;

  const waterfall = (
    <div className="v-wf">
      <div className="v-r"><span>Gross<span className="v-why">{card.kind === "cip" ? "Eligible earnings × your component × the multiplier" : card.kind === "thirteenth" ? "1 month of base" : "As planned"}</span></span><b className="v-num"><Money value={card.gross} /></b></div>
      <div className="v-r"><span>De minimis<span className="v-why">{card.kind === "thirteenth" ? "None for the 13th month" : "Tax-free slice for this bonus"}</span></span><b className="v-num">− <Money value={card.deMinimis} /></b></div>
      <div className="v-r"><span>Counts toward the cap<span className="v-why">Room before this one: <Money value={card.roomBefore} /> of <Money value={money(EXEMPTION_CAP)} /></span>
        <div className="v-bar" style={{ margin: "6px 0 0", width: "min(240px,100%)" }} role="img" aria-label="Cap use"><i style={{ width: `${Math.min(100, (usedBefore / EXEMPTION_CAP) * 100)}%`, background: card.over > 0 ? "var(--gold)" : "var(--accent)" }} /></div></span><b className="v-num"><Money value={card.exempt} /></b></div>
      <div className="v-r"><span>Over the cap, taxed<span className="v-why">{card.over > 0 ? <><Money value={card.over} /> goes past the cap</> : "Nothing goes past the cap"}</span></span><b className={`v-num ${card.tax ? "v-warnt" : ""}`}>− <Money value={card.tax} /></b></div>
      <div className="v-r v-res"><span>Net to you</span><b className="v-num v-pos"><Money value={card.net} /></b></div>
    </div>
  );

  if (card.status === "received") {
    const d = card.plannedNet === null ? 0 : card.net - card.plannedNet;
    return (
      <details className="v-old">
        <summary>
          <span className="v-row" style={{ gap: 10 }}><span className="v-av" style={{ background: "var(--soft)", color: "var(--muted)" }}><V13Icon name="gift" /></span><span><b>{card.name}</b><span className="v-why">{ymLabel(card.month)} · received</span></span></span>
          <span className="v-row v-wrap" style={{ gap: 10 }}><b className="v-num"><Money value={card.net} /></b><span className={`v-pill ${Math.abs(card.unplaced) < 50 ? "v-ok" : "v-warn"}`}>{Math.abs(card.unplaced) < 50 ? "All placed" : "Not placed"}</span></span>
        </summary>
        <div className="v-in">
          {waterfall}
          {card.plannedNet !== null ? <div className={`v-vs ${d >= 0 ? "v-pos" : "v-warnt"}`}>Planned <Money value={card.plannedNet} /> · got <Money value={card.net} /> (<Money value={money(d)} signed />)</div> : null}
          <h3 style={{ margin: "14px 0 4px" }}>Where it went</h3>
          {card.dests.map((d2, i) => <div key={i} className="v-sr-row"><span className="v-chk" aria-checked={true} role="img" aria-label="done" style={{ cursor: "default" }}><V13Icon name="check" /></span><span className="v-grow"><b>{d2.name}</b> <span className="v-tkn">{KIND_LABEL[d2.kind]}</span></span><span className="v-num"><Money value={d2.amount} /></span></div>)}
        </div>
      </details>
    );
  }

  return (
    <article className="v-bc" aria-labelledby={`t-${card.key}`}>
      <div className="v-hd">
        <h2 id={`t-${card.key}`}><span className="v-av" style={{ background: "var(--tint)", color: "var(--accent-text)" }}><V13Icon name="gift" /></span><span>{card.name}<span className="v-why">{ymLabel(card.month)} · lands in the {card.cutoff === "first" ? "1st" : "2nd"} cutoff</span></span></h2>
        <div className="v-row v-wrap" style={{ gap: 8 }}><span className={`v-pill ${card.recurrence === "once" ? "v-warn" : ""}`}>{card.recurrence === "once" ? "One-off" : "Yearly"}</span><span className="v-pill v-est">planned</span></div>
      </div>
      <div className="v-body">
        <div className="v-pane">
          {isCip ? (
            <div className="v-row v-wrap" style={{ marginBottom: 10 }}>
              <span className="v-lbl">Multiplier</span>
              <div className="v-seg" role="group" aria-label="Multiplier">
                {picks.map(([l, f]) => {
                  const value = Math.max(1, Math.round(baseMultiplier * f));
                  return <button key={l} type="button" disabled={busy} aria-pressed={mult === value} onClick={() => run(rows, { multiplierNum: value })}>{l}</button>;
                })}
              </div>
            </div>
          ) : null}
          {waterfall}
        </div>
        <div className="v-pane">
          <div className="v-row v-sp v-wrap">
            <h3>Where it goes</h3>
            <span className="v-row" style={{ gap: 6 }}>
              {editing ? <button type="button" className="v-btn v-sm v-pri" disabled={busy} onClick={() => run(rows, {}, () => setEditing(false))}>Done</button> : <button type="button" className="v-btn v-sm" onClick={() => setEditing(true)}>Edit amounts</button>}
              <button type="button" className="v-btn v-sm" onClick={() => { setRec({ gross: (card.gross / 100).toFixed(2), dm: (card.deMinimis / 100).toFixed(2), net: (card.net / 100).toFixed(2) }); dialog.current?.showModal(); }}>Mark received</button>
            </span>
          </div>
          <div className="v-mini" role="img" aria-label="Split">{rows.map((r, i) => <i key={i} style={{ width: `${card.net > 0 ? Math.max(0, (parsePesos(r.amount) ?? 0) / card.net) * 100 : 0}%`, background: DEST_COLOR[r.kind] }} />)}</div>
          {rows.length === 0 ? <p className="v-muted v-sm">Nothing placed yet. Add a destination.</p> : null}
          {rows.map((r, i) => (
            <div key={i} className={`v-sr-row ${r.done ? "v-done" : ""}${editing ? " v-ed" : ""}`}>
              <button type="button" className="v-chk" role="checkbox" aria-checked={r.done} aria-busy={pending === i} aria-label={`Mark ${r.name} done`} disabled={busy || editing} onClick={() => { const before = rows; const next = rows.map((x, j) => (j === i ? { ...x, done: !x.done } : x)); setRows(next); setPending(i); run(next, {}, undefined, () => setRows(before)); }}>{pending === i ? <span className="v-spin" aria-hidden="true" /> : <V13Icon name="check" />}</button>
              <span className="v-grow v-nm"><b>{r.name}</b> <span className="v-tkn">{KIND_LABEL[r.kind]}</span></span>
              {editing ? (
                <>
                  <input className="v-lbl-in" value={r.amount} inputMode="decimal" style={{ width: 110, textAlign: "right", minHeight: 40 }} aria-label={`Amount for ${r.name}`} onChange={(e) => setRows((x) => x.map((y, j) => (j === i ? { ...y, amount: e.target.value } : y)))} />
                  <button type="button" className="v-iconbtn v-s" aria-label={`Remove ${r.name}`} onClick={() => setRows((x) => x.filter((_, j) => j !== i))}><V13Icon name="x" /></button>
                </>
              ) : <span className="v-num"><Money value={money(parsePesos(r.amount) ?? 0)} /></span>}
            </div>
          ))}
          <div className="v-sr-row">
            <span className={`v-grow ${Math.abs(left) < 50 ? "v-pos" : "v-warnt"}`}><b>{Math.abs(left) < 50 ? "All placed" : left > 0 ? "Not placed yet" : "Over by"}</b></span>
            <b className={`v-num ${Math.abs(left) < 50 ? "v-pos" : "v-warnt"}`}><Money value={money(Math.round(left))} /></b>
          </div>
          {editing ? (
            <div className="v-addbox">
              <div className="v-lbl" style={{ marginBottom: 6 }}>Add a destination</div>
              <div className="v-addgrid">
                <input className="v-lbl-in" value={custom.name} placeholder="Name it, e.g. Mom's birthday gift" aria-label="Name of the new destination" onChange={(e) => setCustom({ ...custom, name: e.target.value })} />
                <select className="v-lbl-in" value={custom.kind} aria-label="Type" onChange={(e) => setCustom({ ...custom, kind: e.target.value as DestKind })}>{(["gift", "purchase", "debt", "wants"] as const).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}</select>
                <input className="v-lbl-in" value={custom.amount} inputMode="decimal" placeholder="₱ amount" aria-label="Amount in pesos" onChange={(e) => setCustom({ ...custom, amount: e.target.value })} />
                <button type="button" className="v-btn v-sm v-pri" onClick={() => { if (!custom.name.trim()) return; setRows((x) => [...x, { kind: custom.kind, targetId: null, label: custom.name.trim(), name: custom.name.trim(), amount: custom.amount || "0", done: false }]); setCustom({ name: "", amount: "", kind: "gift" }); }}>Add</button>
              </div>
              {funds.filter((f) => !rows.some((r) => r.targetId === f.id)).length > 0 ? (
                <div className="v-row v-wrap" style={{ gap: 6, marginTop: 10 }}>
                  <span className="v-xs v-muted">Or a fund:</span>
                  {funds.filter((f) => !rows.some((r) => r.targetId === f.id)).map((f) => <button key={f.id} type="button" className="v-btn v-sm" onClick={() => setRows((x) => [...x, { kind: "fund", targetId: f.id, label: null, name: f.name, amount: String(Math.max(0, Math.round(left / 100))), done: false }])}>{f.name}</button>)}
                </div>
              ) : null}
            </div>
          ) : null}
          {error ? <p className="v-flag v-bad" role="alert">{error}</p> : null}
          {card.kind === "thirteenth" ? <p className="v-xs v-muted" style={{ margin: "10px 0 0" }}>Tip: the 13th month is a good place for gifts. Anything marked Gifts or Big purchase is spent, not saved.</p> : null}
        </div>
      </div>
      <dialog ref={dialog} className="v-fdlg" aria-labelledby={`rc-${card.key}`} onClick={(e) => e.target === dialog.current && dialog.current?.close()}>
        <div className="v-qa">
          <div className="v-row v-sp"><h2 id={`rc-${card.key}`}>{card.name} arrived</h2><button type="button" className="v-iconbtn v-s" onClick={() => dialog.current?.close()} aria-label="Close"><V13Icon name="x" /></button></div>
          <p className="v-muted v-sm" style={{ margin: 0 }}>Enter what your payslip shows. This replaces the plan for this year and moves it to your history.</p>
          <div className="v-frm">
            <label className="v-field">Gross (₱)<input value={rec.gross} inputMode="decimal" onChange={(e) => setRec({ ...rec, gross: e.target.value })} /></label>
            <label className="v-field">De minimis (₱)<input value={rec.dm} inputMode="decimal" onChange={(e) => setRec({ ...rec, dm: e.target.value })} /></label>
            <label className="v-field">Net received (₱)<input value={rec.net} inputMode="decimal" onChange={(e) => setRec({ ...rec, net: e.target.value })} /></label>
            <button type="button" className="v-btn v-pri" disabled={busy} onClick={() => {
              const g = parsePesos(rec.gross), d = parsePesos(rec.dm), n = parsePesos(rec.net);
              if (g === undefined || d === undefined || n === undefined) return setError("Enter the three amounts, like 64,000.00.");
              run(rows, { received: { gross: g, deMinimis: d, net: n } }, () => dialog.current?.close());
            }}>Save as received</button>
          </div>
        </div>
      </dialog>
    </article>
  );
}
