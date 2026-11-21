import Link from "next/link";
import { cutoffText, monthFlag } from "@/lib/budget/view";
import { buildBudgetScreen, monthLabel, TIGHT, type BudgetScreen } from "@/lib/budget/screen";
import { loadBudget, type BudgetData } from "@/lib/budget/load";
import { poolBalanceNow, poolExcess } from "@/lib/budget/pools";
import { cutoffOfficeDays, settleRows } from "@/lib/budget/rto";
import type { YearMonth } from "@/lib/domain/dates";
import { formatPesos, money, sum, type Money as MoneyValue } from "@/lib/domain/money";
import { rtoDayBudget } from "@/lib/engine/budget";
import { cutoffSettingsFromPaydays, usualOfficeDays } from "@/lib/engine/months";
import type { ProjectionMonth } from "@/lib/engine/projection";
import { shortDate, rangeLabel } from "@/lib/now/format";
import { createClient } from "@/lib/supabase/server";
import { Money } from "@/components/v13/money";
import { BudgetBoard } from "@/components/v13/budget/board";
import { YearMonths } from "@/components/v13/budget/year-months";
import { CategoriesCard, PoolsCard, RtoCard, SettleCard } from "@/components/v13/budget/side-cards";

export const metadata = { title: "Budget · Bad(yet)" };

const PALETTE = ["var(--accent)", "var(--blue)", "var(--gold)", "var(--violet)", "var(--teal)"];
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default async function Budget({ searchParams }: { searchParams: Promise<{ v?: string; m?: string; cmp?: string }> }) {
  const supabase = await createClient();
  if (!supabase) return <p className="v-main">Supabase is not configured.</p>;
  const sp = await searchParams;
  const data = await loadBudget(supabase);
  const thisMonth = data.salary.thisMonth;
  const cmp = sp.cmp === "1";
  const screen = buildBudgetScreen(data, { fut: sp.v === "fut", month: sp.m, compare: cmp });
  const { hasStart, fut, month, year, nowRun, yearRun, yearWithout, shown, wantsAdj, groups, topUpRaises } = screen;
  const cutoffKey = data.period.which === 1 ? "first" : "second";
  const colors = PALETTE;

  const link = (q: Record<string, string>) => `/budget?${new URLSearchParams(q).toString()}`;

  return (
    <main className="v-main">
      <div className="v-stack v-l">
        <div className="v-row v-sp v-wrap">
          <div>
            <h1>Budget</h1>
            <div className="v-lbl">{fut ? "Rules re-run against each month's projected take-home" : `${monthLabel(data.period.month)} · what the rules say, and what has gone out so far`}</div>
          </div>
          <div className="v-seg" role="group" aria-label="View">
            <Link href="/budget" className="v-segl" aria-current={!fut ? "true" : undefined}>This month</Link>
            <Link href="/budget?v=fut" className="v-segl" aria-current={fut ? "true" : undefined}>Future years</Link>
          </div>
        </div>

        {!hasStart || !shown ? (
          <div className="v-note"><b>No salary on file yet.</b> The budget needs your take-home. Add your salary under Salary and tax first.</div>
        ) : (
          <div className="v-cols3">
            <div className="v-stack">
              {fut ? <FutureYears year={year} thisYear={Number(thisMonth.slice(0, 4))} month={month} run={yearRun!} without={yearWithout} cmp={cmp} link={link} groupsList={data.groups} colors={colors} /> : null}
              <Summary screen={screen} data={data} />
              {fut && cmp ? <Compare shown={shown} without={yearWithout?.find((m) => m.month === month) ?? null} /> : null}
              <BudgetBoard
                groups={groups}
                colors={colors}
                categories={data.categories.map((c) => ({ id: c.id, name: c.name, groupId: c.groupId }))}
                accounts={data.accounts}
                showSpent={!fut}
                takeHome={shown.pay.takeHome}
              />
              {topUpRaises.length > 0 ? (
                <div className="v-note">Top-ups come from raises: <b>{topUpRaises.join(", ")}</b>. Change or remove the raise and they follow.</div>
              ) : null}
            </div>
            {nowRun ? <Side data={data} nowRun={nowRun} cutoffKey={cutoffKey} /> : null}
          </div>
        )}
      </div>
    </main>
  );
}

function Summary({ screen, data }: { screen: BudgetScreen; data: BudgetData }) {
  const { shown, fut, wantsAdj, rest, fixed, flag, takeHome: take } = screen;
  if (!shown) return null;
  const b = shown.budget;
  return (
    <>
      <section className="v-hero">
        <div className="v-row v-sp v-wrap">
          <div>
            <div className="v-lbl">Left of take-home, {monthLabel(shown.month)}{shown.assumed ? " (assumed raise)" : ""}</div>
            <div className="v-big" style={{ fontSize: 38 }}><span className="amt v-num">{formatPesos(money(Math.max(0, rest)))}</span><span className="v-lbl" style={{ fontSize: 18, fontWeight: 700 }}> / <span className="amt v-num">{formatPesos(take)}</span></span></div>
          </div>
        </div>
        <div className="v-row v-wrap" style={{ marginTop: 10, gap: 8 }}>
          <span className="v-pill">Fixed lines <Money value={fixed} /> · {take > 0 ? Math.round((fixed / take) * 100) : 0}% of take-home</span>
          {!fut ? <span className="v-pill">Cutoffs: {rangeLabel(data.period.start, data.period.end)}</span> : null}
          {!fut ? <span className="v-pill v-ok">Daily pool this cutoff <Money value={money(b.dailyPool[data.period.which === 1 ? "first" : "second"] + wantsAdj)} />{wantsAdj !== 0 ? " (incl. pools)" : ""}</span> : null}
          {shown.assumed ? <span className="v-pill v-est">assumed raise year</span> : null}
          {shown.expected ? <span className="v-pill v-est">includes an expected raise</span> : null}
        </div>
      </section>
      {flag === "over" ? (
        <div className="v-flag v-bad"><b>!</b><span>Fixed and percent lines are over take-home in {monthLabel(shown.month)}. Trim a line or move a start date.</span></div>
      ) : flag === "tight" ? (
        <div className="v-flag"><b>!</b><span>Tight month: only <Money value={rest} /> left after every line.</span></div>
      ) : null}
    </>
  );
}

function Compare({ shown, without }: { shown: ProjectionMonth; without: ProjectionMonth | null }) {
  if (!shown.expected || !without) return <div className="v-note"><b>Nothing to compare.</b> No expected raise has taken effect by {monthLabel(shown.month)}.</div>;
  const tops = (m: ProjectionMonth) => sum(m.budget.lines.flatMap((l) => l.topUps.map((t) => money(t.first + t.second))));
  const rest = (m: ProjectionMonth) => money(m.budget.rest.first + m.budget.rest.second);
  const rows: [string, MoneyValue, MoneyValue][] = [
    ["Take-home", shown.pay.takeHome, without.pay.takeHome],
    ["Top-ups you tied to the raise", tops(shown), tops(without)],
    ["Planned (every other line)", money(shown.budget.planned.first + shown.budget.planned.second - tops(shown)), money(without.budget.planned.first + without.budget.planned.second - tops(without))],
    ["Whatever is left", rest(shown), rest(without)],
  ];
  return (
    <section className="v-card" aria-labelledby="cmph">
      <h2 id="cmph">{monthLabel(shown.month)}, with and without your expected raises</h2>
      <div className="v-scrollx">
        <table>
          <thead><tr><th>Per month</th><th>With</th><th>Without</th><th>Difference</th></tr></thead>
          <tbody>{rows.map(([n, a, c]) => <tr key={n}><td>{n}</td><td className="v-num"><Money value={a} /></td><td className="v-num"><Money value={c} /></td><td className={`v-num ${a - c >= 0 ? "v-pos" : "v-neg"}`}><Money value={money(a - c)} signed /></td></tr>)}</tbody>
        </table>
      </div>
      <p className="v-xs v-muted" style={{ margin: "10px 0 0" }}>&quot;Without&quot; means the expected raises never happen, so the top-ups you tied to them disappear too.</p>
    </section>
  );
}

function FutureYears({ year, thisYear, month, run, without, cmp, link, groupsList, colors }: {
  year: number; thisYear: number; month: YearMonth; run: ProjectionMonth[]; without: ProjectionMonth[] | null; cmp: boolean;
  link: (q: Record<string, string>) => string; groupsList: BudgetData["groups"]; colors: string[];
}) {
  const maxTake = Math.max(...run.map((m) => m.pay.takeHome), 1);
  const years = Array.from({ length: 6 }, (_, i) => thisYear + i);
  return (
    <>
      <div className="v-row v-sp v-wrap">
        <div className="v-seg" role="group" aria-label="Year">
          {years.map((y) => <Link key={y} href={link({ v: "fut", m: `${y}-${month.slice(5)}`, ...(cmp ? { cmp: "1" } : {}) })} className="v-segl" aria-current={y === year ? "true" : undefined}>{y}</Link>)}
        </div>
        <Link className="v-btn v-sm" aria-pressed={cmp} href={link({ v: "fut", m: month, ...(cmp ? {} : { cmp: "1" }) })}>{cmp ? "Hide comparison" : "Compare without expected raises"}</Link>
      </div>
      <section className="v-card">
        <div className="v-row v-sp v-wrap"><h2>{year} by month</h2><div className="v-legend">{groupsList.map((g, i) => <span key={g.id}><i className="v-dot" style={{ background: colors[i % colors.length] }} />{g.name}</span>)}</div></div>
        <YearMonths
          key={year}
          year={year}
          cols={run.map((m) => {
            const flag = monthFlag(m.budget, money(TIGHT));
            return {
              month: m.month,
              short: MON[Number(m.month.slice(5)) - 1]!,
              href: link({ v: "fut", m: m.month, ...(cmp ? { cmp: "1" } : {}) }),
              selected: m.month === month,
              flag: flag === "over" || flag === "tight" ? flag : null,
              expected: m.expected,
              h: (m.pay.takeHome / maxTake) * 96,
              aria: `${monthLabel(m.month)}: take-home ${formatPesos(m.pay.takeHome)}${flag ? `, ${flag === "over" ? "over budget" : "tight"}` : ""}${m.expected ? ", includes an expected raise" : ""}`,
            };
          })}
        />
        <div className="v-xs v-muted" style={{ marginTop: 8 }}>Bar height = take-home. ! = tight or over. ○ = includes an expected raise.</div>
      </section>
    </>
  );
}

function Side({ data, nowRun, cutoffKey }: { data: BudgetData; nowRun: ProjectionMonth; cutoffKey: "first" | "second" }) {
  const settings = cutoffSettingsFromPaydays(data.paydays.first, data.paydays.second);
  const period = { start: data.period.start, end: data.period.end };
  const contLine = data.lines.find((l) => l.kind === "rto_contingency") ?? null;
  const amountOf = (id: string | null) => (id ? (nowRun.budget.lines.find((l) => l.lineId === id)?.[cutoffKey] ?? 0) : 0);
  const days = cutoffOfficeDays(period, data.officeDays, data.overrides);
  const usualCount = usualOfficeDays(period, data.officeDays);
  const dayBudget = rtoDayBudget(nowRun.budget.rtoTotal[cutoffKey], usualCount);
  const extra = days.filter((d) => d.extra).length;

  const pools = data.pools.map((p) => {
    const perCutoff = money(amountOf(p.lineId));
    const balance = poolBalanceNow({ createdOn: p.createdOn, today: data.today, settings, perCutoff, entries: p.entries });
    return { p, perCutoff, balance, excess: poolExcess(balance, p.keepUpTo) };
  });
  const cont = contLine ? pools.find((x) => x.p.lineId === contLine.id) : undefined;
  const settleKinds: Record<string, string> = { settle_to_pool: "contingency pool", settle_to_wants: "Wants", over_from_wants: "Wants", over_from_excess: "contingency excess" };
  const settled = new Map<string, string>();
  for (const e of cont?.p.entries ?? []) if (settleKinds[e.kind]) settled.set(e.occurredOn, settleKinds[e.kind]!);
  const rows = settleRows({ days, spendByDay: data.spendByDay, dayBudget, settledDays: new Set(settled.keys()), today: data.today });


  const catView = data.categories.map((c) => ({ id: c.id, name: c.name, color: c.color ?? "var(--muted)", groupId: c.groupId, lines: data.lines.filter((l) => l.categoryId === c.id).length }));

  return (
    <aside className="v-stack">
      <SettleCard
        rows={rows.map((r) => ({ date: r.date, weekday: days.find((d) => d.date === r.date)!.weekday, spent: r.spent, budget: r.budget, diff: r.diff, settledTo: settled.get(r.date) ?? null }))}
        excess={cont?.excess ?? 0}
      />
      <RtoCard
        usual={data.officeDays}
        days={days.map((d) => ({ date: d.date, weekday: d.weekday, usual: d.usual, office: d.office, extra: d.extra }))}
        today={data.today}
        dayBudget={dayBudget}
        contingency={amountOf(contLine?.id ?? null)}
        extraUsed={extra * dayBudget}
        rtoLines={data.lines.filter((l) => l.kind === "rto").map((l) => ({ name: l.name, amount: amountOf(l.id) }))}
        contingencyName={contLine?.name ?? null}
        range={rangeLabel(data.period.start, data.period.end)}
        planned={days.filter((d) => d.office && d.usual).length}
        skipped={days.filter((d) => d.skipped).length}
      />
      <PoolsCard
        pools={pools.map(({ p, perCutoff, balance, excess }) => ({
          id: p.id, name: p.name, balance, excess, perCutoff, keepUpTo: p.keepUpTo,
          log: [...p.entries].sort((a, b) => b.occurredOn.localeCompare(a.occurredOn)).slice(0, 4).map((e) => ({ when: shortDate(e.occurredOn), what: e.note ?? e.kind, amount: ["use", "to_wants", "over_from_excess"].includes(e.kind) ? -e.amount : e.amount })),
        }))}
        lines={data.lines.filter((l) => l.rule !== "rest").map((l) => ({ id: l.id, name: l.name }))}
      />
      <CategoriesCard categories={catView} groups={data.groups.map((g) => ({ id: g.id, name: g.name }))} />
      <div className="v-note"><b>Lines are rules.</b> Change take-home on the Salary page and every future month here moves with it. {cutoffText("both")} lines apply their amount to each cutoff.</div>
    </aside>
  );
}
