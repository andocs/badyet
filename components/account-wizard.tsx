"use client";

import { useState } from "react";
import { KIND_LABEL, KINDS, parseLast4, type Kind } from "@/lib/accounts/input";

const BLURB: Record<Kind, string> = {
  ewallet: "GCash, Maya and the like",
  debit: "A bank account you spend from",
  credit: "A card you pay off later",
};

// Add an account one question at a time. Every input stays in the form, so the last step submits everything.
export function AccountWizard({ action }: { action: (formData: FormData) => void | Promise<void> }) {
  const [step, setStep] = useState(1);
  const [kind, setKind] = useState<Kind | "">("");
  const [name, setName] = useState("");
  const [institution, setInstitution] = useState("");
  const [last4, setLast4] = useState("");
  const [balance, setBalance] = useState("");
  const [creditLimit, setCreditLimit] = useState("");
  const [statementDay, setStatementDay] = useState("");
  const [dueDay, setDueDay] = useState("");

  const last4Ok = parseLast4(last4).ok;
  const credit = kind === "credit";
  const can2 = name.trim().length > 0 && last4Ok;

  return (
    <form action={action} className="form" aria-label="Add an account">
      <div className="steps" role="progressbar" aria-label="Add account steps" aria-valuemin={1} aria-valuemax={4} aria-valuenow={step} style={{ display: "flex", gap: 6 }}>
        {[1, 2, 3, 4].map((n) => (
          <i key={n} style={{ flex: 1, height: 5, borderRadius: 999, background: n <= step ? "var(--accent)" : "var(--soft)" }} />
        ))}
      </div>

      <div hidden={step !== 1} style={{ display: step === 1 ? "grid" : "none", gap: 10 }}>
        <h3 style={{ margin: "6px 0 0" }}>What kind of account?</h3>
        <fieldset style={{ border: 0, padding: 0, margin: 0, display: "grid", gap: 10 }}>
          <legend className="sr-only" style={{ position: "absolute", left: -9999 }}>Account kind</legend>
          {KINDS.map((k) => (
            <label key={k} className="card" style={{ display: "flex", gap: 12, alignItems: "center", cursor: "pointer", borderColor: kind === k ? "var(--accent)" : undefined, minHeight: 56 }}>
              <input type="radio" name="kind" value={k} checked={kind === k} onChange={() => setKind(k)} />
              <span>
                <b>{KIND_LABEL[k]}</b>
                <span className="lab" style={{ display: "block" }}>{BLURB[k]}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <button type="button" className="btn" disabled={kind === ""} onClick={() => setStep(2)}>Next</button>
      </div>

      <div hidden={step !== 2} style={{ display: step === 2 ? "grid" : "none", gap: 10 }}>
        <h3 style={{ margin: "6px 0 0" }}>Name it</h3>
        <label className="field"><span className="lab">Name</span><input className="input" name="name" maxLength={30} value={name} onChange={(e) => setName(e.target.value)} placeholder={credit ? "Visa" : "GCash"} /></label>
        <label className="field"><span className="lab">Bank or provider (optional)</span><input className="input" name="institution" maxLength={40} value={institution} onChange={(e) => setInstitution(e.target.value)} placeholder="BPI" /></label>
        <label className="field">
          <span className="lab">Last 4 digits (optional)</span>
          <input className="input" name="last4" inputMode="numeric" autoComplete="off" value={last4} onChange={(e) => setLast4(e.target.value)} placeholder="1234" aria-describedby="l4-help" aria-invalid={!last4Ok} />
        </label>
        <p id="l4-help" className="sub" style={{ margin: 0 }}>
          Only the last 4, just so you can tell cards apart. Never enter the full number, expiry, CVV or PIN: this app has no use for them and does not store them.
        </p>
        {!last4Ok && <p className="notice err" role="alert" style={{ margin: 0 }}>Enter exactly 4 digits, or leave it blank.</p>}
        <div className="ritual-actions" style={{ position: "static", background: "none", padding: 0 }}>
          <button type="button" className="btn" onClick={() => setStep(1)}>Back</button>
          <button type="button" className="btn pri" disabled={!can2} onClick={() => setStep(3)}>Next</button>
        </div>
      </div>

      <div hidden={step !== 3} style={{ display: step === 3 ? "grid" : "none", gap: 10 }}>
        <h3 style={{ margin: "6px 0 0" }}>{credit ? "How much do you owe now?" : "How much is in it now?"}</h3>
        <label className="field"><span className="lab">{credit ? "Amount owed" : "Balance"} (₱)</span><input className="input" name="balance" inputMode="decimal" value={balance} onChange={(e) => setBalance(e.target.value)} placeholder="0.00" /></label>
        {credit && (
          <>
            <label className="field"><span className="lab">Credit limit (optional)</span><input className="input" name="creditLimit" inputMode="decimal" value={creditLimit} onChange={(e) => setCreditLimit(e.target.value)} placeholder="50,000.00" /></label>
            <div className="form-grid">
              <label className="field"><span className="lab">Statement day (optional)</span><input className="input" name="statementDay" inputMode="numeric" value={statementDay} onChange={(e) => setStatementDay(e.target.value)} placeholder="5" /></label>
              <label className="field"><span className="lab">Payment due day (optional)</span><input className="input" name="dueDay" inputMode="numeric" value={dueDay} onChange={(e) => setDueDay(e.target.value)} placeholder="25" /></label>
            </div>
          </>
        )}
        <p className="sub" style={{ margin: 0 }}>You keep this up to date yourself. The app never connects to your bank.</p>
        <div className="ritual-actions" style={{ position: "static", background: "none", padding: 0 }}>
          <button type="button" className="btn" onClick={() => setStep(2)}>Back</button>
          <button type="button" className="btn pri" onClick={() => setStep(4)}>Review</button>
        </div>
      </div>

      <div hidden={step !== 4} style={{ display: step === 4 ? "grid" : "none", gap: 10 }}>
        <h3 style={{ margin: "6px 0 0" }}>Looks right?</h3>
        <div className="card">
          <b>{name.trim() || "Unnamed"}</b> <span className="pill quiet">{kind ? KIND_LABEL[kind] : ""}</span>
          <p className="sub" style={{ margin: "6px 0 0" }}>
            {[institution.trim(), last4.trim() && last4Ok ? `•••• ${last4.replace(/\D/g, "")}` : ""].filter(Boolean).join(" · ") || "No bank or digits added"}
          </p>
          <p style={{ margin: "8px 0 0" }}>{credit ? "Owed" : "Balance"}: ₱{balance.trim() || "0.00"}{credit && creditLimit.trim() ? ` of ₱${creditLimit.trim()} limit` : ""}</p>
        </div>
        <div className="ritual-actions" style={{ position: "static", background: "none", padding: 0 }}>
          <button type="button" className="btn" onClick={() => setStep(3)}>Back</button>
          <button type="submit" className="btn pri">Save account</button>
        </div>
      </div>
    </form>
  );
}
