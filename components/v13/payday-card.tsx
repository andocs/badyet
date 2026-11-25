"use client";

import { useState, useTransition } from "react";
import { payArrived, setNowCategories } from "@/app/(v13)/actions";
import { Money } from "./money";
import type { Money as MoneyValue } from "@/lib/domain/money";

/** "Has the pay arrived?": records this cutoff's take-home as income on the account it went into. */
export function PaydayCard({ amount, cutoff, bonuses, accountId, accounts }: { amount: MoneyValue; cutoff: "first" | "second"; bonuses: string[]; accountId: string | null; accounts: { id: string; name: string; kind: string }[] }) {
  const [hidden, setHidden] = useState(false);
  const [account, setAccount] = useState(accountId ?? "");
  // With a bonus in this pay the payslip figure is only a guess, so you type what actually came in.
  const [typed, setTyped] = useState(bonuses.length > 0 ? "" : (amount / 100).toFixed(2));
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  if (hidden) return null;

  const save = () =>
    start(async () => {
      setError(null);
      const r = await payArrived({ accountId: account, amount: typed });
      if (r.error) setError(r.error);
    });

  return (
    <section className="v-card v-stack v-payday" aria-labelledby="pd" style={{ gap: 10 }}>
      <div className="v-row v-sp v-wrap">
        <h2 id="pd">Has the pay arrived?</h2>
        <span className="v-lbl">{cutoff === "first" ? "1st" : "2nd"} cutoff payday</span>
      </div>
      <p className="v-sm" style={{ margin: 0 }}>
        {bonuses.length > 0 ? (
          <>This pay includes <b>{bonuses.join(", ")}</b>. Type the actual take-home from your payslip (without the bonus it would be <Money value={amount} />).</>
        ) : (
          <>Your payslip says <b><Money value={amount} /></b>. Change it if the amount that came in is different.</>
        )}
      </p>
      <div className="v-row v-wrap" style={{ gap: 10 }}>
        <label className="v-field v-grow">
          Went into
          <select value={account} onChange={(e) => setAccount(e.target.value)}>
            <option value="">Pick an account</option>
            {accounts.filter((a) => a.kind !== "credit").map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </label>
        <label className="v-field" style={{ width: 160 }}>
          Take-home
          <input inputMode="decimal" value={typed} placeholder="0.00" onChange={(e) => setTyped(e.target.value)} />
        </label>
      </div>
      {error ? <p className="v-flag v-bad" role="alert" style={{ margin: 0 }}>{error}</p> : null}
      <div className="v-row v-wrap" style={{ gap: 8 }}>
        <button type="button" className="v-btn v-pri" disabled={busy || account === "" || typed.trim() === ""} onClick={save}>Yes, add it</button>
        <button type="button" className="v-btn" onClick={() => setHidden(true)}>Not yet</button>
      </div>
      <p className="v-xs v-muted" style={{ margin: 0 }}>The account is remembered for the next payday.</p>
    </section>
  );
}

/** Choose which categories show under Planned vs spent. Saved to your account, so the phone shows the same. */
export function PanelPicker({ all, shown }: { all: { id: string; name: string }[]; shown: string[] | null }) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(() => new Set(shown ?? all.map((c) => c.id)));
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const save = () =>
    start(async () => {
      setError(null);
      const ids = all.every((c) => picked.has(c.id)) ? null : [...picked];
      const r = await setNowCategories(ids);
      if (r.error) setError(r.error);
      else setOpen(false);
    });
  return (
    <div className="v-stack" style={{ gap: 8 }}>
      <button type="button" className="v-btn v-sm" aria-expanded={open} onClick={() => setOpen((o) => !o)}>{open ? "Close" : "Choose"}</button>
      {open ? (
        <div className="v-card v-stack" style={{ gap: 8 }}>
          <div className="v-lbl">Show these categories</div>
          {all.map((c) => (
            <label key={c.id} className="v-row" style={{ gap: 10, minHeight: 36 }}>
              <input type="checkbox" checked={picked.has(c.id)} onChange={() => setPicked((p) => { const n = new Set(p); if (n.has(c.id)) n.delete(c.id); else n.add(c.id); return n; })} />
              <span>{c.name}</span>
            </label>
          ))}
          {error ? <p className="v-flag v-bad" role="alert" style={{ margin: 0 }}>{error}</p> : null}
          <div className="v-row" style={{ gap: 8 }}>
            <button type="button" className="v-btn v-pri v-sm" disabled={busy || picked.size === 0} onClick={save}>Save</button>
            <button type="button" className="v-btn v-sm" onClick={() => setPicked(new Set(all.map((c) => c.id)))}>All</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
