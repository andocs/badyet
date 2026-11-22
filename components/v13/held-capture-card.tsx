"use client";

import { useState, useTransition } from "react";
import { resolveHeldCapture } from "@/app/(v13)/inbox/actions";
import type { IsoDate } from "@/lib/domain/dates";
import { money } from "@/lib/domain/money";
import { relativeDay, timeLabel } from "@/lib/now/format";
import { manilaDate } from "@/lib/now/summary";
import { Money } from "./money";

export interface HeldCapture {
  hash: string;
  /** The app or bank it came from, as a name. */
  sourceLabel: string;
  direction: "in" | "out";
  /** Centavos, always positive. */
  amount: number;
  counterparty: string | null;
  postTime: string;
}

interface Account { id: string; name: string }

/**
 * A capture the phone understood but no account claimed, shown in To check like any other item. It asks which account it belongs to
 * and where the money went or came from; once answered it becomes a normal pending item to categorise.
 */
export function HeldCaptureCard({ h, accounts, today }: { h: HeldCapture; accounts: Account[]; today: IsoDate }) {
  const [mine, setMine] = useState<string | null>(null);
  const [other, setOther] = useState<string | null>(null);
  const [gone, setGone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const out = h.direction === "out";
  const who = h.counterparty ?? `${h.sourceLabel} ${out ? "payment" : "deposit"}`;

  if (gone) return null;
  const answer = (accountId: string | null) => {
    setError(null);
    start(async () => {
      const r = await resolveHeldCapture({ hash: h.hash, accountId, otherAccountId: other });
      if (r.error) setError(r.error);
      else setGone(true);
    });
  };

  return (
    <article className="v-card v-itx">
      <div className="v-th">
        <span className="v-av" style={{ background: out ? "#B03030" : "#087A5A" }} aria-hidden="true">{who[0]}</span>
        <span className="v-nmb">{who}</span>
        <div className={`v-who ${out ? "" : "v-pos"}`}><Money value={money(out ? -h.amount : h.amount)} signed /></div>
      </div>
      <div className="v-ts">
        <span className="v-src">{h.sourceLabel}</span>
        <span className="v-src">{relativeDay(manilaDate(h.postTime), today)} {timeLabel(h.postTime)}</span>
        <span className="v-pill v-warn">Which account?</span>
      </div>

      <div className="v-lbl" style={{ marginTop: 10 }}>{out ? "Which of your accounts did it leave?" : "Which of your accounts did it arrive in?"}</div>
      <div className="v-cats" role="group" aria-label="Your account">
        {accounts.map((a) => (
          <button key={a.id} type="button" aria-pressed={mine === a.id} onClick={() => { setMine(a.id); if (other === a.id) setOther(null); }}>{a.name}</button>
        ))}
      </div>

      <div className="v-lbl" style={{ marginTop: 10 }}>{out ? "Where did it go?" : "Where did it come from?"}</div>
      <div className="v-cats" role="group" aria-label="The other side">
        <button type="button" aria-pressed={other === null} onClick={() => setOther(null)}>{h.counterparty ? `${h.counterparty} (someone else)` : "Someone or a shop"}</button>
        {accounts.filter((a) => a.id !== mine).map((a) => (
          <button key={a.id} type="button" aria-pressed={other === a.id} onClick={() => setOther(a.id)}>My {a.name}</button>
        ))}
      </div>
      {other ? <div className="v-guess v-muted">It will be matched with the {accounts.find((a) => a.id === other)?.name} notification as a transfer between your accounts.</div> : null}
      {error ? <p className="v-flag v-bad" role="alert">{error}</p> : null}

      <div className="v-ta">
        <button type="button" className="v-btn v-pri" disabled={!mine || busy} onClick={() => answer(mine)}>{busy ? "Adding…" : mine ? "Use this account" : "Pick an account"}</button>
        <button type="button" className="v-btn" disabled={busy} onClick={() => answer(null)} aria-label={`Not mine: ${who}`}>Not mine</button>
      </div>
    </article>
  );
}
