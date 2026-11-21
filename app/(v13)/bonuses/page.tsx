import Link from "next/link";
import { loadBonuses } from "@/lib/bonuses/load";
import { bonusCards, yearSummary } from "@/lib/bonuses/view";
import { formatPesos, money } from "@/lib/domain/money";
import { createClient } from "@/lib/supabase/server";
import { BonusCardView, DEST_COLOR } from "@/components/v13/bonuses/card";
import { RulesPanel } from "@/components/v13/bonuses/rules";
import { Money } from "@/components/v13/money";

export const metadata = { title: "Bonuses · Bad(yet)" };

export default async function Bonuses({ searchParams }: { searchParams: Promise<{ y?: string }> }) {
  const supabase = await createClient();
  if (!supabase) return <p className="v-main">Supabase is not configured.</p>;
  const { y } = await searchParams;
  const data = await loadBonuses(supabase);
  const input = data.salary.input;
  const years = Array.from({ length: 6 }, (_, i) => data.thisYear + i);
  const year = years.includes(Number(y)) ? Number(y) : data.thisYear;
  const hasStart = input.events.some((e) => e.kind === "start");

  const funds = new Map(data.funds.map((f) => [f.id, f.name]));
  const cards = hasStart ? bonusCards(year, input, data.saved, funds) : [];
  const sum = yearSummary(cards);
  const prev = hasStart && year > data.thisYear ? yearSummary(bonusCards(year - 1, input, data.saved, funds)) : null;
  const total = Math.max(1, sum.net);

  return (
    <main className="v-main">
      <div className="v-stack v-l">
        <div className="v-row v-sp v-wrap">
          <div>
            <h1>Bonuses</h1>
            <div className="v-lbl">Every bonus, gross to net, and where each peso goes. It works like a small budget of its own.</div>
          </div>
        </div>
        <div className="v-seg v-fit" role="group" aria-label="Bonus year">
          {years.map((yr) => <Link key={yr} href={`/bonuses?y=${yr}`} className="v-segl" aria-current={yr === year ? "true" : undefined}>{yr}{yr === data.thisYear ? " · this year" : ""}</Link>)}
        </div>

        <div className="v-cols4">
          <div className="v-stack">
            {!hasStart ? (
              <div className="v-note"><b>No salary on file yet.</b> Bonuses follow your pay, so add your salary under Salary and tax first.</div>
            ) : (
              <>
                <section className="v-hero" aria-labelledby="hh">
                  <div className="v-row v-sp v-hrow">
                    <div>
                      <div className="v-lbl" id="hh">Bonus money in {year}, after tax</div>
                      <div className="v-big v-xl num">{formatPesos(sum.net)}</div>
                      <div className="v-muted"><Money value={sum.gross} /> gross · <Money value={sum.tax} /> tax · {sum.count} bonus{sum.count === 1 ? "" : "es"}{prev ? <> · <b><Money value={money(sum.net - prev.net)} signed /></b> vs {year - 1}</> : null}</div>
                    </div>
                    <span className="v-pip" aria-hidden="true" />
                  </div>
                  {sum.net > 0 ? (
                    <>
                      <div className="v-stk" style={{ marginTop: 16 }} role="img" aria-label="Where the year's bonus money goes">
                        {sum.byDest.map((d) => <i key={d.key} style={{ width: `${(d.amount / total) * 100}%`, background: DEST_COLOR[d.kind] }} />)}
                        {sum.unplaced > 50 ? <i style={{ width: `${(sum.unplaced / total) * 100}%`, background: "var(--gold)" }} /> : null}
                      </div>
                      <div className="v-dl">
                        {sum.byDest.map((d) => <div key={d.key}><i className="v-dot" style={{ background: DEST_COLOR[d.kind] }} />{d.name}<b><Money value={d.amount} /></b></div>)}
                        {sum.unplaced > 50 ? <div><i className="v-dot" style={{ background: "var(--gold)" }} />Not placed yet<b><Money value={sum.unplaced} /></b></div> : null}
                      </div>
                    </>
                  ) : null}
                </section>
                {cards.length === 0 ? <div className="v-note">No bonuses land in {year}. Add a yearly rule or a one-off on the right.</div> : null}
                {cards.map((c) => (
                  <BonusCardView key={`${c.key}-${c.status}-${c.net}-${c.dests.map((d) => `${d.name}${d.amount}${d.done}`).join(",")}`} card={c} funds={data.funds} baseMultiplier={input.assumptions.cipMultiplierNum} />
                ))}
              </>
            )}
          </div>
          <aside className="v-stack">
            <RulesPanel rules={[...input.bonusRules]} />
            <div className="v-note"><b>Edit a rule</b> to choose which cutoff its bonus lands in; the payslip builder reads it. <b>Shared ₱90,000 cap.</b> The part of each bonus left after its de minimis counts toward one cap per year. Past it, the excess is taxed. The 13th month has no de minimis.</div>
          </aside>
        </div>
      </div>
    </main>
  );
}
