"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { chooseWallet, choosePayAccount, sendRest, tickLine, undoTransfer, untickLine } from "@/app/(v13)/pay-checklist/actions";
import type { ChecklistData } from "@/lib/bills/load";
import { restOf, type ChecklistLineOut, type WalletOut } from "@/lib/bills/checklist";
import { money } from "@/lib/domain/money";
import { V13Icon } from "./icons";
import { Money } from "./money";

type Ready = Extract<ChecklistData, { kind: "ready" }>;

const HOW: Record<string, string> = { covered: "covered by a transfer", payroll: "already in your payroll account", ticked: "sent" };

/** The pay checklist: each wallet's lines with a tick, "Send the rest" for a wallet, and the transfers the app detected tick lines by themselves. */
export function PayChecklistView({ data }: { data: Ready }) {
  const { checklist, payrollId, accounts } = data;
  const name = (id: string) => accounts.find((a) => a.id === id)?.name ?? "Account";
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const run = (fn: () => Promise<{ error?: string }>) =>
    start(async () => {
      setError(null);
      const r = await fn();
      if (r.error) setError(r.error);
    });

  const tick = (l: ChecklistLineOut) => {
    if (!payrollId) return setError("Pick the account your pay lands in first.");
    if (l.how === "ticked" && l.txnId) return run(() => untickLine(l.txnId!));
    if (!l.sent) run(() => tickLine({ lineId: l.id, from: payrollId, amount: (l.amount / 100).toFixed(2) }));
  };
  const pct = checklist.total > 0 ? Math.round((checklist.sent / checklist.total) * 100) : 0;
  const tab = (c: "first" | "second", label: string, href: string) => (
    <Link href={href} className="v-segl" aria-current={data.cutoff === c ? "true" : undefined}>{label}{data.currentCutoff === c ? " (now)" : ""}</Link>
  );

  return (
    <div className="v-stack v-l">
      <div className="v-row v-sp v-wrap">
        <div>
          <h1>Pay checklist</h1>
          <div className="v-lbl">Move money from your payroll account to each wallet. Tick a line when it is sent: the transfer is recorded and your balances move. Transfers the app spots in your notifications and emails tick lines by themselves.</div>
        </div>
        <div className="v-seg" role="group" aria-label="Cutoff">
          {tab("first", "1st cutoff", "/pay-checklist?c=1")}
          {tab("second", "2nd cutoff", "/pay-checklist?c=2")}
        </div>
      </div>

      <section className="v-card v-stack" aria-label="Progress" style={{ gap: 10 }}>
        <div className="v-row v-sp v-wrap" style={{ gap: 16 }}>
          <label className="v-field" style={{ minWidth: 240 }}>
            Send from
            <select value={payrollId ?? ""} disabled={busy} onChange={(e) => e.target.value && run(() => choosePayAccount(e.target.value))}>
              <option value="">Pick the account your pay lands in</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </label>
          <div style={{ flex: 1, minWidth: 240 }}>
            <div className="v-row v-sp"><b>{checklist.sentCount} of {checklist.lineCount} sent</b><span className="v-num"><Money value={checklist.sent} /> of <Money value={checklist.total} /></span></div>
            <div className="v-bar" role="img" aria-label={`${pct} percent sent`}><i style={{ width: `${pct}%` }} /></div>
          </div>
        </div>
        {!payrollId ? <p className="v-xs v-muted" style={{ margin: 0 }}>Remembered for next time, and set automatically when you confirm your pay on Now.</p> : null}
      </section>
      {error ? <p className="v-flag v-bad" role="alert">{error}</p> : null}

      {checklist.wallets.length === 0 ? (
        <div className="v-note">No budget line has a wallet yet. Pick a wallet for a line below and it shows up here.</div>
      ) : (
        <div className="v-ckgrid">
          {checklist.wallets.map((w) => <WalletCard key={w.walletId} w={w} name={name(w.walletId)} payrollId={payrollId} busy={busy} onTick={tick} run={run} />)}
        </div>
      )}

      {data.unassigned.length > 0 ? (
        <details className="v-card">
          <summary><b>No wallet yet</b> · {data.unassigned.length} line{data.unassigned.length === 1 ? "" : "s"}, <Money value={money(data.unassigned.reduce((t, l) => t + l.amount, 0))} /></summary>
          <p className="v-xs v-muted" style={{ margin: "8px 0" }}>Pick where each line&apos;s money goes. The wallet is remembered on the budget line.</p>
          {data.unassigned.map((l) => (
            <div key={l.id} className="v-ckl">
              <span className="v-grow">{l.name}</span>
              <span className="v-num"><Money value={l.amount} /></span>
              <select aria-label={`Wallet for ${l.name}`} value="" disabled={busy} onChange={(e) => e.target.value && run(() => chooseWallet(l.id, e.target.value))}>
                <option value="">Pick a wallet</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          ))}
        </details>
      ) : null}
    </div>
  );
}

function WalletCard({ w, name, payrollId, busy, onTick, run }: { w: WalletOut; name: string; payrollId: string | null; busy: boolean; onTick: (l: ChecklistLineOut) => void; run: (fn: () => Promise<{ error?: string }>) => void }) {
  const pct = w.total > 0 ? Math.round((w.sent / w.total) * 100) : 0;
  const isPayroll = w.walletId === payrollId;
  const rest = restOf(w);
  const sentCount = w.lines.filter((l) => l.sent).length;
  return (
    <section className={`v-wal ${w.rest === 0 ? "v-dn" : ""}`} aria-label={name}>
      <div className="v-row v-sp"><h2>{name}{isPayroll ? <span className="v-pill v-est" style={{ marginLeft: 8 }}>payroll account</span> : null}</h2><b className="v-num"><Money value={w.total} /></b></div>
      <div className="v-row v-sp v-wrap">
        <span className="v-xs v-muted">{sentCount} of {w.lines.length} sent · <Money value={w.sent} /> of <Money value={w.total} /></span>
        {!isPayroll && rest.amount > 0 ? (
          <button type="button" className={`v-btn v-sm ${w.sent === 0 ? "v-pri" : ""}`} disabled={busy || !payrollId} onClick={() => run(() => sendRest({ from: payrollId!, to: w.walletId, amount: rest.amount }))}>
            {w.sent === 0 ? "Send all " : "Send the rest "}<Money value={rest.amount} />
          </button>
        ) : null}
      </div>
      <div className="v-bar" role="img" aria-label={`${name}: ${pct} percent sent`}><i style={{ width: `${pct}%` }} /></div>
      <div>
        {w.lines.map((l) => (
          <div key={l.id} className={`v-ckl ${l.sent ? "v-dn" : ""}`}>
            <button type="button" className="v-ckb" aria-pressed={l.sent} disabled={busy || (l.sent && l.how !== "ticked")} onClick={() => onTick(l)}
              aria-label={l.sent ? `${l.name}: ${HOW[l.how ?? "ticked"]}${l.how === "ticked" ? ". Tap to undo" : ""}` : `Mark ${l.name} sent`} title={l.sent ? HOW[l.how ?? "ticked"] : undefined}>
              <V13Icon name="check" />
            </button>
            <span className="v-grow v-ckn">{l.name}{l.reimbursed ? <span className="v-pill v-warn" style={{ marginLeft: 8 }}>reimbursed later</span> : null}{l.pending ? <span className="v-pill v-est" style={{ marginLeft: 8 }}>confirm in Inbox</span> : null}</span>
            <span className="v-num"><Money value={l.amount} /></span>
          </div>
        ))}
      </div>
      {w.unmatched > 0 ? <p className="v-xs v-muted" style={{ margin: 0 }}><Money value={w.unmatched} /> reached {name} from your payroll account but does not add up to the next line, so no line is ticked for it.</p> : null}
      {w.lumps.map((t) => (
        <div key={t.id} className="v-row v-sp v-xs">
          <span className="v-muted">Transfer <Money value={t.amount} />{t.pending ? " (waiting in Inbox)" : ""}</span>
          <button type="button" className="v-btn v-sm v-ghost" disabled={busy} onClick={() => run(() => undoTransfer(t.id))}>Undo</button>
        </div>
      ))}
    </section>
  );
}
