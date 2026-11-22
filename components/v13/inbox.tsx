"use client";

import { useOptimistic, useRef, useState, useTransition } from "react";
import { confirmTransaction, ignoreTransaction } from "@/app/(v13)/inbox/actions";
import type { IsoDate } from "@/lib/domain/dates";
import { money } from "@/lib/domain/money";
import { relativeDay, timeLabel } from "@/lib/now/format";
import { manilaDate } from "@/lib/now/summary";
import { HeldCaptureCard, type HeldCapture } from "./held-capture-card";
import { V13Icon } from "./icons";
import { Money } from "./money";

export interface InboxTxn {
  id: string;
  who: string;
  /** Centavos; negative = money out. */
  amount: number;
  account: string;
  /** For a transfer: the other account. */
  peerAccount: string | null;
  occurredAt: string;
  source: string;
  kind: "expense" | "income" | "transfer";
  status: "pending" | "confirmed";
  categoryId: string | null;
  categoryName: string | null;
  /** Where a suggested category came from. */
  guess: "rule" | "history" | null;
  dedupe: string | null;
  note: string | null;
}

interface Category { id: string; name: string }

const when = (iso: string, today: IsoDate) => `${relativeDay(manilaDate(iso), today)} ${timeLabel(iso)}`;

/**
 * Inbox. Phones show one list at a time (All activity or To check); desktop shows To check as wide cards with All activity beside it.
 * Nothing moves a balance until it is confirmed, and "Not mine" ignores a row for good.
 */
type Change = { type: "confirm"; id: string; categoryId: string | null; categoryName: string | null } | { type: "ignore"; id: string };

export function InboxView({ txns: txnsIn, categories, held, accounts, today }: { txns: InboxTxn[]; categories: Category[]; held: HeldCapture[]; accounts: { id: string; name: string }[]; today: IsoDate }) {
  // A confirmed row leaves To check and an ignored row disappears the moment you tap; the server catches up in the background.
  const [txns, apply] = useOptimistic(txnsIn, (cur, c: Change) =>
    c.type === "ignore" ? cur.filter((t) => t.id !== c.id) : cur.map((t) => (t.id === c.id ? { ...t, status: "confirmed" as const, categoryId: c.categoryId, categoryName: c.categoryName } : t)),
  );
  const pending = txns.filter((t) => t.status === "pending");
  // Captures no account has claimed sit in the same list, among the others by time.
  const toCheck = [
    ...pending.map((t) => ({ at: Date.parse(t.occurredAt), t, h: null as HeldCapture | null })),
    ...held.map((h) => ({ at: Date.parse(h.postTime), t: null as InboxTxn | null, h })),
  ].sort((a, b) => b.at - a.at);
  const waiting = toCheck.length;
  const [view, setView] = useState<"a" | "p">("a");
  const [openId, setOpenId] = useState<string | null>(null);
  const [picks, setPicks] = useState<Record<string, string | null>>({});
  const [rules, setRules] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const dialog = useRef<HTMLDialogElement>(null);

  const open = txns.find((t) => t.id === openId) ?? null;
  const pick = (t: InboxTxn) => (t.id in picks ? picks[t.id]! : t.categoryId);
  const ruleOn = (t: InboxTxn) => (t.id in rules ? rules[t.id]! : t.guess === "rule");
  const canConfirm = (t: InboxTxn) => t.kind === "transfer" || pick(t) !== null;

  function openDetail(id: string) {
    setOpenId(id);
    dialog.current?.showModal();
  }
  function closeDetail() {
    dialog.current?.close();
    setOpenId(null);
  }
  function confirm(t: InboxTxn) {
    setError(null);
    startTransition(async () => {
      const categoryId = pick(t);
      apply({ type: "confirm", id: t.id, categoryId, categoryName: categories.find((c) => c.id === categoryId)?.name ?? null });
      closeDetail();
      const r = await confirmTransaction({ id: t.id, categoryId, rule: ruleOn(t), note: notes[t.id] ?? t.note ?? "" });
      if (r.error) setError(r.error);
    });
  }
  function ignore(t: InboxTxn) {
    setError(null);
    startTransition(async () => {
      apply({ type: "ignore", id: t.id });
      closeDetail();
      const r = await ignoreTransaction(t.id);
      if (r.error) setError(r.error);
    });
  }

  const chips = (t: InboxTxn) => (
    <div className="v-cats" role="group" aria-label={`Category for ${t.who}`}>
      {categories.map((c) => (
        <button key={c.id} type="button" aria-pressed={pick(t) === c.id} onClick={() => setPicks((p) => ({ ...p, [t.id]: c.id }))}>
          {c.name}
        </button>
      ))}
    </div>
  );
  const guessLine = (t: InboxTxn) =>
    t.guess === "rule" && pick(t) === t.categoryId ? (
      <div className="v-guess v-pos">Auto-picked by your rule: {t.who} is {t.categoryName}</div>
    ) : t.guess === "history" && pick(t) === t.categoryId ? (
      <div className="v-guess v-muted">Best guess from past purchases</div>
    ) : pick(t) === null ? (
      <div className="v-guess v-warnt">No guess yet. Pick one and it will be remembered.</div>
    ) : null;
  const ruleRow = (t: InboxTxn) => (
    <label className="v-row" style={{ gap: 10 }}>
      <button type="button" className="v-sw" role="switch" aria-checked={ruleOn(t)} aria-label={`Always put ${t.who} under this category`} onClick={() => setRules((r) => ({ ...r, [t.id]: !ruleOn(t) }))} />
      <span className="v-sm">Always put {t.who} here</span>
    </label>
  );
  const avatar = (t: InboxTxn) => (
    <span className="v-av" style={{ background: t.amount > 0 ? "#087A5A" : "#B03030" }} aria-hidden="true">
      {t.who[0]}
    </span>
  );
  const label = (n: number) => `To check${n ? ` (${n})` : ""}`;

  return (
    <main className="v-main">
      <div className="v-inbox v-stack" data-view={view}>
        <div>
          <div className="v-row v-sp v-ihead">
            <h1>Inbox</h1>
            <div className="v-seg v-seg-wrap" role="group" aria-label="View">
              <button type="button" aria-pressed={view === "a"} onClick={() => setView("a")}>All activity</button>
              <button type="button" aria-pressed={view === "p"} onClick={() => setView("p")}>{label(waiting)}</button>
            </div>
          </div>
          <div className="v-lbl" style={{ marginTop: 4 }}>{view === "a" ? "Everything that moved your money, newest first." : waiting ? `${waiting} waiting for you. One tap each.` : "Nothing waiting."}</div>
        </div>

        {waiting > 0 ? (
          <div className="v-alert">
            <span>{waiting} waiting for you. Pending spends are not counted until you confirm.</span>
            <button type="button" className="v-btn v-sm v-pri" onClick={() => setView("p")}>Check them</button>
          </div>
        ) : null}
        {error ? <p className="v-flag v-bad" role="alert">{error}</p> : null}

        <div className="v-dcols">
          <div className="v-stack v-colL">
            <h2 className="v-wide">To check</h2>
            {waiting === 0 ? (
              <div className="v-card v-empty">
                <div className="v-pip" style={{ margin: "0 auto 10px" }} aria-hidden="true" />
                <h2>All caught up</h2>
                <p className="v-muted" style={{ margin: "4px 0 0" }}>Balances are current as of now.</p>
              </div>
            ) : (
              <div className="v-stack v-pgrid">
                {toCheck.map((entry) => {
                  if (entry.h) return <HeldCaptureCard key={entry.h.hash} h={entry.h} accounts={accounts} today={today} />;
                  const t = entry.t!;
                  return (
                  <article
                    key={t.id}
                    className="v-card v-itx"
                    onClick={(e) => {
                      if (window.matchMedia("(min-width:960px)").matches && !(e.target as HTMLElement).closest("button")) openDetail(t.id);
                    }}
                  >
                    <div className="v-th">
                      {avatar(t)}
                      <button type="button" className="v-nmb" onClick={() => openDetail(t.id)} aria-label={`Open details for ${t.who}`}>{t.who}</button>
                      <div className={`v-who ${t.amount > 0 ? "v-pos" : ""}`}><Money value={money(t.amount)} signed /></div>
                    </div>
                    <div className="v-ts">
                      <span className="v-src"><V13Icon name="inbox" className="" /> {t.source}</span>
                      <span className="v-src">{when(t.occurredAt, today)}</span>
                    </div>
                    {t.kind === "transfer" ? (
                      <>
                        <div className="v-inline v-pair">
                          <span className="v-pill">{t.amount < 0 ? t.account : (t.peerAccount ?? "Other account")}</span>
                          <V13Icon name="chev" />
                          <span className="v-pill">{t.amount < 0 ? (t.peerAccount ?? "Other account") : t.account}</span>
                          {t.peerAccount ? <span className="v-pill v-ok">Matched as a transfer</span> : null}
                        </div>
                        <div className="v-wide v-tp"><span className="v-pill">Transfer</span>{t.peerAccount ? <span className="v-pill v-ok">Matched</span> : null}</div>
                      </>
                    ) : (
                      <>
                        <div className="v-inline">{chips(t)}{guessLine(t)}<div className="v-row v-sp" style={{ marginTop: 12 }}>{ruleRow(t)}</div></div>
                        <div className="v-wide v-tp">
                          <span className="v-pill">{t.account}</span>
                          <span className={`v-pill ${pick(t) ? "" : "v-warn"}`}>{categories.find((c) => c.id === pick(t))?.name ?? "No category yet"}</span>
                          <span className={`v-pill ${pick(t) ? (t.guess === "rule" ? "v-ok" : "") : "v-warn"}`}>{pick(t) ? (t.guess === "rule" ? "Your rule" : t.guess === "history" ? "Best guess" : "Your pick") : "Pick one"}</span>
                        </div>
                      </>
                    )}
                    <div className="v-ta">
                      <button type="button" className="v-btn v-pri" disabled={!canConfirm(t)} onClick={() => confirm(t)}>Confirm</button>
                      <button type="button" className="v-btn" onClick={() => ignore(t)} aria-label={`Ignore ${t.who}`}>Not mine</button>
                    </div>
                  </article>
                  );
                })}
              </div>
            )}
          </div>

          <div className="v-colR">
            <h2 className="v-wide" style={{ marginBottom: 8 }}>All activity</h2>
            <div className="v-card">
              {txns.length === 0 ? (
                <p className="v-muted" style={{ margin: 0 }}>Nothing yet. Spending you add with + shows up here.</p>
              ) : (
                <ul className="v-list" style={{ margin: 0 }}>
                  {txns.map((t) => (
                    <li key={t.id} style={{ padding: 0 }}>
                      <button type="button" className="v-arow" onClick={() => openDetail(t.id)} aria-label={`${t.who}, ${t.amount / 100} pesos${t.status === "pending" ? ", pending" : ""}. Open details`}>
                        {avatar(t)}
                        <span className="v-grow">
                          <b>{t.who}</b>
                          <span className="v-xs v-muted" style={{ display: "block" }}>{t.kind === "transfer" ? "Transfer" : (t.categoryName ?? "No category")} · {t.account}</span>
                          <span className="v-xs v-muted" style={{ display: "block" }}>{when(t.occurredAt, today)}</span>
                        </span>
                        <span className="v-ar">
                          <b className={t.amount > 0 ? "v-pos" : ""}><Money value={money(t.amount)} signed /></b>
                          {t.status === "pending" ? <span className="v-pend">pending</span> : null}
                        </span>
                        <V13Icon name="chev" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        <div className="v-note">
          <b>How it gets here (phone app):</b> the Bad(yet) phone app will read GCash, Maya and BPI notifications, turn them into pending rows and send only the amount, merchant and time. Nothing posts to your balances until you confirm.
        </div>
      </div>

      <dialog ref={dialog} className="v-dlg" aria-labelledby="dt" onClose={() => setOpenId(null)} onClick={(e) => e.target === dialog.current && closeDetail()}>
        {open ? (
          <div className="v-qa">
            <div className="v-grab" aria-hidden="true" />
            <div className="v-row v-sp">
              <h2 id="dt">{open.who}</h2>
              <button type="button" className="v-iconbtn v-s" onClick={closeDetail} aria-label="Close"><V13Icon name="x" /></button>
            </div>
            <div className={`v-big v-num ${open.amount > 0 ? "v-pos" : ""}`} style={{ fontSize: 36 }}><Money value={money(open.amount)} signed /></div>
            <div className="v-row v-wrap" style={{ gap: 8 }}>
              <span className={`v-pill ${open.status === "pending" ? "v-warn" : "v-ok"}`}>{open.status === "pending" ? "Pending" : "Confirmed"}</span>
              {open.kind === "transfer" ? <span className="v-pill">Transfer</span> : null}
            </div>
            <dl className="v-kv">
              <dt>Account</dt><dd>{open.account}{open.peerAccount ? ` ↔ ${open.peerAccount}` : ""}</dd>
              <dt>When</dt><dd>{when(open.occurredAt, today)}</dd>
              <dt>Source</dt><dd>{open.source}</dd>
              <dt>Category</dt><dd>{open.kind === "transfer" ? "None (transfer)" : (categories.find((c) => c.id === pick(open))?.name ?? "Not set")}</dd>
              <dt>Dedupe ID</dt><dd className="v-num">{open.dedupe ?? "None"}</dd>
            </dl>
            <p className="v-xs v-muted" style={{ margin: 0 }}>Only the amount, merchant, time and that ID are kept. The raw notification text is not stored.</p>
            {open.status === "pending" && open.kind !== "transfer" ? (
              <>
                <div className="v-lbl">Category</div>
                {chips(open)}
                {guessLine(open)}
                {ruleRow(open)}
                <label className="v-field">
                  Note
                  <input value={notes[open.id] ?? open.note ?? ""} maxLength={200} placeholder="Add a note (optional)" onChange={(e) => setNotes((n) => ({ ...n, [open.id]: e.target.value }))} />
                </label>
              </>
            ) : null}
            {error ? <p className="v-flag v-bad" role="alert">{error}</p> : null}
            <div className="v-row v-wrap" style={{ gap: 10 }}>
              {open.status === "pending" ? (
                <>
                  <button type="button" className="v-btn v-pri v-grow" disabled={!canConfirm(open)} onClick={() => confirm(open)}>{open.kind === "transfer" ? "Confirm transfer" : "Confirm"}</button>
                  <button type="button" className="v-btn" onClick={() => ignore(open)}>Not mine</button>
                </>
              ) : (
                <button type="button" className="v-btn v-grow" onClick={closeDetail}>Done</button>
              )}
            </div>
          </div>
        ) : null}
      </dialog>
    </main>
  );
}

