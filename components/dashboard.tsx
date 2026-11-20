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
  cutoffNet: number | null; // centavos, null until Pay is set up
  unplanned: number | null; // centavos left after every budget line of this cutoff
  commitments: { name: string; amount: number; kind: string }[];
  next: { days: number; label: string; net: number | null };
  daysLeft: number; // days of this cutoff left to spend in (at least 1)
  money: { cash: number; debt: number; net: number; utilizationPct: number | null; cardsDue: { name: string; owed: number; days: number }[] } | null;
}

const BUCKET_LABEL = { essentials: "Essentials", wants: "Wants", savings: "Savings" } as const;
const CONFETTI = ["#f6c453", "#34d399", "#7fa8ff", "#ff8a8a", "#c4a0ff"];
const WALLET_COLORS = ["var(--w-gcash)", "var(--w-maya)", "var(--w-bpi)", "var(--w-vybe)"];

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
const peso = (centavos: number) => pesos(money(centavos));

type View = "auto" | "ritual" | "glance";

// Now: on payday it walks you through four steps (pay landed, spoken for, send by wallet, yours to spend).
// Between paydays it shows when the next one is and how the month looks.
export function Dashboard({ data }: { data: DashData }) {
  const hello = useGreeting();
  const [sent, setSentIds] = useState<Set<string>>(new Set(data.sentIds));
  const [pieces, setPieces] = useState<Piece[]>([]);
  const [problem, setProblem] = useState("");
  const [view, setView] = useState<View>("auto");
  const [step, setStep] = useState(data.sentIds.length > 0 ? 3 : 1);
  const [open, setOpen] = useState<string | null>(null);

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
  const ritual = view === "ritual" || (view === "auto" && pending.length > 0);

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

  // Marks or un-marks lines with the saved ticks, undoing on a failed save.
  async function mark(ids: string[], value: boolean, origin?: DOMRect) {
    const before = sent;
    const next = new Set(sent);
    for (const id of ids) (value ? next.add(id) : next.delete(id));
    setSentIds(next);
    setProblem("");
    if (origin && value && lines.every((l) => next.has(l.id))) burst(origin);
    const results = await Promise.all(ids.map((id) => setSent(id, data.month, value)));
    if (results.some((ok) => !ok)) {
      setSentIds(before);
      setProblem("That did not save. Try again.");
    }
  }
  async function markEverything(e: React.MouseEvent<HTMLButtonElement>) {
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

  const unassigned = lines.filter((l) => l.walletId === null || !data.wallets.some((w) => w.id === l.walletId));
  const groups = [
    ...data.wallets.map((w, i) => ({ key: w.id, name: w.name, mine: lines.filter((l) => l.walletId === w.id), i })),
    ...(unassigned.length > 0 ? [{ key: "none", name: "No wallet yet", mine: unassigned, i: -1 }] : []),
  ].filter((g) => g.mine.length > 0);
  const openKey = open ?? groups.find((g) => g.mine.some((l) => !sent.has(l.id)))?.key ?? groups[0]?.key ?? null;
  const spendPerDay = data.unplanned !== null && data.unplanned > 0 ? Math.floor(data.unplanned / data.daysLeft) : 0;

  return (
    <main className="main now">
      {ritual ? (
        <section aria-label="Payday">
          <div className="steps" role="progressbar" aria-label="Payday steps" aria-valuemin={1} aria-valuemax={4} aria-valuenow={step}>
            {[1, 2, 3, 4].map((n) => (
              <i key={n} className={n < step ? "on" : n === step ? "now" : ""} />
            ))}
          </div>
          <p className="lab" style={{ margin: "14px 0 0" }}>{data.cutoffLabel} · {data.planName}</p>

          {step === 1 && (
            <div className="stage">
              <h1>Did your pay land?</h1>
              <div className="hero" style={{ marginBottom: 0 }}>
                <span className="lab">Expected this cutoff</span>
                <div className="balance rise"><small>₱</small>{data.cutoffNet === null ? "Set up Pay" : peso(data.cutoffNet)}</div>
                <p className="sub" style={{ margin: 0 }}>Check your bank or payroll app. If it is there, we go on.</p>
              </div>
              <div className="ritual-actions">
                <button type="button" className="btn" onClick={() => setView("glance")}>Not yet</button>
                <button type="button" className="btn pri" onClick={() => setStep(2)}>Yes, it landed</button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="stage">
              <h1>Already spoken for.</h1>
              <p className="sub" style={{ margin: 0 }}>These are due this cutoff. Nothing to do, just look.</p>
              <section className="card" aria-label="Commitments due">
                {data.commitments.length === 0 ? (
                  <p className="sub" style={{ margin: 0 }}>No installments or subscriptions due this cutoff.</p>
                ) : (
                  data.commitments.map((c, i) => (
                    <div key={`${c.kind}-${c.name}-${i}`} className="tx" style={{ gridTemplateColumns: "1fr auto" }}>
                      <div>
                        <div className="name">{c.name}</div>
                        <span className="lab">{c.kind}</span>
                      </div>
                      <span className="num">₱{peso(c.amount)}</span>
                    </div>
                  ))
                )}
                {data.commitments.length > 0 && (
                  <div className="row mt"><span>Total spoken for</span><b className="num">₱{peso(data.commitments.reduce((a, c) => a + c.amount, 0))}</b></div>
                )}
                <p style={{ margin: "10px 0 0" }}><Link href="/installments">Manage installments and subscriptions</Link></p>
              </section>
              <div className="ritual-actions">
                <button type="button" className="btn" onClick={() => setStep(1)}>Back</button>
                <button type="button" className="btn pri" onClick={() => setStep(3)}>Looks right</button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="stage">
              <h1>Send it where it belongs.</h1>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span className="lab">Left to send</span>
                <b className="num" style={{ fontSize: 26 }}>₱{pesos(left)}</b>
              </div>
              <div className="bar" role="progressbar" aria-label="Sent so far" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${pct}%` }} /></div>
              {problem && <p className="notice err" role="alert" style={{ margin: 0 }}>{problem}</p>}
              {lines.length === 0 && <p className="sub">No budget lines for this cutoff. <Link href={`/budget?cutoff=${data.cutoff}`}>Add some</Link></p>}
              {groups.map((g) => {
                const done = g.mine.filter((l) => sent.has(l.id)).length;
                const isOpen = g.key === openKey;
                const color = g.i >= 0 ? WALLET_COLORS[g.i % 4] : "var(--muted)";
                return (
                  <div key={g.key} className={`wal${isOpen ? " open" : ""}`}>
                    <button type="button" className="wal-hd" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? "" : g.key)}>
                      <span className="avatar" style={{ ["--c" as string]: color }} aria-hidden="true">{g.name[0]}</span>
                      <span style={{ flex: 1, textAlign: "left" }}>
                        <b>{g.name}</b>
                        <span className="lab" style={{ display: "block" }}>{done} of {g.mine.length} sent</span>
                      </span>
                      <b className="num">₱{pesos(sum(g.mine.map((l) => money(l.amount))))}</b>
                    </button>
                    {isOpen && (
                      <div>
                        {g.mine.map((l) => {
                          const on = sent.has(l.id);
                          return (
                            <button key={l.id} type="button" className={`wal-ln${on ? " done" : ""}`} aria-pressed={on} onClick={() => mark([l.id], !on)}>
                              <span className={`chk${on ? " on" : ""}`} aria-hidden="true">{on ? "✓" : ""}</span>
                              <span style={{ flex: 1, textAlign: "left" }}>
                                <b>{l.name}</b>
                                <span className="lab" style={{ display: "block" }}>{BUCKET_LABEL[l.bucket]}</span>
                              </span>
                              <span className="num">{pesos(money(l.amount))}</span>
                            </button>
                          );
                        })}
                        {done < g.mine.length && (
                          <button type="button" className="btn sm wal-all" onClick={(e) => mark(g.mine.filter((l) => !sent.has(l.id)).map((l) => l.id), true, e.currentTarget.getBoundingClientRect())}>
                            Mark {g.name} all sent
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              <div className="ritual-actions">
                <button type="button" className="btn" onClick={() => setStep(2)}>Back</button>
                {allDone ? (
                  <button type="button" className="btn pri" onClick={() => setStep(4)}>Continue</button>
                ) : (
                  <button type="button" className="btn pri" onClick={markEverything} disabled={lines.length === 0}>Mark everything sent</button>
                )}
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="stage done">
              <Pip happy />
              <p className="lab" style={{ margin: 0 }}>All {lines.length} transfers sent</p>
              {data.unplanned !== null && data.unplanned > 0 ? (
                <>
                  <p className="sub" style={{ margin: 0 }}>Yours to spend this cutoff</p>
                  <div className="balance"><small>₱</small>{peso(data.unplanned)}</div>
                  <p className="sub" style={{ margin: 0 }}>About ₱{peso(spendPerDay)} a day for {data.daysLeft} days. Go touch grass.</p>
                </>
              ) : (
                <p className="sub" style={{ margin: 0 }}>Every peso has a job. Go touch grass.</p>
              )}
              <div className="ritual-actions">
                <button type="button" className="btn" onClick={() => setStep(3)}>Back</button>
                <button type="button" className="btn pri" onClick={() => setView("glance")}>Close</button>
              </div>
            </div>
          )}
        </section>
      ) : (
        <>
          <div className="head">
            <div>
              <span className="lab">{data.planName}</span>
              <h1 style={{ marginTop: 6 }}>
                {lines.length === 0 ? hello : data.next.days === 0 ? "Payday is today." : `${data.next.days} ${data.next.days === 1 ? "day" : "days"} to the ${data.next.label}.`}
              </h1>
              <p className="sub">
                {lines.length === 0
                  ? "Nothing to send yet. Add budget lines to get started."
                  : allDone
                    ? "Everything is sent for now. Go touch grass."
                    : "Nothing to do until then. Here is how the month looks."}
              </p>
            </div>
          </div>
          <div className="split">
            <div className="stack">
              <section className="hero" aria-label="Next payday">
                <div className="hero-inner">
                  <div style={{ flex: 1, minWidth: 240 }}>
                    <span className="lab">{data.cutoffLabel}</span>
                    <div className="balance rise"><small>₱</small>{data.cutoffNet === null ? "Set up Pay" : peso(data.cutoffNet)}</div>
                    <div className="hero-actions">
                      {data.unplanned !== null && <span className="pill">{data.unplanned >= 0 ? `₱${peso(data.unplanned)} unplanned` : `₱${peso(-data.unplanned)} over`}</span>}
                      {lines.length === 0 ? (
                        <Link href="/budget" className="btn">Go to Budget</Link>
                      ) : (
                        <button type="button" className="btn" onClick={() => { setStep(allDone ? 3 : 1); setView("ritual"); }}>Review this cutoff</button>
                      )}
                    </div>
                  </div>
                  <Pip happy={allDone} />
                </div>
              </section>
              {data.money && (
                <section className="card" aria-labelledby="mn-h">
                  <div className="head" style={{ margin: "0 0 8px" }}>
                    <h2 id="mn-h" style={{ margin: 0 }}>Your money</h2>
                    <Link href="/accounts" className="btn sm">Accounts</Link>
                  </div>
                  <div className="row"><span>In your accounts</span><b className="num">₱{peso(data.money.cash)}</b></div>
                  <div className="row">
                    <span>Owed on cards{data.money.utilizationPct !== null ? ` (${data.money.utilizationPct}% of limit)` : ""}</span>
                    <b className="num" style={{ color: data.money.debt > 0 ? "var(--err)" : undefined }}>₱{peso(data.money.debt)}</b>
                  </div>
                  <div className="row"><span>Cash minus debt</span><b className="num">{data.money.net < 0 ? "-" : ""}₱{peso(Math.abs(data.money.net))}</b></div>
                  {data.money.cardsDue.map((c) => (
                    <div key={c.name} className="row">
                      <span>{c.name} is due {c.days === 0 ? "today" : `in ${c.days} ${c.days === 1 ? "day" : "days"}`}</span>
                      <span className="num">₱{peso(c.owed)}</span>
                    </div>
                  ))}
                </section>
              )}
              <section className="card" aria-labelledby="gl-h">
                <h2 id="gl-h">Spend by cutoff</h2>
                <CutoffBars rows={data.buckets} />
              </section>
            </div>
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
            </div>
          </div>
        </>
      )}

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
