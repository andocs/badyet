"use client";

import { useOptimistic, useState, useTransition } from "react";
import { deleteRule, savePaydays, setNotifCapture } from "@/app/(v13)/settings/actions";
import type { FormState } from "@/lib/form-state";
import { useConfirm, useToast } from "./feedback";
import { DayOfMonth } from "./pickers";

/** Runs a server action and reports the result as a toast, so every save looks the same. */
function useAct() {
  const toast = useToast();
  const [busy, start] = useTransition();
  const act = (fn: () => Promise<FormState>, ok: string) => start(async () => { const r = await fn(); toast(r.error ?? ok, r.error ? "bad" : "ok"); });
  return { busy, act };
}

const ord = (n: number) => `${n}${n % 10 === 1 && n !== 11 ? "st" : n % 10 === 2 && n !== 12 ? "nd" : n % 10 === 3 && n !== 13 ? "rd" : "th"}`;

/** Paydays. The office-day amount is worked out from the RTO lines on Budget, so it is not set here. */
export function PaydaysCard({ first, second }: { first: number; second: number }) {
  const [a, setA] = useState(first);
  const [b, setB] = useState(second);
  const p = useAct();
  return (
    <section className="v-card v-stack" aria-labelledby="pd">
      <h2 id="pd">Paydays</h2>
      <div className="v-grid2">
        <div className="v-field">First payday<DayOfMonth label="First payday" value={a} min={1} max={27} onChange={setA} /></div>
        <div className="v-field">Second payday<DayOfMonth label="Second payday" value={b} min={2} max={28} onChange={setB} /></div>
      </div>
      <p className="v-xs v-muted" style={{ margin: 0 }}>Cutoffs run payday to payday: paid the {ord(a)} covers the {ord(a + 1)}–{ord(b - 1)}; paid the {ord(b)} covers the {ord(b)}–{ord(a)} of next month.</p>
      <div className="v-row v-wrap"><button type="button" className="v-btn v-sm v-pri" disabled={p.busy} onClick={() => p.act(() => savePaydays({ first: a, second: b }), "Paydays saved.")}>Save paydays</button></div>
    </section>
  );
}

/** Phone notification capture and the merchant rules you have made. */
export function NotificationsCard({ enabled, rules: rulesIn }: { enabled: boolean; rules: { id: string; pattern: string; category: string }[] }) {
  const [on, setOn] = useState(enabled);
  const n = useAct();
  const ask = useConfirm();
  const toast = useToast();
  // A deleted rule leaves the list at once; the server catches up behind it.
  const [rules, drop] = useOptimistic(rulesIn, (cur, id: string) => cur.filter((x) => x.id !== id));
  const [, startRule] = useTransition();
  const removeRule = (id: string) =>
    startRule(async () => {
      drop(id);
      const res = await deleteRule(id);
      if (res.error) toast(res.error, "bad");
      else toast("Rule deleted.");
    });
  return (
    <section className="v-card v-stack" aria-labelledby="nt">
      <h2 id="nt">Phone notifications</h2>
      <div className="v-row v-sp">
        <div><b>Read bank and wallet notifications</b><div className="v-xs v-muted">GCash, Maya, BPI. Only amount, merchant and time leave the phone. The phone app is a later part of the rehaul; this switch is saved for when it arrives.</div></div>
        <button type="button" className="v-sw" role="switch" aria-checked={on} aria-label="Read notifications" disabled={n.busy} onClick={() => { const next = !on; setOn(next); n.act(() => setNotifCapture(next), "Saved."); }} />
      </div>
      <div>
        <b>Rules</b>
        <div className="v-xs v-muted" style={{ marginBottom: 6 }}>Made from the Inbox with &quot;Always put this here&quot;.</div>
        {rules.length === 0 ? <p className="v-muted v-sm" style={{ margin: 0 }}>No rules yet.</p> : rules.map((x) => (
          <div key={x.id} className="v-row v-sp" style={{ padding: "6px 0", borderBottom: "1px solid var(--line)" }}>
            <span><b>{x.pattern}</b> → {x.category}</span>
            <button type="button" className="v-btn v-sm v-ghost" onClick={async () => { if (await ask({ title: "Delete this rule?", message: `Transactions from ${x.pattern} will no longer be sorted automatically.`, confirmLabel: "Delete", danger: true })) removeRule(x.id); }}>Delete</button>
          </div>
        ))}
      </div>
    </section>
  );
}
