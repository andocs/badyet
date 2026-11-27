"use client";

import { useState, useTransition } from "react";
import { paybackLoan, postponePayback } from "@/app/(v13)/lending/actions";
import type { IsoDate } from "@/lib/domain/dates";
import { dueBadge, paybackAmount, paybackEffect, paybackInput, pesoText, promptDetail, receivedOptions } from "@/lib/lending/forms";
import type { PaybackChoice } from "@/lib/lending/load";
import { dueChips, outstandingOf, type Loan } from "@/lib/lending/model";
import { DateChips } from "./fields";
import { Pick } from "../pick";
import { DatePicker } from "../pickers";

export interface PaybackContext {
  /** Money in from the last weeks that no loan uses yet. */
  choices: PaybackChoice[];
  accounts: { id: string; name: string }[];
  today: IsoDate;
  paydays: { first: number; second: number };
}

type Mode = "ask" | "full" | "part" | "postpone";

/** Paid in full, part of it, or postponed (which needs a new date). Used by the Now card and the Lending page. */
export function LoanActions({ loan, ctx, onDone }: { loan: Loan; ctx: PaybackContext; onDone?: () => void }) {
  const owed = outstandingOf(loan);
  const next = dueChips(ctx.today, ctx.paydays).find((c) => c.date > ctx.today)!.date;
  const [mode, setMode] = useState<Mode>("ask");
  const [received, setReceived] = useState("");
  const [amount, setAmount] = useState("");
  const [nextDue, setNextDue] = useState<string>(next);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();

  const options = mode === "full" || mode === "part" ? receivedOptions(ctx.choices, ctx.accounts, owed, mode === "full", ctx.today) : [];
  const key = options.some((o) => o.key === received) ? received : (options[0]?.key ?? "cash");
  const fromInbox = key.startsWith("txn:");
  const part = mode === "part" ? paybackAmount(ctx.choices, key, amount) : null;

  const open = (m: Mode) => { setMode(m); setReceived(""); setError(null); };
  const run = (go: () => Promise<{ error?: string }>) =>
    start(async () => {
      setError(null);
      const r = await go();
      if (r.error) setError(r.error);
      else { setMode("ask"); onDone?.(); }
    });
  const save = () =>
    run(() => paybackLoan(paybackInput(loan.id, key, mode === "full" ? (owed / 100).toFixed(2) : amount, mode === "part" && part !== null && part < owed ? nextDue : null)));

  const arrived = (
    <div className="v-field">
      Where did the money arrive?
      <Pick label="Where did the money arrive?" value={key} onChange={setReceived} options={options.map((o) => ({ value: o.key, label: o.label }))} />
      <span className="v-xs" style={{ fontWeight: 500 }}>Picking the Inbox item stops it being counted twice, or as income.</span>
    </div>
  );
  const buttons = (label: string, onClick: () => void) => (
    <div className="v-row v-wrap" style={{ justifyContent: "flex-end", gap: 8 }}>
      <button type="button" className="v-btn v-sm" disabled={busy} onClick={() => open("ask")}>Cancel</button>
      <button type="button" className="v-btn v-sm v-pri" disabled={busy} onClick={onClick}>{busy ? "Saving…" : label}</button>
    </div>
  );

  return (
    <div className="v-stack" style={{ gap: 10 }}>
      {mode === "ask" ? (
        <div className="v-row v-wrap" style={{ gap: 8 }}>
          <button type="button" className="v-btn v-sm v-pri" onClick={() => open("full")}>Paid in full</button>
          <button type="button" className="v-btn v-sm" onClick={() => open("part")}>Part of it</button>
          <button type="button" className="v-btn v-sm" onClick={() => open("postpone")}>Postponed</button>
        </div>
      ) : null}
      {mode === "full" ? (
        <>
          {arrived}
          <div className="v-testbox"><div className="v-sm">{paybackEffect(loan.from, owed, owed, loan.borrower, null)}</div></div>
          {buttons(`Save ${pesoText(owed)} as paid`, save)}
        </>
      ) : null}
      {mode === "part" ? (
        <>
          {arrived}
          {fromInbox ? null : <label className="v-field">Amount received (₱)<input value={amount} inputMode="decimal" onChange={(e) => setAmount(e.target.value)} /></label>}
          <div className="v-field">
            {part !== null && part < owed ? `When will the other ${pesoText(owed - part)} come?` : "When will the rest come?"}
            <DatePicker label="When the rest will come" value={nextDue} min={ctx.today} onChange={setNextDue} />
          </div>
          {part !== null && part <= owed ? <div className="v-testbox"><div className="v-sm">{paybackEffect(loan.from, part, owed, loan.borrower, nextDue)}</div></div> : null}
          {buttons("Save", save)}
        </>
      ) : null}
      {mode === "postpone" ? (
        <>
          <div className="v-field">When will {loan.borrower} pay you now?<DatePicker label="New expected date" value={nextDue} min={ctx.today} onChange={setNextDue} /></div>
          <DateChips ctx={ctx} value={nextDue} onPick={setNextDue} weeks={1} />
          <label className="v-field">Note (optional)<input value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} /></label>
          <div className="v-xs v-muted">A date is required. The card comes back on that day.</div>
          {buttons("Postpone", () => run(() => postponePayback({ loanId: loan.id, newDue: nextDue, note })))}
        </>
      ) : null}
      {error ? <p className="v-flag v-bad" role="alert" style={{ margin: 0 }}>{error}</p> : null}
    </div>
  );
}

/** "Did Sam pay you back?": shown on Now from the expected day until you answer. */
export function DueCard({ loan, ctx }: { loan: Loan; ctx: PaybackContext }) {
  const badge = dueBadge(loan, ctx.today);
  return (
    <section className="v-card v-stack v-due" aria-label={`Payback due from ${loan.borrower}`} style={{ gap: 10 }}>
      <div className="v-row v-sp v-wrap">
        <h2>Did {loan.borrower} pay you back?</h2>
        <span className="v-pill v-warn">{badge.text}</span>
      </div>
      <div className="v-sm">{promptDetail(loan)}</div>
      <LoanActions loan={loan} ctx={ctx} />
    </section>
  );
}
