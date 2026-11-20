"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { markAllSent, setSent } from "@/app/(app)/dashboard-actions";
import { formatPesos, money, sum, type Money } from "@/lib/domain/money";
import { CountdownRing, CutoffBars, ForecastChart, type BucketRow } from "./charts";
import { Pip } from "./pip";

export interface DashLine {
  id: string;
  name: string;
  bucket: "essentials" | "wants" | "savings";
  walletId: string | null;
  amount: number; // centavos
}
export interface DashData {
  planName: string;
  month: string;
  cutoff: "first" | "second";
  cutoffLabel: string;
  wallets: { id: string; name: string }[];
  lines: DashLine[];
  sentIds: string[];
  forecast: { months: string[]; values: number[]; cap: number | null; note: string } | null;
  buckets: BucketRow[];
  thirteenth: { name: string; net: number; daysLeft: number; dateLabel: string; waiting: number } | null;
}

const BUCKET_LABEL = { essentials: "Essentials", wants: "Wants", savings: "Savings" } as const;
const CONFETTI = ["#f6c453", "#34d399", "#7fa8ff", "#ff8a8a", "#c4a0ff"];
const WALLET_COLORS = ["var(--w-gcash)", "var(--w-maya)", "var(--w-bpi)", "var(--w-vybe)"];
const CARD_COLORS = ["var(--card-1)", "var(--card-2)", "var(--card-3)", "var(--card-4)"];

interface Piece { id: number; left: number; top: number; color: string; dx: number; dy: number }

function greeting(): string {
  const hour = new Date().getHours();
  return hour < 12 ? "Good morning." : hour < 18 ? "Good afternoon." : "Good evening.";
}
const noopSubscribe = () => () => {};
// The server renders a neutral greeting; the browser swaps in the time-based one after hydration.
function useGreeting() {
  return useSyncExternalStore(noopSubscribe, greeting, () => "Hello.");
}

const pesos = (m: Money, symbol = false) => formatPesos(m, { symbol });

export function Dashboard({ data }: { data: DashData }) {
  const hello = useGreeting();
  const [sent, setSentIds] = useState<Set<string>>(new Set(data.sentIds));
  const [pieces, setPieces] = useState<Piece[]>([]);
  const [problem, setProblem] = useState("");

  useEffect(() => {
    if (!pieces.length) return;
    const timer = setTimeout(() => setPieces([]), 1300);
    return () => clearTimeout(timer);
  }, [pieces]);

  const lines = data.lines;
  const pending = lines.filter((l) => !sent.has(l.id));
  const left = sum(pending.map((l) => money(l.amount)));
  const total = sum(lines.map((l) => money(l.amount)));
  const sentTotal = money(total - left);
  const pct = total > 0 ? Math.round((sentTotal / total) * 100) : 0;
  const allDone = lines.length > 0 && pending.length === 0;

  function burst(origin: DOMRect) {
    setPieces(
      Array.from({ length: 44 }, (_, id) => ({
        id,
        left: origin.left + origin.width / 2,
        top: origin.top,
        color: CONFETTI[id % CONFETTI.length],
        dx: (Math.random() - 0.5) * 420,
        dy: Math.random() * 260 - 60,
      })),
    );
  }

  async function markAll(e: React.MouseEvent<HTMLButtonElement>) {
    const before = sent;
    burst(e.currentTarget.getBoundingClientRect());
    setSentIds(new Set(lines.map((l) => l.id)));
    setProblem("");
    const ok = await markAllSent(data.month, data.cutoff);
    if (!ok) {
      setSentIds(before);
      setProblem("That did not save. Try again.");
    }
  }
  async function markOne(id: string) {
    const before = sent;
    setSentIds(new Set([...sent, id]));
    setProblem("");
    const ok = await setSent(id, data.month, true);
    if (!ok) {
      setSentIds(before);
      setProblem("That did not save. Try again.");
    }
  }

  const unassigned = lines.filter((l) => l.walletId === null || !data.wallets.some((w) => w.id === l.walletId));
  const cards = [
    ...data.wallets.map((w, i) => ({ key: w.id, name: w.name, mine: lines.filter((l) => l.walletId === w.id), i })),
    ...(unassigned.length > 0 ? [{ key: "none", name: "No wallet yet", mine: unassigned, i: data.wallets.length }] : []),
  ].filter((c) => c.mine.length > 0);
  const walletOf = (l: DashLine) => data.wallets.findIndex((w) => w.id === l.walletId);

  return (
    <main className="main">
      <div className="head">
        <div>
          <span className="lab">{data.cutoffLabel}</span>
          <h1 style={{ marginTop: 6 }}>{hello}</h1>
          <p className="sub">
            {lines.length === 0
              ? "Nothing to send yet. Add budget lines to get started."
              : allDone
                ? "Everything is sent. Go touch grass."
                : `${pending.length} transfers left this cutoff. You are on track.`}
          </p>
        </div>
        <Link href="/plans" className="btn ghost">{data.planName} ▾</Link>
      </div>

      <section className="hero" aria-label="Left to send">
        <div className="hero-inner">
          <div style={{ flex: 1, minWidth: 240 }}>
            <span className="lab">Left to send</span>
            <div className="balance rise"><small>₱</small>{pesos(left)}</div>
            <div className="bar" role="progressbar" aria-label="Sent so far" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
              <i style={{ width: `${pct}%` }} />
            </div>
            <div className="hero-actions">
              <span className="pill">₱{pesos(sentTotal)} sent</span>
              {lines.length === 0 ? (
                <Link href="/budget" className="btn">Go to Budget</Link>
              ) : (
                <button type="button" className="btn" onClick={markAll} disabled={allDone}>Mark all sent</button>
              )}
            </div>
          </div>
          <Pip happy={allDone} />
        </div>
      </section>
      {problem && <p className="notice err" role="alert" style={{ marginBottom: 18 }}>{problem}</p>}

      {cards.length > 0 && (
        <section className="wallets" aria-label="Wallets">
          {cards.map((c) => (
            <div key={c.key} className="wcard" style={{ ["--k" as string]: CARD_COLORS[c.i % 4] }}>
              <div className="top"><b>{c.name}</b><span className="chip" aria-hidden="true" /></div>
              <div>
                <div className="amt">₱{pesos(sum(c.mine.map((l) => money(l.amount))))}</div>
                <small>{c.mine.filter((l) => sent.has(l.id)).length} of {c.mine.length} sent</small>
              </div>
            </div>
          ))}
        </section>
      )}

      <div className="split">
        <div className="stack">
          <section className="card">
            <div className="head" style={{ margin: "0 0 4px" }}>
              <h2 style={{ margin: 0 }}>Emergency fund forecast</h2>
              {data.forecast && <span className="pill">{data.forecast.note}</span>}
            </div>
            {data.forecast ? (
              <ForecastChart months={data.forecast.months} values={data.forecast.values} cap={data.forecast.cap} />
            ) : (
              <p className="sub">Set up your funds to see how your savings grow. <Link href="/savings">Open Savings forecast</Link></p>
            )}
          </section>
          <section className="card" aria-labelledby="pending-h">
            <div className="head" style={{ margin: "0 0 6px" }}>
              <h2 id="pending-h" style={{ margin: 0 }}>Pending transfers</h2>
              <span className="lab">{pending.length} to go</span>
            </div>
            {lines.length === 0 ? (
              <p className="sub">No budget lines for this cutoff. <Link href={`/budget?cutoff=${data.cutoff}`}>Add some</Link></p>
            ) : allDone ? (
              <div className="empty"><span>All sent for this cutoff. Pip is very proud of you.</span></div>
            ) : (
              pending.slice(0, 4).map((l) => {
                const wi = walletOf(l);
                const color = wi >= 0 ? WALLET_COLORS[wi % 4] : "var(--muted)";
                return (
                  <div key={l.id} className="tx" style={{ ["--c" as string]: color }}>
                    <span className="avatar" aria-hidden="true">{wi >= 0 ? data.wallets[wi].name[0] : "?"}</span>
                    <div>
                      <div className="name">{l.name}</div>
                      <span className="lab">To {wi >= 0 ? data.wallets[wi].name : "no wallet yet"} · {BUCKET_LABEL[l.bucket]}</span>
                    </div>
                    <div className="right">
                      <span className="num">{pesos(money(l.amount))}</span>
                      <button type="button" className="mark" onClick={() => markOne(l.id)} aria-label={`Mark ${l.name} as sent`}>
                        <span className="pill quiet">Pending · tap to mark sent</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
            {lines.length > 0 && <p style={{ margin: "10px 0 0" }}><Link href={`/transfer?cutoff=${data.cutoff}`}>See the full checklist</Link></p>}
          </section>
        </div>
        <div className="stack">
          <section className="card">
            <h2>13th month</h2>
            {data.thirteenth ? (
              <>
                <div className="ring-wrap">
                  <CountdownRing daysLeft={data.thirteenth.daysLeft} />
                  <div>
                    <div className="disp" style={{ fontSize: 22 }}>+₱{pesos(money(data.thirteenth.net))}</div>
                    <p className="sub">Estimate · lands {data.thirteenth.dateLabel}</p>
                  </div>
                </div>
                <div className="row mt"><span>Allocation items</span><span className="pill quiet">{data.thirteenth.waiting} waiting</span></div>
              </>
            ) : (
              <p className="sub" style={{ margin: 0 }}>No upcoming 13th month yet. <Link href="/bonuses">Add one in Bonuses</Link></p>
            )}
          </section>
          <section className="card">
            <h2>Spend by cutoff</h2>
            <CutoffBars rows={data.buckets} />
          </section>
        </div>
      </div>

      {pieces.map((p) => (
        <span
          key={p.id}
          className="confetti"
          aria-hidden="true"
          style={{ left: p.left, top: p.top, background: p.color, ["--dx" as string]: `${p.dx}px`, ["--dy" as string]: `${p.dy}px` }}
        />
      ))}
    </main>
  );
}
