"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { editInboxItem } from "@/app/(v13)/inbox/actions";
import { manilaFields } from "@/lib/inbox/edit";
import { parsePesos } from "@/lib/domain/money";
import { editLending, loanOfTxn, pesoText, withSource, type Filed } from "@/lib/lending/forms";
import { dueChips, outstandingOf, type Loan } from "@/lib/lending/model";
import { sourceKey } from "@/lib/lending/sources";
import { LendFields, newDraft, type LendContext, type LendDraft } from "./lending/fields";
import { Pick } from "./pick";
import { DatePicker } from "./pickers";

export interface EditableItem {
  id: string;
  who: string;
  /** Centavos; negative = money out. */
  amount: number;
  accountId: string;
  account: string;
  categoryId: string | null;
  occurredAt: string;
  kind: "expense" | "income" | "transfer";
  note: string | null;
  /** For a transfer: the other account of yours, when there is one. */
  peerAccount?: string | null;
  /** "Others": whose account it went to. */
  otherOwner?: string | null;
}

/** What the edit form needs to file an item as a loan or a payback; null before the database has lending. */
export type EditLendingContext = { lend: LendContext; open: Loan[]; loans: Loan[] } | null;

/**
 * Change an Inbox item: its name, amount, direction, account, date and time, note and how it is filed. A move between your accounts keeps
 * its two accounts. A loan or payback keeps its loan in step.
 */
export function InboxEditForm({ t, accounts, categories, lending, onSaved, onCancel }: { t: EditableItem; accounts: { id: string; name: string }[]; categories: { id: string; name: string }[]; lending: EditLendingContext; onSaved: () => void; onCancel: () => void }) {
  const when = manilaFields(t.occurredAt);
  const [merchant, setMerchant] = useState(t.kind === "transfer" && /^Transfer (in|out)$/.test(t.who) ? "" : t.who === "Expense" ? "" : t.who);
  const [amount, setAmount] = useState((Math.abs(t.amount) / 100).toFixed(2));
  const [direction, setDirection] = useState<"in" | "out">(t.amount < 0 ? "out" : "in");
  const [accountId, setAccountId] = useState(t.accountId);
  const [categoryId, setCategoryId] = useState(t.categoryId ?? "");
  const [date, setDate] = useState(when.date);
  const [time, setTime] = useState(when.time);
  const [note, setNote] = useState(t.note ?? "");
  const [otherOwner, setOtherOwner] = useState(t.otherOwner ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const paired = !!t.peerAccount;
  const link = lending && !paired ? loanOfTxn(lending.loans, t.id) : null;
  const [filed, setFiled] = useState<Filed>(link ? (link.role === "lent" ? "loan" : "payback") : "normal");
  const [draft, setDraft] = useState<LendDraft | null>(() => (link?.role === "lent" ? { borrower: link.loan.borrower, dueOn: link.loan.dueOn, fromKey: sourceKey(link.loan.from) } : null));
  const [loanId, setLoanId] = useState(link?.role === "payback" ? link.loan.id : "");
  const [restDue, setRestDue] = useState<string | null>(null);
  // A transfer taken out of its loan becomes ordinary money again, so it gets a direction and a category.
  const isTransfer = t.kind === "transfer" && !(link && filed === "normal");
  const shownDirection = filed === "loan" ? "out" : filed === "payback" ? "in" : isTransfer ? (t.amount < 0 ? "out" : "in") : direction;
  // Money out with no other account of yours on the far side may have gone to someone else.
  const askOwner = !paired && shownDirection === "out" && filed !== "loan";

  // The loans a payback can be for: those still owed, and the one it already belongs to.
  const payable = lending ? [...(link?.role === "payback" && !lending.open.some((l) => l.id === link.loan.id) ? [link.loan] : []), ...lending.open] : [];
  const chosen = payable.find((l) => l.id === loanId) ?? payable[0] ?? null;
  const sameLoan = link?.role === "payback" && chosen?.id === link.loan.id;
  const centavos = parsePesos(amount.trim()) ?? null;
  const owed = chosen ? outstandingOf(chosen) : 0;
  const rest = filed === "payback" && !sameLoan && centavos !== null && centavos < owed ? owed - centavos : 0;
  const nextDue = restDue ?? (lending ? dueChips(lending.lend.today, lending.lend.paydays).find((d) => d.date > lending.lend.today)!.date : "");
  const loanDraft = lending ? (draft ?? newDraft(lending.lend)) : null;
  const choices: [Filed, string][] = [["normal", "Not a loan"], ...(shownDirection === "out" ? [["loan", "Lending"] as [Filed, string]] : payable.length > 0 ? [["payback", "Loan payback"] as [Filed, string]] : [])];

  const save = () =>
    start(async () => {
      setError(null);
      const about = lending && !paired ? editLending(filed, link !== null, loanDraft!, { loanId: chosen?.id ?? "", nextDue: rest > 0 ? nextDue : null }) : undefined;
      const r = await editInboxItem({ id: t.id, merchant, amount, direction: shownDirection, accountId, categoryId: isTransfer || filed !== "normal" ? undefined : categoryId || null, date, time, note, ...(askOwner && otherOwner.trim() !== (t.otherOwner ?? "") ? { otherOwner } : {}), ...(about ? { lending: about } : {}) });
      if (r.error) setError(r.error);
      else onSaved();
    });

  return (
    <div className="v-stack" style={{ gap: 12 }}>
      <label className="v-field">Name<input value={merchant} maxLength={80} placeholder="Who it was with" onChange={(e) => setMerchant(e.target.value)} /></label>
      <div className="v-grid2">
        <label className="v-field">Amount (₱)<input value={amount} inputMode="decimal" onChange={(e) => setAmount(e.target.value)} /></label>
        {isTransfer || filed !== "normal" ? null : (
          <div>
            <div className="v-lab">Money</div>
            <div className="v-seg" role="group" aria-label="Direction" style={{ marginTop: 6 }}>
              <button type="button" aria-pressed={direction === "out"} onClick={() => setDirection("out")}>Went out</button>
              <button type="button" aria-pressed={direction === "in"} onClick={() => setDirection("in")}>Came in</button>
            </div>
          </div>
        )}
      </div>
      {paired ? (
        <p className="v-xs v-muted" style={{ margin: 0 }}>A move between your accounts keeps both sides, so the amount, time and note change on both.</p>
      ) : (
        <div>
          <div className="v-lab">Account</div>
          <div style={{ marginTop: 6 }}><Pick label="Account" value={accountId} placeholder="Pick an account" options={accounts.map((a) => ({ value: a.id, label: a.name }))} onChange={setAccountId} /></div>
        </div>
      )}
      {lending && !paired && choices.length > 1 ? (
        <div>
          <div className="v-lab">Lending</div>
          <div className="v-seg" role="group" aria-label="Lending" style={{ marginTop: 6 }}>
            {choices.map(([value, text]) => <button key={value} type="button" aria-pressed={filed === value} onClick={() => setFiled(value)}>{text}</button>)}
          </div>
        </div>
      ) : null}
      {link ? (
        <p className="v-xs v-muted" style={{ margin: 0 }}>
          {filed === "normal" ? (link.role === "lent" ? "Saving removes this loan. One that has paybacks has to be removed on the Lending page. " : "Saving removes this payback, so the money is owed again. ") : "This is part of a loan: a new amount or date changes the loan too. "}
          <Link href="/lending">Open Lending</Link>
        </p>
      ) : null}
      {lending && filed === "loan" ? <LendFields ctx={link?.role === "lent" ? { ...lending.lend, sources: withSource(lending.lend.sources, link.loan.from) } : lending.lend} draft={loanDraft!} onChange={setDraft} amount={centavos} minDue={date} /> : null}
      {lending && filed === "payback" && chosen ? (
        <>
          <div className="v-field">Whose payback?<Pick label="Whose payback?" value={chosen.id} onChange={setLoanId} options={payable.map((l) => ({ value: l.id, label: outstandingOf(l) > 0 ? `${l.borrower} · ${pesoText(outstandingOf(l))} still owed` : `${l.borrower} · paid` }))} /></div>
          {rest > 0 ? <div className="v-field">When will the other {pesoText(rest)} come?<DatePicker label="When the rest will come" value={nextDue} min={lending.lend.today} onChange={setRestDue} /></div> : null}
        </>
      ) : null}
      {isTransfer || filed !== "normal" ? null : (
        <div>
          <div className="v-lab">Category</div>
          <div style={{ marginTop: 6 }}><Pick label="Category" value={categoryId} placeholder="No category" options={[{ value: "", label: "No category" }, ...categories.map((c) => ({ value: c.id, label: c.name }))]} onChange={setCategoryId} /></div>
        </div>
      )}
      {askOwner ? <label className="v-field">Others: whose account did it go to? (optional)<input value={otherOwner} maxLength={80} placeholder="Only for someone else's account" onChange={(e) => setOtherOwner(e.target.value)} /></label> : null}
      <div className="v-grid2">
        <div className="v-field">Date<DatePicker label="Date" value={date} onChange={setDate} /></div>
        <label className="v-field">Time (24-hour, Philippine time)<input value={time} inputMode="numeric" maxLength={5} placeholder="14:05" onChange={(e) => setTime(e.target.value)} /></label>
      </div>
      <label className="v-field">Note<input value={note} maxLength={200} placeholder="Add a note (optional)" onChange={(e) => setNote(e.target.value)} /></label>
      {error ? <p className="v-flag v-bad" role="alert" style={{ margin: 0 }}>{error}</p> : null}
      <div className="v-row v-wrap" style={{ gap: 10 }}>
        <button type="button" className="v-btn v-pri v-grow" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save changes"}</button>
        <button type="button" className="v-btn" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
