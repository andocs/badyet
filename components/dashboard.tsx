"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { add, formatPesos, sum, type Money } from "@/lib/domain/money";
import { CUTOFF_LABEL, FIRST_CUTOFF, THIRTEENTH, WALLETS, type Transfer } from "@/lib/sample";
import { CountdownRing, CutoffBars, ForecastChart } from "./charts";
import { Pip } from "./pip";

const BUCKET_LABEL = { essentials: "Essentials", wants: "Wants", savings: "Savings" } as const;
const CONFETTI = ["#f6c453", "#34d399", "#7fa8ff", "#ff8a8a", "#c4a0ff"];

interface Piece { id: number; left: number; top: number; color: string; dx: number; dy: number }

function greeting(): string {
  const hour = new Date().getHours();
  return hour < 12 ? "Good morning." : hour < 18 ? "Good afternoon." : "Good evening.";
}

const noopSubscribe = () => () => {};
// Server renders a neutral greeting; the browser swaps in the time-based one after hydration.
function useGreeting() {
  return useSyncExternalStore(noopSubscribe, greeting, () => "Hello.");
}

function pesos(m: Money, symbol = false) {
  return formatPesos(m, { symbol });
}

export function Dashboard() {
  const hello = useGreeting();
  const [transfers, setTransfers] = useState<Transfer[]>(FIRST_CUTOFF);
  const [pieces, setPieces] = useState<Piece[]>([]);

  useEffect(() => {
    if (!pieces.length) return;
    const timer = setTimeout(() => setPieces([]), 1300);
    return () => clearTimeout(timer);
  }, [pieces]);

  const pending = transfers.filter((t) => !t.sent);
  const left = sum(pending.map((t) => t.amount));
  const sent = sum(transfers.filter((t) => t.sent).map((t) => t.amount));
  const total = add(left, sent);
  const pct = total > 0 ? Math.round((sent / total) * 100) : 0;
  const allDone = pending.length === 0;

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

  function markAll(e: React.MouseEvent<HTMLButtonElement>) {
    burst(e.currentTarget.getBoundingClientRect());
    setTransfers((ts) => ts.map((t) => ({ ...t, sent: true })));
  }
  function markOne(id: string) {
    setTransfers((ts) => ts.map((t) => (t.id === id ? { ...t, sent: true } : t)));
  }

  return (
    <main className="main">
      <div className="head">
        <div>
          <span className="lab">{CUTOFF_LABEL}</span>
          <h1 style={{ marginTop: 6 }}>{hello}</h1>
          <p className="sub">{allDone ? "Everything is sent. Go touch grass." : `${pending.length} transfers left this cutoff. You are on track.`}</p>
        </div>
        <button type="button" className="btn ghost">Dec 2026 plan ▾</button>
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
              <span className="pill">₱{pesos(sent)} sent</span>
              <button type="button" className="btn" onClick={markAll} disabled={allDone}>Mark all sent</button>
            </div>
          </div>
          <Pip happy={allDone} />
        </div>
      </section>

      <section className="wallets" aria-label="Wallets">
        {WALLETS.map((w) => {
          const mine = transfers.filter((t) => t.wallet === w.id);
          return (
            <div key={w.id} className="wcard" style={{ ["--k" as string]: w.cardVar }}>
              <div className="top"><b>{w.name}</b><span className="chip" aria-hidden="true" /></div>
              <div>
                <div className="amt">₱{pesos(sum(mine.map((t) => t.amount)))}</div>
                <small>{mine.filter((t) => t.sent).length} of {mine.length} sent</small>
              </div>
            </div>
          );
        })}
      </section>

      <div className="split">
        <div className="stack">
          <section className="card">
            <div className="head" style={{ margin: "0 0 4px" }}>
              <h2 style={{ margin: 0 }}>Emergency fund forecast</h2>
              <span className="pill">Cap in Jun 2027</span>
            </div>
            <ForecastChart />
          </section>
          <section className="card" aria-labelledby="pending-h">
            <div className="head" style={{ margin: "0 0 6px" }}>
              <h2 id="pending-h" style={{ margin: 0 }}>Pending transfers</h2>
              <span className="lab">{pending.length} to go</span>
            </div>
            {allDone ? (
              <div className="empty"><span>All sent for this cutoff. Pip is very proud of you.</span></div>
            ) : (
              pending.slice(0, 4).map((t) => <TransferRow key={t.id} t={t} onMark={() => markOne(t.id)} />)
            )}
          </section>
        </div>
        <div className="stack">
          <section className="card">
            <h2>13th month</h2>
            <div className="ring-wrap">
              <CountdownRing />
              <div>
                <div className="disp" style={{ fontSize: 22 }}>+₱{pesos(THIRTEENTH.amount)}</div>
                <p className="sub">Estimate · lands {THIRTEENTH.date}</p>
              </div>
            </div>
            <div className="row mt"><span>Allocation items</span><span className="pill quiet">{THIRTEENTH.allocationWaiting} waiting</span></div>
          </section>
          <section className="card">
            <h2>Spend by cutoff</h2>
            <CutoffBars />
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

function TransferRow({ t, onMark }: { t: Transfer; onMark: () => void }) {
  const wallet = WALLETS.find((w) => w.id === t.wallet)!;
  return (
    <div className="tx" style={{ ["--c" as string]: wallet.cssColor }}>
      <span className="avatar" aria-hidden="true">{wallet.name[0]}</span>
      <div>
        <div className="name">{t.name}</div>
        <span className="lab">To {wallet.name} · {BUCKET_LABEL[t.bucket]}</span>
      </div>
      <div className="right">
        <span className="num">{pesos(t.amount)}</span>
        <button type="button" className="mark" onClick={onMark} aria-label={`Mark ${t.name} as sent`}>
          <span className="pill quiet">Pending · tap to mark sent</span>
        </button>
      </div>
    </div>
  );
}
