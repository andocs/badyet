import Link from "next/link";
import { ForecastView, type FundMeta } from "@/components/v13/funds/forecast-view";
import { forecastInput, forecastRows, totalBalance } from "@/lib/funds/forecast";
import { loadFunds } from "@/lib/funds/load";
import { runProjection } from "@/lib/engine/projection";
import { money, sum } from "@/lib/domain/money";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Forecast · Bad(yet)" };

const PALETTE = ["#34D399", "#7FA8FF", "#F6C453", "#C4A0FF", "#5CD0E6", "#F28BC8"];
const BLURB = { steps: "Fills in steps", cap: "Fills to cap", reset: "Resets each year", fixed: "Fixed monthly" } as const;

export default async function Forecast() {
  const supabase = await createClient();
  if (!supabase) return <p className="v-main">Supabase is not configured.</p>;
  const d = await loadFunds(supabase);
  const hasStart = d.budget.salary.input.events.some((e) => e.kind === "start");
  if (!hasStart || d.funds.length === 0) {
    return (
      <main className="v-main">
        <div className="v-stack v-l v-narrow">
          <h1>Where I&apos;ll be</h1>
          <div className="v-card v-stack">
            <p style={{ margin: 0 }}>{!hasStart ? "The forecast needs your salary. Add it under Salary and tax." : "The forecast needs at least one fund to fill from your savings pool."}</p>
            <Link className="v-btn v-pri" href={!hasStart ? "/pay" : "/funds"}>{!hasStart ? "Open Salary and tax" : "Open Funds"}</Link>
          </div>
        </div>
      </main>
    );
  }

  const start = d.budget.salary.thisMonth;
  const input = forecastInput(d, start, 60);
  const run = runProjection(input, { includeExpected: true });
  const hasExpected = run.some((m) => m.expected);
  const without = hasExpected ? runProjection(input, { includeExpected: false }) : null;
  const rows = forecastRows(run, new Set(d.overrides.map((o) => o.month)), d.held);

  const funds: FundMeta[] = d.funds.map((f, i) => ({ id: f.id, name: f.name, color: d.colors.get(f.id) ?? PALETTE[i % PALETTE.length]!, blurb: BLURB[f.rule], resets: f.rule === "reset" && f.id !== d.budget.salary.input.settings.savingsPlanFundId }));
  const name = new Map(d.funds.map((f) => [f.id, f.name]));
  const peso = (n: number) => `₱${(n / 100).toLocaleString("en-PH", { maximumFractionDigits: 2 })}`;
  const overrides = d.overrides
    .map((o) => ({
      month: o.month as string,
      note: d.notes.get(o.month) ?? "",
      what: [
        o.order && o.order.length ? `New order (${name.get(o.order[0]!) ?? "a fund"} first)` : "",
        Object.keys(o.pins ?? {}).length ? `Pinned ${Object.entries(o.pins ?? {}).map(([id, a]) => `${name.get(id) ?? "fund"} ${peso(a)}`).join(", ")}` : "",
        (o.skips ?? []).length ? `Skipped ${(o.skips ?? []).map((id) => name.get(id) ?? "fund").join(", ")}` : "",
      ].filter(Boolean).join(" · "),
    }))
    .sort((a, b) => a.month.localeCompare(b.month));

  // The payroll savings plan, shown on its own so it is clear whether the forecast counts it (only when it names a fund).
  const planFundId = d.budget.salary.input.settings.savingsPlanFundId ?? null;
  const plan = {
    perMonth: sum([...run[0]!.pay.first.lines, ...run[0]!.pay.second.lines].filter((l) => l.source === "savings_plan").map((l) => l.amount)),
    fund: planFundId ? name.get(planFundId) ?? null : null,
    fundSet: planFundId != null,
  };

  return (
    <main className="v-main">
      <ForecastView
        plan={plan}
        funds={funds}
        rows={rows}
        startTotal={sum(d.funds.map((f) => d.fundStart[f.id] ?? money(0)))}
        withoutTotal={without ? totalBalance(forecastRows(without, new Set(), d.held)[59]!) : null}
        overrides={overrides}
      />
    </main>
  );
}
