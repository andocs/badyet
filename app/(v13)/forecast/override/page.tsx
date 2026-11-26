import Link from "next/link";
import { OverrideBulk, OverrideMonth, type Sim } from "@/components/v13/funds/override";
import type { FundMeta } from "@/components/v13/funds/forecast-view";
import { forecastInput, forecastRows } from "@/lib/funds/forecast";
import { loadFunds } from "@/lib/funds/load";
import { monthOrder } from "@/lib/engine/funds";
import { monthRange } from "@/lib/engine/months";
import { runProjection } from "@/lib/engine/projection";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Change a month · Bad(yet)" };

const PALETTE = ["#34D399", "#7FA8FF", "#F6C453", "#C4A0FF", "#5CD0E6", "#F28BC8"];
const BLURB = { steps: "Fills in steps", cap: "Fills to cap", reset: "Resets each year", fixed: "Fixed monthly" } as const;

export default async function Override({ searchParams }: { searchParams: Promise<{ m?: string; bulk?: string; y?: string }> }) {
  const supabase = await createClient();
  if (!supabase) return <p className="v-main">Supabase is not configured.</p>;
  const sp = await searchParams;
  const d = await loadFunds(supabase);
  if (d.funds.length === 0 || !d.budget.salary.input.events.some((e) => e.kind === "start")) {
    return <main className="v-main"><div className="v-note">Set up your salary and at least one fund first. <Link href="/funds">Open Funds</Link></div></main>;
  }
  const start = d.budget.salary.thisMonth;
  const months = monthRange(start, 60) as string[];
  const input = forecastInput(d, start, 60);
  const run = runProjection(input, { includeExpected: true });
  const rows = forecastRows(run, new Set(d.overrides.map((o) => o.month)));
  const funds: FundMeta[] = d.funds.map((f, i) => ({ id: f.id, name: f.name, color: d.colors.get(f.id) ?? PALETTE[i % PALETTE.length]!, blurb: BLURB[f.rule], resets: f.rule === "reset" && f.id !== d.budget.salary.input.settings.savingsPlanFundId }));
  const years = [...new Set(rows.map((r) => r.year))];

  if (sp.bulk) {
    const year = years.includes(Number(sp.y)) ? Number(sp.y) : years[0]!;
    const custom = Object.fromEntries(d.overrides.filter((o) => o.order && o.order.length).map((o) => [o.month as string, true]));
    return <main className="v-main"><OverrideBulk year={year} years={years} funds={funds} rows={rows} firstMonths={custom} /></main>;
  }

  const month = months.includes(sp.m ?? "") ? (sp.m as string) : months[1]!;
  const planFundId = d.budget.salary.input.settings.savingsPlanFundId ?? null;
  // The funds are already in priority order; January puts the yearly-reset funds first.
  const defaultOrder = monthOrder(d.funds, month, planFundId).map((f) => f.id);
  const own = d.overrides.find((o) => o.month === month);
  const sim: Sim = {
    funds: d.funds,
    start: Object.fromEntries(d.funds.map((f) => [f.id, d.fundStart[f.id] ?? 0])),
    months: rows.map((r) => ({ month: r.month, pool: r.pool, bonusSavings: r.bonusSavings, planCredit: planFundId ? (r.funds[planFundId]?.plan ?? 0) : 0 })),
    planFundId,
    overrides: d.overrides.map((o) => ({ month: o.month, order: o.order ?? null, pins: o.pins ?? {}, skips: o.skips ?? [], overflow: o.overflow ?? null })),
  };
  return (
    <main className="v-main">
      <OverrideMonth
        key={month}
        month={month}
        funds={funds}
        defaultOrder={defaultOrder}
        sim={sim}
        existing={own ? { order: own.order ?? null, pins: own.pins ?? {}, skips: own.skips ?? [], note: d.notes.get(month) ?? "", overflow: own.overflow ?? null } : null}
        months={months}
      />
    </main>
  );
}
