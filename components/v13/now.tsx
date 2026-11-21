import Link from "next/link";
import { HideAmounts } from "@/components/hide-amounts";
import { formatPesos, money, type Money as MoneyValue } from "@/lib/domain/money";
import { isoDate } from "@/lib/domain/dates";
import type { AccountCard, NowData } from "@/lib/now/load";
import { dayLabel, ordinalCutoff, rangeLabel, relativeDay, shortDate, weekdayName } from "@/lib/now/format";
import { manilaDate, type Envelope, type NowTxn, type NowView } from "@/lib/now/summary";
import { V13Icon } from "./icons";
import { Money } from "./money";
import { QuickAddButton } from "./quick-add";

type Ready = Extract<NowData, { kind: "ready" }>;
const CARD_COLORS = ["#2F5BD7", "#087A5A", "#B03030", "#7A3FB8", "#0F7A95", "#B83A86"];

export function NowPage({ data, pending }: { data: Ready; pending: number }) {
  const { view, today } = data;
  return (
    <main className="v-main">
      <div className="v-stack v-l">
        <div className="v-row v-sp v-wrap">
          <div>
            <h1>{dayLabel(today)}</h1>
            <div className="v-lbl">
              {ordinalCutoff(view.cutoff)} cutoff · {rangeLabel(view.period.start, view.period.end)} · payday {shortDate(view.nextPayday)}
            </div>
          </div>
          <div className="v-row v-wrap">
            <HideAmounts className="v-btn" withIcon />
            <Link className="v-btn" href="/inbox">
              Inbox {pending > 0 ? <span className="v-pill v-ok">{pending} to check</span> : null}
            </Link>
          </div>
        </div>

        <div className="v-top2">
          <Hero view={view} today={today} />
          <Recent txns={view.recent} today={today} />
        </div>

        <AccountsRow accounts={data.accounts} total={data.total} />

        <div className="v-row2">
          <section aria-labelledby="pv">
            <div className="v-row v-sp v-wrap" style={{ marginBottom: 8 }}>
              <h2 id="pv">Planned vs spent</h2>
              <span className="v-lbl">this cutoff</span>
            </div>
            <Envelopes envelopes={view.envelopes} dayNumber={view.dayNumber} daysTotal={view.daysTotal} />
          </section>
          <aside className="v-stack">
            <Bills view={view} />
            {data.settleOpen > 0 ? (
              <section className="v-card" aria-labelledby="st">
                <h2 id="st">Settle office days</h2>
                <div className="v-sm v-muted" style={{ margin: "2px 0 8px" }}>{data.settleOpen} office day{data.settleOpen === 1 ? "" : "s"} ended under or over budget.</div>
                <Link className="v-btn v-sm v-pri" href="/budget">Settle in Budget</Link>
              </section>
            ) : null}
            <div className="v-note">
              <b>Next payday, {shortDate(data.nextPay.date)}:</b> <Money value={data.nextPay.amount} /> lands (your {ordinalCutoff(data.nextPay.cutoff)} cutoff).
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

function Hero({ view, today }: { view: NowView; today: ReturnType<typeof isoDate> }) {
  const officeNote = view.nextOffice !== null || view.isUsualOfficeDay;
  const over = view.overPace > 0;
  return (
    <section className="v-hero" aria-labelledby="safe">
      <div className="v-top3">
        <div>
          <div className="v-lbl" id="safe">Safe to spend today</div>
          <div className="v-big v-xl num">{formatPesos(view.today)}</div>
          {view.pool === 0 ? (
            <div className="v-muted">No budget line counts towards your daily amount yet. Mark your Wants lines in Budget.</div>
          ) : (
            <div className="v-muted">
              per day for {view.daysLeft} {view.daysLeft === 1 ? "day" : "days"}. <Money value={view.left} /> left of <Money value={view.pool} />.
            </div>
          )}
          {officeNote ? (
            <div className="v-sm" style={{ marginTop: 12 }}>
              <b>{view.isUsualOfficeDay ? "A usual office day." : `${weekdayName(today)}, not a usual office day.`}</b>{" "}
              {view.nextOffice ? (
                <span className="v-muted">
                  Next: {dayLabel(view.nextOffice.date)}, <Money value={view.nextOffice.amount} />.
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
        <div className="v-row v-wrap" style={{ gap: 10 }}>
          <QuickAddButton className="v-btn v-pri" label="Add expense">
            + Expense
          </QuickAddButton>
        </div>
      </div>
      <Runway view={view} />
      <div className="v-row v-wrap v-sm" style={{ gap: "6px 16px" }}>
        <span className="v-row" style={{ gap: 6 }}><i className="v-dot" style={{ background: "#5EE6B4" }} />Spent</span>
        <span className="v-row" style={{ gap: 6 }}><i className="v-sw-dash" style={{ color: "#B9C9DD" }} />Plan pace</span>
        <span className="v-row" style={{ gap: 6 }}><i className="v-sw-dash" style={{ color: "#5EE6B4", borderTopStyle: "dotted" }} />If you keep to <Money value={view.perDay} /></span>
      </div>
      <div className="v-row v-sp v-wrap v-sm" style={{ marginTop: 12, gap: 8 }}>
        <span>
          Spent <Money value={view.spent} /> · pace says <Money value={view.pace} /> by today
        </span>
        {view.pool > 0 ? (
          <b>
            <Money value={money(Math.abs(view.overPace))} /> {over ? "over pace." : "under pace."}
          </b>
        ) : null}
      </div>
    </section>
  );
}

/** Cumulative spending against the plan pace over the cutoff, drawn on the hero's dark gradient. */
function Runway({ view }: { view: NowView }) {
  return (
    <>
      <RunwaySvg view={view} W={800} H={190} cls="v-wid" />
      <RunwaySvg view={view} W={360} H={230} cls="v-nar" />
    </>
  );
}

/** Drawn twice at its own size (wide for desktop, narrow for a phone) so the labels stay readable instead of shrinking. */
function RunwaySvg({ view, W, H, cls }: { view: NowView; W: number; H: number; cls: string }) {
  const L = 44, R = 10, T = 12, B = 28;
  const max = Math.max(view.pool, view.cumulative.at(-1) ?? 0, view.cumulative.at(-1)! + view.perDay * view.daysLeft, 100);
  const stepPesos = [500, 1000, 2000, 2500, 5000, 10000, 20000, 25000, 50000, 100000].find((s) => max / 100 / s <= 4) ?? 100000;
  const top = Math.ceil(max / 100 / stepPesos) * stepPesos * 100;
  const x = (d: number) => L + ((W - L - R) * d) / view.daysTotal;
  const y = (v: number) => T + (H - T - B) * (1 - v / top);
  const ticks = Array.from({ length: Math.floor(top / 100 / stepPesos) + 1 }, (_, i) => i * stepPesos * 100);
  const last = view.cumulative.at(-1) ?? 0;
  const label = `Cumulative spending against plan pace over the ${view.daysTotal} day cutoff. Spent ${formatPesos(money(last))} by day ${view.dayNumber}; the plan allows ${formatPesos(view.pool)} by day ${view.daysTotal}.`;
  return (
    <svg className={`v-chart ${cls}`} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} style={{ marginTop: 12 }}>
      {ticks.map((v) => (
        <g key={v}>
          <line className="v-grid" x1={L} x2={W - R} y1={y(v)} y2={y(v)} />
          <text className="amt" x={L - 6} y={y(v) + 4} textAnchor="end">₱{v / 100 >= 1000 ? `${v / 100000}k` : v / 100}</text>
        </g>
      ))}
      {[1, Math.ceil(view.daysTotal / 3), Math.ceil((view.daysTotal * 2) / 3), view.daysTotal].map((d) => (
        <text key={d} x={x(d)} y={H - 8} textAnchor="middle">{d === view.daysTotal ? shortDate(view.period.end) : `Day ${d}`}</text>
      ))}
      <line x1={x(0)} y1={y(0)} x2={x(view.daysTotal)} y2={y(view.pool)} stroke="#B9C9DD" strokeWidth={2} strokeDasharray="5 5" />
      {view.daysLeft > 1 ? (
        <line x1={x(view.dayNumber)} y1={y(last)} x2={x(view.daysTotal)} y2={y(last + view.perDay * (view.daysTotal - view.dayNumber))} stroke="#5EE6B4" strokeWidth={2} strokeDasharray="2 4" />
      ) : null}
      <path d={`M${view.cumulative.map((v, i) => `${x(i)} ${y(v)}`).join(" L")}`} fill="none" stroke="#5EE6B4" strokeWidth={3} strokeLinejoin="round" />
      <circle cx={x(view.dayNumber)} cy={y(last)} r={6} fill="#5EE6B4" stroke="#0B5A4E" strokeWidth={3} />
      <line x1={x(view.dayNumber)} x2={x(view.dayNumber)} y1={T} y2={H - B} stroke="#fff" strokeOpacity={0.3} />
      <text x={x(view.dayNumber) + 6} y={T + 10}>Today</text>
    </svg>
  );
}

function Recent({ txns, today }: { txns: NowTxn[]; today: ReturnType<typeof isoDate> }) {
  let lastDay = "";
  return (
    <section className="v-card v-recent" aria-labelledby="rc">
      <div className="v-row v-sp">
        <h2 id="rc">Recent</h2>
        <Link className="v-sm" href="/inbox">All activity →</Link>
      </div>
      {txns.length === 0 ? (
        <p className="v-muted v-sm" style={{ marginTop: 12 }}>Nothing yet this cutoff. Press + to add your first spend.</p>
      ) : (
        txns.map((t) => {
          const day = manilaDate(t.occurredAt);
          const heading = day !== lastDay ? <div className="v-day">{relativeDay(day, today)}</div> : null;
          lastDay = day;
          return (
            <div key={t.id}>
              {heading}
              <div className="v-row v-rtx">
                <div className="v-grow">
                  <b>{t.merchant ?? (t.kind === "transfer" ? "Transfer" : "Expense")}</b>
                  <div className="v-xs v-muted">
                    {t.accountName}
                    {t.status === "pending" ? <> · <span className="v-warnt">pending</span></> : null}
                  </div>
                </div>
                <b className="v-num"><Money value={t.amount} /></b>
              </div>
            </div>
          );
        })
      )}
    </section>
  );
}

function AccountsRow({ accounts, total }: { accounts: AccountCard[]; total: MoneyValue }) {
  return (
    <section aria-labelledby="wh">
      <div className="v-row v-sp v-wrap" style={{ marginBottom: 8 }}>
        <div className="v-row v-wrap" style={{ gap: 14 }}>
          <h2 id="wh">What I have right now</h2>
          <b className="v-disp" style={{ fontSize: 24 }}><Money value={total} /></b>
        </div>
        <Link className="v-sm" href="/accounts">All accounts →</Link>
      </div>
      {accounts.length === 0 ? (
        <div className="v-note">No accounts yet. Add one under Accounts to see your balances here.</div>
      ) : (
        <div className="v-hscroll" tabIndex={0} role="region" aria-label="Accounts, scroll sideways">
          {accounts.map((a, i) => (
            <Link key={a.id} href={`/accounts?a=${a.id}`} className="v-acard" style={{ "--c": a.color ?? CARD_COLORS[i % CARD_COLORS.length] } as React.CSSProperties}>
              <span className="v-an"><span>{a.name}</span></span>
              <span className="v-ak">{a.kind}{a.last4 ? ` ·· ${a.last4}` : ""}</span>
              <span className="v-ab"><Money value={a.balance} /></span>
              <span className="v-as">{a.confirmedOn ? `Confirmed ${shortDate(isoDate(a.confirmedOn))}` : "No balance set yet"}</span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

function Envelopes({ envelopes, dayNumber, daysTotal }: { envelopes: Envelope[]; dayNumber: number; daysTotal: number }) {
  if (envelopes.length === 0) return <div className="v-note">No spending envelopes yet. Add budget lines in Budget and they appear here.</div>;
  const ratio = dayNumber / daysTotal;
  return (
    <div className="v-envgrid">
      {envelopes.map((e, i) => {
        const pct = e.plan > 0 ? Math.min(100, (e.spent / e.plan) * 100) : 0;
        const tolerance = 2500; // ₱25 either way is "on pace"
        const status =
          e.overPace > tolerance ? (
            <span className="v-pill v-warn"><Money value={e.overPace} /> over pace</span>
          ) : e.overPace < -tolerance ? (
            <span className="v-pill v-ok"><Money value={money(-e.overPace)} /> under pace</span>
          ) : (
            <span className="v-pill v-ok">on pace</span>
          );
        return (
          <details key={e.categoryId} className="v-env" open={i === 0}>
            <summary>
              <div className="v-row v-sp">
                <span className="v-row v-wrap" style={{ gap: 8 }}>
                  <i className="v-dot" style={{ background: e.color }} />
                  <b>{e.name}</b> {status}
                </span>
                <span className="v-row">
                  <span className="v-envleft"><Money value={e.left} /></span>
                  <V13Icon name="chev" className="v-chev" />
                </span>
              </div>
              <div className="v-pace" style={{ marginTop: 12 }}>
                <div className="v-bar v-t" role="img" aria-label={`${e.name}: ${Math.round(pct)} percent used, pace marker at ${Math.round(ratio * 100)} percent`}>
                  <i style={{ width: `${pct}%`, background: e.color }} />
                </div>
                <u style={{ left: `${ratio * 100}%` }} />
              </div>
              <div className="v-row v-sp v-xs v-muted" style={{ marginTop: 6 }}>
                <span><Money value={e.spent} /> spent</span>
                <span>of <Money value={e.plan} /> · marker = pace</span>
              </div>
            </summary>
            <ul className="v-list v-tx">
              {e.txns.length === 0 ? (
                <li className="v-muted">Nothing yet. Pip is proud.</li>
              ) : (
                e.txns.map((t) => (
                  <li key={t.id}>
                    <div className="v-grow">
                      <b>{t.merchant ?? "Expense"}</b>
                      <div className="v-xs v-muted">
                        {shortDate(manilaDate(t.occurredAt))} · {t.accountName}
                        {t.status === "pending" ? <> · <span className="v-warnt">pending</span></> : null}
                      </div>
                    </div>
                    <b className="v-num"><Money value={money(-t.amount)} /></b>
                  </li>
                ))
              )}
            </ul>
          </details>
        );
      })}
    </div>
  );
}

function Bills({ view }: { view: NowView }) {
  const sent = view.bills.filter((b) => b.sent).length;
  return (
    <section className="v-card" aria-labelledby="bt">
      <div className="v-row v-sp">
        <h2 id="bt">Bills and transfers</h2>
        {view.bills.length > 0 ? <span className={`v-pill ${sent === view.bills.length ? "v-ok" : ""}`}>{sent} of {view.bills.length} sent</span> : null}
      </div>
      {view.bills.length === 0 ? (
        <p className="v-muted v-sm" style={{ marginTop: 8 }}>Budget lines that go to an account show here for the cutoff.</p>
      ) : (
        <>
          <div style={{ marginTop: 6 }}>
            {view.bills.map((b) => (
              <div className="v-bl-i" key={b.lineId}>
                <span className="v-chk" aria-checked={b.sent} role="img" aria-label={b.sent ? "sent" : "not sent yet"}>
                  <V13Icon name="check" />
                </span>
                <span className="v-grow">{b.name}</span>
                <b className="v-num"><Money value={b.amount} /></b>
              </div>
            ))}
          </div>
          <div className="v-row v-sp" style={{ paddingTop: 10, borderTop: "1px solid var(--line)", marginTop: 2 }}>
            <b>Sent this cutoff</b>
            <b className="v-num"><Money value={view.billsTotalSent} /></b>
          </div>
        </>
      )}
    </section>
  );
}

/** Shown when there is not enough set up to work out a day's amount. */
export function NowSetup({ reason }: { reason: "no-salary" | "no-budget" }) {
  return (
    <main className="v-main">
      <div className="v-stack v-l v-narrow">
        <h1>Let&apos;s get Now going</h1>
        <div className="v-card v-stack">
          {reason === "no-salary" ? (
            <>
              <p style={{ margin: 0 }}>Now needs your salary to work out what you can spend. The setup wizard takes a few minutes and every step can be skipped.</p>
              <Link className="v-btn v-pri" href="/setup">Run the setup wizard</Link>
            </>
          ) : (
            <>
              <p style={{ margin: 0 }}>Now needs your budget lines to split each cutoff. Add them in Budget.</p>
              <Link className="v-btn v-pri" href="/budget">Open Budget</Link>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
