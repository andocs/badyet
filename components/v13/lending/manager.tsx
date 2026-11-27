"use client";

import { useState, useTransition } from "react";
import { deleteLoan, lendMoney } from "@/app/(v13)/lending/actions";
import { money, parsePesos, sum } from "@/lib/domain/money";
import { dueBadge, historyRows, loanLine, pesoText } from "@/lib/lending/forms";
import type { PaybackChoice } from "@/lib/lending/load";
import { dueLoans, outstandingOf, postponedTimes, sortLoans, type Loan } from "@/lib/lending/model";
import { sourceOfKey } from "@/lib/lending/sources";
import { relativeDay } from "@/lib/now/format";
import { manilaDate } from "@/lib/now/summary";
import { Money } from "../money";
import { LendFields, newDraft, type LendContext, type LendDraft } from "./fields";
import { LoanActions, type PaybackContext } from "./loan-actions";
import { Pick } from "../pick";
import { DatePicker } from "../pickers";

/** Money lent by hand: cash, or something already recorded that the app did not file as a loan. */
function LendForm({ ctx, accounts, outgoing, onClose }: { ctx: LendContext; accounts: { id: string; name: string }[]; outgoing: PaybackChoice[]; onClose: () => void }) {
  const [draft, setDraft] = useState<LendDraft>(() => newDraft(ctx));
  const [recorded, setRecorded] = useState("");
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [date, setDate] = useState<string>(ctx.today);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const picked = outgoing.find((o) => o.id === recorded);
  const centavos = picked ? -picked.amount : (parsePesos(amount.trim()) ?? null);

  const save = () =>
    start(async () => {
      setError(null);
      const r = await lendMoney({
        borrower: draft.borrower, dueOn: draft.dueOn, from: sourceOfKey(draft.fromKey), note,
        ...(picked ? { txnId: picked.id } : { manual: { amount, accountId: accountId || null, date } }),
      });
      if (r.error) setError(r.error);
      else onClose();
    });

  return (
    <section className="v-card v-stack" style={{ gap: 10 }} aria-label="Lend money">
      <h2>Lend money</h2>
      {outgoing.length > 0 ? (
        <div className="v-field">
          Is it already recorded?
          <Pick label="Is it already recorded?" value={recorded} onChange={setRecorded} options={[{ value: "", label: "No, add it now" }, ...outgoing.map((o) => ({ value: o.id, label: `${pesoText(o.amount)} from ${o.accountName}${o.merchant ? ` · ${o.merchant}` : ""} · ${relativeDay(manilaDate(o.occurredAt), ctx.today)}` }))]} />
        </div>
      ) : null}
      {picked ? null : (
        <>
          <div className="v-grid2">
            <label className="v-field">Amount (₱)<input value={amount} inputMode="decimal" onChange={(e) => setAmount(e.target.value)} /></label>
            <div className="v-field">Lent on<DatePicker label="Lent on" value={date} max={ctx.today} onChange={setDate} /></div>
          </div>
          <div className="v-field">
            Money left from
            <Pick label="Money left from" value={accountId} onChange={setAccountId} options={[...accounts.map((a) => ({ value: a.id, label: a.name })), { value: "", label: "Cash that no account tracks" }]} />
          </div>
        </>
      )}
      <LendFields ctx={ctx} draft={draft} onChange={setDraft} amount={centavos} />
      <label className="v-field">Note (optional)<input value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} /></label>
      {error ? <p className="v-flag v-bad" role="alert" style={{ margin: 0 }}>{error}</p> : null}
      <div className="v-row v-wrap" style={{ justifyContent: "flex-end", gap: 8 }}>
        <button type="button" className="v-btn v-sm" disabled={busy} onClick={onClose}>Cancel</button>
        <button type="button" className="v-btn v-sm v-pri" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save loan"}</button>
      </div>
    </section>
  );
}

export function LendingManager({ loans, lend, payback, outgoing, ready }: { loans: Loan[]; lend: LendContext; payback: PaybackContext; outgoing: PaybackChoice[]; ready: boolean }) {
  const { open, paid } = sortLoans(loans);
  const [adding, setAdding] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);
  const [shownId, setShownId] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const shown = loans.find((l) => l.id === shownId) ?? open[0] ?? paid[0] ?? null;
  const total = sum(open.map(outstandingOf));
  const due = dueLoans(loans, lend.today).length;

  if (!ready) {
    return <section className="v-card"><p className="v-xs v-muted" style={{ margin: 0 }}>Lending needs a database update first: apply supabase/migrations/20261230000000_lending.sql, then reload.</p></section>;
  }

  const show = (id: string) => { setShownId(id); setAsking(false); setError(null); };
  const row = (l: Loan) => {
    const owed = outstandingOf(l);
    const badge = dueBadge(l, lend.today);
    const times = postponedTimes(l);
    return (
      <li key={l.id} className="v-loan">
        <div className="v-row v-sp" style={{ alignItems: "flex-start" }}>
          <div>
            <button type="button" className="v-loanname" aria-pressed={shown?.id === l.id} onClick={() => show(l.id)}>{l.borrower}</button>
            <div className="v-xs v-muted">{loanLine(l)}</div>
            {owed > 0 ? <span className={`v-pill ${badge.late ? "v-warn" : ""}`}>{badge.text}{times > 0 ? ` · postponed ${times === 1 ? "once" : `${times} times`}` : ""}</span> : <span className="v-pill v-ok">Paid</span>}
          </div>
          <div style={{ textAlign: "right" }}>
            <b className="v-num"><Money value={money(owed > 0 ? owed : l.amount)} /></b>
            {owed > 0 && owed < l.amount ? <div className="v-xs v-muted">of <Money value={l.amount} /></div> : null}
            {owed > 0 ? <div><button type="button" className="v-btn v-sm" aria-expanded={updating === l.id} onClick={() => { setUpdating(updating === l.id ? null : l.id); show(l.id); }}>Update</button></div> : null}
          </div>
        </div>
        {updating === l.id && owed > 0 ? <div style={{ marginTop: 10 }}><LoanActions loan={l} ctx={payback} onDone={() => setUpdating(null)} /></div> : null}
      </li>
    );
  };

  return (
    <div className="v-lend2">
      <div className="v-stack">
        <section className="v-card v-stack" style={{ gap: 4 }}>
          <div className="v-row v-sp v-wrap">
            <h2>Owed to you</h2>
            <button type="button" className="v-btn v-sm v-pri" aria-expanded={adding} onClick={() => setAdding(!adding)}>+ Lend money</button>
          </div>
          <div className="v-big v-num" style={{ fontSize: 30 }}><Money value={total} /></div>
          <div className="v-xs v-muted">
            {open.length === 0 ? "Nothing is out right now." : `${open.length} loan${open.length === 1 ? "" : "s"}${due ? ` · ${due} due` : ""}.`} Use + Lend money for cash, or anything the app did not catch.
          </div>
          {open.length > 0 ? <ul className="v-loans">{open.map(row)}</ul> : null}
        </section>
        {adding ? <LendForm ctx={lend} accounts={payback.accounts} outgoing={outgoing} onClose={() => setAdding(false)} /> : null}
        {paid.length > 0 ? (
          <details className="v-card">
            <summary><b>Paid back ({paid.length})</b></summary>
            <ul className="v-loans">{paid.map(row)}</ul>
          </details>
        ) : null}
      </div>
      {shown ? (
        <section className="v-card v-stack" style={{ gap: 4, alignSelf: "start" }}>
          <h2>History: {shown.borrower}</h2>
          {shown.note ? <div className="v-sm v-muted">{shown.note}</div> : null}
          <ul className="v-loans">
            {historyRows(shown).map((h) => (
              <li key={h.key} className="v-loan v-row v-sp">
                <span className="v-sm">{h.text}</span>
                {h.amount === null ? <span className="v-xs v-muted">{h.side}</span> : <b className={`v-num ${h.amount > 0 ? "v-pos" : ""}`}><Money value={money(h.amount)} signed /></b>}
              </li>
            ))}
          </ul>
          {error ? <p className="v-flag v-bad" role="alert" style={{ margin: 0 }}>{error}</p> : null}
          {asking ? (
            <div className="v-stack" style={{ gap: 8 }}>
              <div className="v-sm">Remove this loan? Entries added here are deleted. Ones from your bank go back to the Inbox.</div>
              <div className="v-row" style={{ gap: 8 }}>
                <button type="button" className="v-btn v-sm" disabled={busy} onClick={() => start(async () => { const r = await deleteLoan(shown.id); if (r.error) setError(r.error); else setAsking(false); })}>{busy ? "Removing…" : "Yes, remove it"}</button>
                <button type="button" className="v-btn v-sm" disabled={busy} onClick={() => setAsking(false)}>Keep it</button>
              </div>
            </div>
          ) : (
            <div><button type="button" className="v-btn v-sm" onClick={() => setAsking(true)}>Remove loan (entered by mistake)</button></div>
          )}
        </section>
      ) : null}
    </div>
  );
}
