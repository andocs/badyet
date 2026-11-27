"use client";

import { useState, useTransition } from "react";
import { editInboxItem } from "@/app/(v13)/inbox/actions";
import { manilaFields } from "@/lib/inbox/edit";
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

/** Change an Inbox item: its name, amount, direction, account, date and time, and note. A transfer keeps its two accounts. */
export function InboxEditForm({ t, accounts, categories, onSaved, onCancel }: { t: EditableItem; accounts: { id: string; name: string }[]; categories: { id: string; name: string }[]; onSaved: () => void; onCancel: () => void }) {
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
  const isTransfer = t.kind === "transfer";
  // Money out with no other account of yours on the far side may have gone to someone else.
  const askOwner = !t.peerAccount && (isTransfer ? t.amount < 0 : direction === "out");

  const save = () =>
    start(async () => {
      setError(null);
      const r = await editInboxItem({ id: t.id, merchant, amount, direction, accountId, categoryId: isTransfer ? undefined : categoryId || null, date, time, note, ...(askOwner && otherOwner.trim() !== (t.otherOwner ?? "") ? { otherOwner } : {}) });
      if (r.error) setError(r.error);
      else onSaved();
    });

  return (
    <div className="v-stack" style={{ gap: 12 }}>
      <label className="v-field">Name<input value={merchant} maxLength={80} placeholder="Who it was with" onChange={(e) => setMerchant(e.target.value)} /></label>
      <div className="v-two">
        <label className="v-field">Amount (₱)<input value={amount} inputMode="decimal" onChange={(e) => setAmount(e.target.value)} /></label>
        {isTransfer ? null : (
          <div>
            <div className="v-lab">Money</div>
            <div className="v-seg" role="group" aria-label="Direction" style={{ marginTop: 6 }}>
              <button type="button" aria-pressed={direction === "out"} onClick={() => setDirection("out")}>Went out</button>
              <button type="button" aria-pressed={direction === "in"} onClick={() => setDirection("in")}>Came in</button>
            </div>
          </div>
        )}
      </div>
      {isTransfer ? (
        <p className="v-xs v-muted" style={{ margin: 0 }}>A move between your accounts keeps both sides, so the amount, time and note change on both.</p>
      ) : (
        <div>
          <div className="v-lab">Account</div>
          <div style={{ marginTop: 6 }}><Pick label="Account" value={accountId} placeholder="Pick an account" options={accounts.map((a) => ({ value: a.id, label: a.name }))} onChange={setAccountId} /></div>
        </div>
      )}
      {isTransfer ? null : (
        <div>
          <div className="v-lab">Category</div>
          <div style={{ marginTop: 6 }}><Pick label="Category" value={categoryId} placeholder="No category" options={[{ value: "", label: "No category" }, ...categories.map((c) => ({ value: c.id, label: c.name }))]} onChange={setCategoryId} /></div>
        </div>
      )}
      {askOwner ? <label className="v-field">Others: whose account did it go to? (optional)<input value={otherOwner} maxLength={80} placeholder="Only for someone else's account" onChange={(e) => setOtherOwner(e.target.value)} /></label> : null}
      <div className="v-two">
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
