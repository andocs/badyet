"use client";

import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { confirmTransaction, ignoreTransaction } from "@/app/(v13)/inbox/actions";
import { confirmToOthers, lendMoney, paybackLoan } from "@/app/(v13)/lending/actions";
import { paybackEffect, pesoText } from "@/lib/lending/forms";
import { dueChips, outstandingOf, type Loan } from "@/lib/lending/model";
import { NO_SOURCE, sourceOfKey } from "@/lib/lending/sources";
import type { OtherWhat } from "@/lib/lending/write";
import { LendFields, newDraft, SourceSelect, type LendContext, type LendDraft } from "./lending/fields";
import type { IsoDate } from "@/lib/domain/dates";
import { money } from "@/lib/domain/money";
import { relativeDay, timeLabel, shortDate } from "@/lib/now/format";
import { manilaDate } from "@/lib/now/summary";
import { HeldCaptureCard, type HeldCapture } from "./held-capture-card";
import { InboxEditForm } from "./inbox-edit";
import { V13Icon } from "./icons";
import { Money } from "./money";
import { Pick } from "./pick";
import { DatePicker } from "./pickers";

export interface InboxTxn {
  id: string;
  who: string;
  /** Centavos; negative = money out. */
  amount: number;
  account: string;
  accountId: string;
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
  /** ISO time until which this looks like one side of a transfer still waiting for its other side; null = no wait. */
  holdUntil: string | null;
  /** "Lent to Sam" or "Paid back by Sam" when it belongs to a loan. */
  loanTag: string | null;
  /** "Others": whose account the money went to (a capture rule may have filled it in). */
  otherOwner: string | null;
}

interface Category { id: string; name: string }

const when = (iso: string, today: IsoDate) => `${relativeDay(manilaDate(iso), today)} ${timeLabel(iso)}`;

/**
 * Inbox. Phones show one list at a time (All activity or To check); desktop shows To check as wide cards with All activity beside it.
 * Nothing moves a balance until it is confirmed, and "Not mine" ignores a row for good.
 */
type Change = { type: "confirm"; id: string; categoryId: string | null; categoryName: string | null } | { type: "ignore"; id: string };

export function InboxView({ txns: txnsIn, categories, held, accounts, today, bills, lending }: { txns: InboxTxn[]; categories: Category[]; held: HeldCapture[]; accounts: { id: string; name: string }[]; today: IsoDate; bills: { id: string; name: string }[]; lending: { lend: LendContext; open: Loan[]; loans: Loan[] } | null }) {
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
  const [billPicks, setBillPicks] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const dialog = useRef<HTMLDialogElement>(null);
  // The clock, so a transfer wait ends on screen without a reload. Until it first ticks, the server's view of the wait stands.
  const [nowMs, setNowMs] = useState(0);
  useEffect(() => {
    const tick = () => setNowMs(Date.now());
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, 15_000);
    return () => { clearTimeout(first); clearInterval(timer); };
  }, []);
  // "Transfer" is a button, not a category: a move between your own accounts.
  const [asT, setAsT] = useState<Record<string, boolean>>({});
  // With Transfer picked: the account on the other side, when only this side sent a message.
  const [others, setOthers] = useState<Record<string, string>>({});
  const holding = (t: InboxTxn) => t.holdUntil !== null && Date.parse(t.holdUntil) > nowMs;

  // Lending: money out can be "Lending", money in can be a "Loan payback", and a transfer can go to "Others".
  const [loanMode, setLoanMode] = useState<Record<string, boolean>>({});
  const [drafts, setDrafts] = useState<Record<string, LendDraft>>({});
  const [paying, setPaying] = useState<Record<string, string>>({});
  const [rest, setRest] = useState<Record<string, string>>({});
  const [owners, setOwners] = useState<Record<string, string>>({});
  const [whats, setWhats] = useState<Record<string, OtherWhat>>({});
  // A capture rule that sends money to someone else has already picked Transfer and Others.
  const presetOthers = (t: InboxTxn) => t.status === "pending" && t.amount < 0 && t.otherOwner !== null && t.peerAccount === null;
  const isAsT = (t: InboxTxn) => !loanMode[t.id] && (t.id in asT ? asT[t.id]! : presetOthers(t));
  const otherOf = (t: InboxTxn) => (t.id in others ? others[t.id]! : presetOthers(t) ? "others" : "");
  const lendingIt = (t: InboxTxn) => lending !== null && loanMode[t.id] === true && t.amount < 0;
  const openLoans = lending?.open ?? [];
  const payingBack = (t: InboxTxn) => lending !== null && loanMode[t.id] === true && t.amount > 0 && openLoans.length > 0;
  const toOthers = (t: InboxTxn) => lending !== null && isAsT(t) && t.amount < 0 && otherOf(t) === "others";
  const draftOf = (t: InboxTxn): LendDraft => drafts[t.id] ?? newDraft(lending!.lend);
  const ownerOf = (t: InboxTxn) => owners[t.id] ?? t.otherOwner ?? "";
  const loanFor = (t: InboxTxn) => openLoans.find((l) => l.id === paying[t.id]) ?? openLoans.find((l) => outstandingOf(l) === t.amount) ?? openLoans.find((l) => outstandingOf(l) >= t.amount) ?? openLoans[0]!;
  const restDue = (t: InboxTxn) => rest[t.id] ?? dueChips(lending!.lend.today, lending!.lend.paydays).find((c) => c.date > lending!.lend.today)!.date;

  const open = txns.find((t) => t.id === openId) ?? null;
  const pick = (t: InboxTxn) => (t.id in picks ? picks[t.id]! : t.categoryId);
  const ruleOn = (t: InboxTxn) => (t.id in rules ? rules[t.id]! : t.guess === "rule");
  // While a transfer-looking item waits for its other side, it can only be filed as a Transfer.
  const canConfirm = (t: InboxTxn) => {
    if (lendingIt(t)) return draftOf(t).borrower.trim() !== "" && draftOf(t).dueOn !== "";
    if (payingBack(t)) return t.amount <= outstandingOf(loanFor(t));
    if (toOthers(t)) {
      const what = whats[t.id];
      return ownerOf(t).trim() !== "" && what !== undefined && (what !== "spending" || pick(t) !== null) && (what !== "loan" || draftOf(t).dueOn !== "");
    }
    return t.kind === "transfer" || isAsT(t) || (pick(t) !== null && !holding(t));
  };
  const confirmLabel = (t: InboxTxn) => (lendingIt(t) ? "Confirm loan" : payingBack(t) ? "Confirm payback" : t.kind === "transfer" ? "Confirm transfer" : "Confirm");
  /** The save request for whichever way the item is being filed. */
  const saveRequest = (t: InboxTxn): { categoryId: string | null; run: () => Promise<{ error?: string }> } => {
    const note = notes[t.id] ?? t.note ?? "";
    if (lendingIt(t)) {
      const d = draftOf(t);
      return { categoryId: null, run: () => lendMoney({ txnId: t.id, borrower: d.borrower, dueOn: d.dueOn, from: sourceOfKey(d.fromKey), note }) };
    }
    if (payingBack(t)) {
      const loan = loanFor(t);
      return { categoryId: null, run: () => paybackLoan({ loanId: loan.id, txnId: t.id, nextDue: t.amount < outstandingOf(loan) ? restDue(t) : null }) };
    }
    if (toOthers(t)) {
      const what = whats[t.id]!;
      const d = draftOf(t);
      const categoryId = what === "spending" ? pick(t) : null;
      return { categoryId, run: () => confirmToOthers({ txnId: t.id, note, owner: ownerOf(t), what, dueOn: d.dueOn, categoryId, from: sourceOfKey(what === "spending" ? NO_SOURCE : d.fromKey) }) };
    }
    const asTransfer = isAsT(t);
    const categoryId = asTransfer ? null : pick(t);
    const otherAccountId = asTransfer && otherOf(t) !== "others" ? otherOf(t) || null : null;
    return { categoryId, run: () => confirmTransaction({ id: t.id, categoryId, rule: ruleOn(t), note, billId: billPicks[t.id] || null, asTransfer, otherAccountId }) };
  };


  function openDetail(id: string) {
    setEditing(false);
    setOpenId(id);
    dialog.current?.showModal();
  }
  function closeDetail() {
    dialog.current?.close();
    setEditing(false);
    setOpenId(null);
  }
  function confirm(t: InboxTxn) {
    setError(null);
    startTransition(async () => {
      const { categoryId, run } = saveRequest(t);
      apply({ type: "confirm", id: t.id, categoryId, categoryName: categories.find((c) => c.id === categoryId)?.name ?? null });
      closeDetail();
      const r = await run();
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
    <>
    <div className="v-cats" role="group" aria-label={`Category for ${t.who}`}>
      <button type="button" aria-pressed={isAsT(t)} onClick={() => { setAsT((a) => ({ ...a, [t.id]: !isAsT(t) })); setLoanMode((m) => ({ ...m, [t.id]: false })); }}>↔ Transfer</button>
      {lending && (t.amount < 0 || openLoans.length > 0) ? (
        <button type="button" aria-pressed={loanMode[t.id] === true} onClick={() => { setLoanMode((m) => ({ ...m, [t.id]: !m[t.id] })); setAsT((a) => ({ ...a, [t.id]: false })); }}>{t.amount < 0 ? "Lending" : "Loan payback"}</button>
      ) : null}
      {categories.map((c) => (
        <button key={c.id} type="button" aria-pressed={!isAsT(t) && !loanMode[t.id] && pick(t) === c.id} onClick={() => { setAsT((a) => ({ ...a, [t.id]: false })); setLoanMode((m) => ({ ...m, [t.id]: false })); setPicks((p) => ({ ...p, [t.id]: c.id })); }}>
          {c.name}
        </button>
      ))}
    </div>
    {isAsT(t) ? (
      <div className="v-field">
        {t.amount < 0 ? "Other account (where it arrived)" : "Other account (where it came from)"}
        <Pick label={t.amount < 0 ? "Other account (where it arrived)" : "Other account (where it came from)"} value={otherOf(t)} onChange={(v) => setOthers((o) => ({ ...o, [t.id]: v }))} options={[{ value: "", label: "Only this side" }, ...accounts.filter((a) => a.id !== t.accountId).map((a) => ({ value: a.id, label: a.name })), ...(lending && t.amount < 0 ? [{ value: "others", label: "Others (someone else's account)" }] : [])]} />
        {otherOf(t) === "others" ? null : <span className="v-xs" style={{ fontWeight: 500 }}>Pick one to add the other side too, if it did not send its own message.</span>}
      </div>
    ) : null}
    {toOthers(t) ? othersFields(t) : null}
    {lendingIt(t) ? <LendFields ctx={lending!.lend} draft={draftOf(t)} onChange={(d) => setDrafts((x) => ({ ...x, [t.id]: d }))} amount={Math.abs(t.amount)} /> : null}
    {payingBack(t) ? paybackFields(t) : null}
    </>
  );
  const othersFields = (t: InboxTxn) => {
    const what = whats[t.id];
    const draft = draftOf(t);
    const setDraft = (d: LendDraft) => setDrafts((x) => ({ ...x, [t.id]: d }));
    const spendName = categories.find((c) => c.id === pick(t))?.name;
    return (
      <div className="v-stack" style={{ gap: 10 }}>
        <label className="v-field">Whose account is it?<input value={ownerOf(t)} maxLength={80} placeholder="Name, bank and last digits" onChange={(e) => setOwners((o) => ({ ...o, [t.id]: e.target.value }))} /></label>
        <div className="v-field">
          What is this?
          <div className="v-seg" role="group" aria-label="What is this" style={{ alignSelf: "flex-start" }}>
            {([["loan", "A loan"], ["spending", "Spending"], ["none", "Not spending"]] as const).map(([value, text]) => (
              <button key={value} type="button" aria-pressed={what === value} onClick={() => setWhats((w) => ({ ...w, [t.id]: value }))}>{text}</button>
            ))}
          </div>
        </div>
        {what === "loan" ? <LendFields ctx={lending!.lend} draft={{ ...draft, borrower: ownerOf(t) }} onChange={setDraft} amount={Math.abs(t.amount)} askWho={false} /> : null}
        {what === "spending" ? (
          <div className="v-field">
            Counts against
            <Pick label="Counts against" value={pick(t)} placeholder="Pick a category" onChange={(v) => setPicks((p) => ({ ...p, [t.id]: v }))} options={categories.filter((c) => c.name !== "Credit card payment").map((c) => ({ value: c.id, label: c.name }))} />
            {spendName ? <span className="v-xs" style={{ fontWeight: 500 }}>{pesoText(t.amount)} counts as spending in {spendName}.</span> : null}
          </div>
        ) : null}
        {what === "none" ? <SourceSelect ctx={lending!.lend} value={draft.fromKey} onChange={(fromKey) => setDraft({ ...draft, fromKey })} label="Take it from (optional)" /> : null}
      </div>
    );
  };
  const paybackFields = (t: InboxTxn) => {
    const loan = loanFor(t);
    const owed = outstandingOf(loan);
    return (
      <div className="v-stack" style={{ gap: 10 }}>
        <div className="v-field">
          Whose payback?
          <Pick label="Whose payback?" value={loan.id} onChange={(v) => setPaying((p) => ({ ...p, [t.id]: v }))} options={openLoans.map((l) => ({ value: l.id, label: `${l.borrower} · ${pesoText(outstandingOf(l))} owed, due ${shortDate(l.dueOn)}` }))} />
        </div>
        {t.amount < owed ? <div className="v-field">When will the other {pesoText(owed - t.amount)} come?<DatePicker label="When the rest will come" value={restDue(t)} min={lending!.lend.today} onChange={(v) => setRest((r) => ({ ...r, [t.id]: v }))} /></div> : null}
        {t.amount > owed
          ? <p className="v-flag v-bad" style={{ margin: 0 }}>This is more than {loan.borrower} still owes ({pesoText(owed)}).</p>
          : <div className="v-testbox"><div className="v-sm">{paybackEffect(loan.from, t.amount, owed, loan.borrower, t.amount < owed ? restDue(t) : null)}</div></div>}
      </div>
    );
  };
  /** true while the item is being filed as lending: the category hints do not apply then. */
  const special = (t: InboxTxn) => loanMode[t.id] === true || toOthers(t);
  const guessLine = (t: InboxTxn) =>
    special(t) ? null : t.guess === "rule" && pick(t) === t.categoryId ? (
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
  const holdNote = (t: InboxTxn) =>
    holding(t) && !special(t) ? (
      <div className="v-guess v-warnt" role="status">
        May be a transfer: waiting for the other side until {timeLabel(t.holdUntil!)}. Tap Transfer now, or confirm it as {t.amount < 0 ? "spending" : "income"} after that.
      </div>
    ) : null;

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
                  if (entry.h) return <HeldCaptureCard key={entry.h.hash} h={entry.h} accounts={accounts} categories={categories} today={today} />;
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
                        <div className="v-inline">{chips(t)}{holdNote(t) ?? guessLine(t)}{special(t) ? null : <div className="v-row v-sp" style={{ marginTop: 12 }}>{ruleRow(t)}</div>}</div>
                        <div className="v-wide v-tp">
                          <span className="v-pill">{t.account}</span>
                          <span className={`v-pill ${pick(t) ? "" : "v-warn"}`}>{categories.find((c) => c.id === pick(t))?.name ?? "No category yet"}</span>
                          <span className={`v-pill ${pick(t) ? (t.guess === "rule" ? "v-ok" : "") : "v-warn"}`}>{pick(t) ? (t.guess === "rule" ? "Your rule" : t.guess === "history" ? "Best guess" : "Your pick") : "Pick one"}</span>
                        </div>
                      </>
                    )}
                    <div className="v-ta">
                      <button type="button" className="v-btn v-pri" disabled={!canConfirm(t)} onClick={() => confirm(t)}>{confirmLabel(t)}</button>
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
                          <span className="v-xs v-muted" style={{ display: "block" }}>{t.loanTag ?? (t.otherOwner && t.status === "confirmed" ? `To ${t.otherOwner} (others)` : t.kind === "transfer" ? "Transfer" : (t.categoryName ?? "No category"))} · {t.account}</span>
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
              {open.loanTag ? <span className="v-pill">Lending</span> : open.kind === "transfer" ? <span className="v-pill">Transfer</span> : null}
            </div>
            {editing ? (
              <InboxEditForm key={open.id} t={open} accounts={accounts} categories={categories} lending={lending} onSaved={() => setEditing(false)} onCancel={() => setEditing(false)} />
            ) : (
              <>
            <dl className="v-kv">
              <dt>Account</dt><dd>{open.account}{open.peerAccount ? ` ↔ ${open.peerAccount}` : ""}</dd>
              <dt>When</dt><dd>{when(open.occurredAt, today)}</dd>
              <dt>Source</dt><dd>{open.source}</dd>
              <dt>Category</dt><dd>{open.loanTag ? `Lending · ${open.loanTag}` : open.kind === "transfer" ? "None (transfer)" : (categories.find((c) => c.id === pick(open))?.name ?? "Not set")}</dd>
              {open.otherOwner ? <><dt>Others</dt><dd>{open.otherOwner}</dd></> : null}
              <dt>Dedupe ID</dt><dd className="v-num">{open.dedupe ?? "None"}</dd>
            </dl>
            <p className="v-xs v-muted" style={{ margin: 0 }}>Only the amount, merchant, time and that ID are kept. The raw notification text is not stored.</p>
            {open.status === "pending" && open.kind !== "transfer" ? (
              <>
                <div className="v-lbl">Category</div>
                {chips(open)}
                {holdNote(open) ?? guessLine(open)}
                {special(open) ? null : ruleRow(open)}
                {open.amount < 0 && bills.length > 0 && !special(open) ? (
                  <div className="v-field">
                    Pays a bill
                    <Pick label="Pays a bill" value={billPicks[open.id] ?? ""} onChange={(v) => setBillPicks((b) => ({ ...b, [open.id]: v }))} options={[{ value: "", label: "No, not a bill" }, ...bills.map((b) => ({ value: b.id, label: b.name }))]} />
                  </div>
                ) : null}
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
                  <button type="button" className="v-btn v-pri v-grow" disabled={!canConfirm(open)} onClick={() => confirm(open)}>{confirmLabel(open)}</button>
                  <button type="button" className="v-btn" onClick={() => ignore(open)}>Not mine</button>
                </>
              ) : (
                <button type="button" className="v-btn v-grow" onClick={closeDetail}>Done</button>
              )}
              <button type="button" className="v-btn" onClick={() => setEditing(true)}>Edit</button>
            </div>
              </>
            )}
          </div>
        ) : null}
      </dialog>
    </main>
  );
}

