"use client";

import { useState, useTransition } from "react";
import { sendBill, unsendBill } from "@/app/(v13)/actions";
import type { Bill } from "@/lib/now/summary";
import { V13Icon } from "./icons";
import { Money } from "./money";
import { Pick } from "./pick";

/** The cutoff's bills with Mark sent (pick the paying account, amount starts at the bill) and Undo. */
export function BillList({ bills, accounts }: { bills: Bill[]; accounts: { id: string; name: string }[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [from, setFrom] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();

  const open = (b: Bill) => {
    setError(null);
    setOpenId(b.lineId);
    setFrom("");
    setAmount((b.amount / 100).toFixed(2));
  };
  const save = (b: Bill) =>
    start(async () => {
      const r = await sendBill({ lineId: b.lineId, from, amount });
      if (r.error) setError(r.error);
      else setOpenId(null);
    });
  const undo = (b: Bill) =>
    start(async () => {
      setError(null);
      const r = await unsendBill(b.txnId!);
      if (r.error) setError(r.error);
    });

  return (
    <div style={{ marginTop: 6 }}>
      {bills.map((b) => (
        <div key={b.lineId} className="v-bl-w">
          <div className="v-bl-i">
            <span className="v-chk" aria-checked={b.sent} role="img" aria-label={b.sent ? "sent" : "not sent yet"}>
              <V13Icon name="check" />
            </span>
            <span className="v-grow">{b.name}</span>
            <b className="v-num"><Money value={b.amount} /></b>
            {b.sent ? (
              b.txnId ? <button type="button" className="v-btn v-sm v-ghost" disabled={busy} onClick={() => undo(b)} aria-label={`Undo sent for ${b.name}`}>Undo</button> : null
            ) : (
              <button type="button" className="v-btn v-sm" disabled={busy} aria-expanded={openId === b.lineId} onClick={() => (openId === b.lineId ? setOpenId(null) : open(b))}>Mark sent</button>
            )}
          </div>
          {openId === b.lineId ? (
            <div className="v-stack v-bl-f">
              <div className="v-row v-wrap" style={{ gap: 10 }}>
                <div className="v-field v-grow">
                  Paid from
                  <Pick label="Paid from" value={from} options={[{ value: "", label: "Pick an account" }, ...accounts.map((a) => ({ value: a.id, label: a.id === b.accountId ? `${a.name} (the bill's own account)` : a.name }))]} onChange={setFrom} />
                </div>
                <label className="v-field" style={{ width: 140 }}>
                  Amount
                  <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
                </label>
              </div>
              <p className="v-xs v-muted" style={{ margin: 0 }}>
                {from === "" ? "The money really moves: balances change." : from === b.accountId ? "Recorded as spending from that account, in the bill's category." : "Recorded as a transfer into the bill's account."}
              </p>
              <div className="v-row" style={{ gap: 8 }}>
                <button type="button" className="v-btn v-pri v-sm" disabled={busy || from === ""} onClick={() => save(b)}>Mark sent</button>
                <button type="button" className="v-btn v-sm" onClick={() => setOpenId(null)}>Cancel</button>
              </div>
            </div>
          ) : null}
        </div>
      ))}
      {error ? <p className="v-flag v-bad" role="alert" style={{ marginTop: 8 }}>{error}</p> : null}
    </div>
  );
}
