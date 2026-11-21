"use client";

import { useOptimistic, useState, useTransition } from "react";
import { deleteRule, savePaydays, setNotifCapture } from "@/app/(v13)/settings/actions";
import type { FormState } from "@/lib/form-state";

function useAct() {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, start] = useTransition();
  const act = (fn: () => Promise<FormState>, ok: string) => start(async () => { const r = await fn(); setMsg(r.error ? { ok: false, text: r.error } : { ok: true, text: ok }); });
  return { msg, busy, act };
}
const Msg = ({ msg }: { msg: { ok: boolean; text: string } | null }) =>
  msg ? <p className={`v-flag ${msg.ok ? "" : "v-bad"}`} role="status" style={msg.ok ? { background: "var(--tint)", color: "var(--accent-text)", margin: 0 } : { margin: 0 }}>{msg.text}</p> : null;

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
        <label className="v-field">First payday<select value={a} onChange={(e) => setA(Number(e.target.value))}>{Array.from({ length: 27 }, (_, i) => i + 1).map((d) => <option key={d} value={d}>{ord(d)}</option>)}</select></label>
        <label className="v-field">Second payday<select value={b} onChange={(e) => setB(Number(e.target.value))}>{Array.from({ length: 27 }, (_, i) => i + 2).map((d) => <option key={d} value={d}>{ord(d)}</option>)}</select></label>
      </div>
      <p className="v-xs v-muted" style={{ margin: 0 }}>Cutoffs run payday to payday: paid the {ord(a)} covers the {ord(a + 1)}–{ord(b - 1)}; paid the {ord(b)} covers the {ord(b)}–{ord(a)} of next month.</p>
      <div className="v-row v-wrap"><button type="button" className="v-btn v-sm v-pri" disabled={p.busy} onClick={() => p.act(() => savePaydays({ first: a, second: b }), "Saved.")}>Save paydays</button></div>
      <Msg msg={p.msg} />
    </section>
  );
}

/** Phone notification capture and the merchant rules you have made. */
export function NotificationsCard({ enabled, rules: rulesIn }: { enabled: boolean; rules: { id: string; pattern: string; category: string }[] }) {
  const [on, setOn] = useState(enabled);
  const n = useAct();
  // A deleted rule leaves the list at once; the server catches up behind it.
  const [rules, drop] = useOptimistic(rulesIn, (cur, id: string) => cur.filter((x) => x.id !== id));
  const [ruleMsg, setRuleMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [, startRule] = useTransition();
  const removeRule = (id: string) =>
    startRule(async () => {
      setRuleMsg(null);
      drop(id);
      const res = await deleteRule(id);
      if (res.error) setRuleMsg({ ok: false, text: res.error });
    });
  return (
    <section className="v-card v-stack" aria-labelledby="nt">
      <h2 id="nt">Phone notifications</h2>
      <div className="v-row v-sp">
        <div><b>Read bank and wallet notifications</b><div className="v-xs v-muted">GCash, Maya, BPI. Only amount, merchant and time leave the phone. The phone app is a later part of the rehaul; this switch is saved for when it arrives.</div></div>
        <button type="button" className="v-sw" role="switch" aria-checked={on} aria-label="Read notifications" disabled={n.busy} onClick={() => { const next = !on; setOn(next); n.act(() => setNotifCapture(next), "Saved."); }} />
      </div>
      <Msg msg={n.msg} />
      <div>
        <b>Rules</b>
        <div className="v-xs v-muted" style={{ marginBottom: 6 }}>Made from the Inbox with &quot;Always put this here&quot;.</div>
        {rules.length === 0 ? <p className="v-muted v-sm" style={{ margin: 0 }}>No rules yet.</p> : rules.map((x) => (
          <div key={x.id} className="v-row v-sp" style={{ padding: "6px 0", borderBottom: "1px solid var(--line)" }}>
            <span><b>{x.pattern}</b> → {x.category}</span>
            <button type="button" className="v-btn v-sm v-ghost" onClick={() => { if (window.confirm(`Delete the rule for ${x.pattern}?`)) removeRule(x.id); }}>Delete</button>
          </div>
        ))}
        <div style={{ marginTop: 8 }}><Msg msg={ruleMsg} /></div>
      </div>
    </section>
  );
}
