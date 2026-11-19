import Link from "next/link";
import { SavingsChart } from "@/components/savings-chart";
import type { GoalId } from "@/lib/domain/allocator";
import { formatPesos, money, type Money } from "@/lib/domain/money";
import { formatRange } from "@/lib/plans/format";
import { isPastPlan } from "@/lib/plans/validate";
import { loadSavings } from "@/lib/savings/load";
import { GOAL_LABEL, PRIORITIES, priorityLabel } from "@/lib/savings/input";
import { createClient } from "@/lib/supabase/server";
import { currentMonth } from "@/lib/transfer/month";
import { saveSettings, setOverride } from "./actions";

const ERRORS: Record<string, string> = {
  invalid: "Check the settings: the start month, a step above zero for the Emergency fund, and amounts like 100,000.",
  failed: "That did not save. Try again.",
  past: "This plan has ended, so its savings forecast is read-only.",
};
const peso = (m: Money) => formatPesos(m, { symbol: false });
const GOALS: GoalId[] = ["EF", "TRAVEL", "WANTS"];
const COLOR: Record<GoalId, string> = { EF: "var(--accent)", TRAVEL: "var(--accent-2)", WANTS: "var(--bucket-3)" };
const STATUS_LABEL = { CAP_HIT: "Step reached", PAUSED: "Paused", EMPTY: "Empty", ACTIVE: "Saving" } as const;

export default async function SavingsPage({ searchParams }: PageProps<"/savings">) {
  const params = await searchParams;
  const error = typeof params.error === "string" ? ERRORS[params.error] : undefined;
  const detail = process.env.NODE_ENV !== "production" && typeof params.detail === "string" ? params.detail : undefined;

  const supabase = await createClient();
  const { data: plan } = supabase
    ? await supabase.from("plans").select("id,name,start_date,end_date").eq("is_active", true).maybeSingle()
    : { data: null };

  if (!plan || !supabase) {
    return (
      <main className="main">
        <div className="head"><div><h1>Savings forecast</h1></div></div>
        <section className="card">
          <p className="sub" style={{ margin: 0 }}>The forecast belongs to a plan, and no plan is active yet.</p>
          <p style={{ marginBottom: 0 }}><Link href="/plans" className="btn">Go to Plans</Link></p>
        </section>
      </main>
    );
  }

  const { row, overrides, monthlyPool, cipByMonth, savings, results } = await loadSavings(supabase, plan.id);
  const past = isPastPlan(plan.end_date);
  const field = (m: number | null | undefined) => (m === null || m === undefined || m === 0 ? "" : peso(money(m)));

  return (
    <main className="main">
      <div className="head">
        <div>
          <span className="lab">{plan.name} · {formatRange(plan.start_date, plan.end_date)}</span>
          <h1 style={{ marginTop: 6 }}>Savings forecast</h1>
          <p className="sub">
            Your Savings budget lines add up to ₱{peso(monthlyPool)} a month. This shows how that fills your funds, in your priority order.
          </p>
        </div>
      </div>
      {error && (
        <p className="notice err" role="alert" style={{ marginBottom: 18 }}>
          {error}
          {detail && <small style={{ display: "block", marginTop: 4, fontWeight: 500 }}>Technical detail: {detail}</small>}
        </p>
      )}
      {params.saved === "1" && <p className="notice ok" role="status" style={{ marginBottom: 18 }}>Saved.</p>}

      {savings && results.length > 0 && (
        <>
          <section className="card" aria-labelledby="chart-h" style={{ marginBottom: 18 }}>
            <h2 id="chart-h">Balances over the next 12 months</h2>
            <SavingsChart
              months={results.map((r) => r.month)}
              series={GOALS.map((g) => ({
                label: GOAL_LABEL[g],
                color: COLOR[g],
                values: results.map((r) => (g === "EF" ? r.balances.ef : g === "TRAVEL" ? r.balances.travel : r.balances.wants) / 100),
              }))}
            />
          </section>

          <section className="card" aria-labelledby="table-h" style={{ marginBottom: 18, overflowX: "auto" }}>
            <h2 id="table-h">Month by month</h2>
            <table className="paytable forecast">
              <thead>
                <tr>
                  <th scope="col">Month</th>
                  <th scope="col">Saved</th>
                  {GOALS.map((g) => (<th key={g} scope="col">{GOAL_LABEL[g]}</th>))}
                  <th scope="col">Lead this month</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr key={r.month}>
                    <th scope="row">{r.month}{cipByMonth[r.month] !== undefined && <span className="pill quiet" style={{ marginLeft: 6 }}>CIP</span>}</th>
                    <td className="num">{peso(r.pool)}</td>
                    {GOALS.map((g) => {
                      const got = r.received[g];
                      const bal = g === "EF" ? r.balances.ef : g === "TRAVEL" ? r.balances.travel : r.balances.wants;
                      return (
                        <td key={g}>
                          <div className="num">{peso(bal)}</div>
                          <small className="lab">{got > 0 ? `+${peso(got)} · ` : ""}{STATUS_LABEL[r.status[g]]}</small>
                        </td>
                      );
                    })}
                    <td>
                      {past ? (
                        <span className="lab">{overrides[r.month] ? GOAL_LABEL[overrides[r.month]] : "Default order"}</span>
                      ) : (
                        <form action={setOverride} className="ovr">
                          <input type="hidden" name="planId" value={plan.id} />
                          <input type="hidden" name="month" value={r.month} />
                          <select className="input" name="goal" defaultValue={overrides[r.month] ?? ""} aria-label={`Lead fund for ${r.month}`}>
                            <option value="">Default order</option>
                            {GOALS.map((g) => (<option key={g} value={g}>{GOAL_LABEL[g]} first</option>))}
                          </select>
                          <button type="submit" className="btn sm ghost">Set</button>
                        </form>
                      )}
                      {r.notes.map((n) => (<small key={n} className="lab" style={{ display: "block" }}>{n}</small>))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {results.some((r) => r.unallocated > 0) && (
              <p className="notice warn" style={{ marginTop: 12 }}>
                Some months have savings left over because every fund has reached its cap. Raise a cap or lower a Savings budget line.
              </p>
            )}
          </section>
        </>
      )}

      <section className="card" aria-labelledby="set-h" style={{ maxWidth: 720 }}>
        <h2 id="set-h">{savings ? "Settings" : "Set up your funds"}</h2>
        {!savings && <p className="sub" style={{ marginTop: 0 }}>Tell me where your funds stand today and how big each one may grow. Caps of 0 mean no cap (Emergency fund) or switched off (Wants).</p>}
        <form action={saveSettings} className="form">
          <input type="hidden" name="planId" value={plan.id} />
          <div className="form-grid">
            <label className="field"><span className="lab">Forecast starts</span><input className="input" type="month" name="startMonth" required disabled={past} defaultValue={savings?.startMonth ?? currentMonth()} /></label>
            <label className="field">
              <span className="lab">Priority order</span>
              <select className="input" name="priority" disabled={past} defaultValue={savings?.priority ?? PRIORITIES[0]} aria-label="Priority order">
                {PRIORITIES.map((p) => (<option key={p} value={p}>{priorityLabel(p)}</option>))}
              </select>
            </label>
            <label className="field"><span className="lab">Emergency fund today</span><input className="input" name="startEf" inputMode="decimal" disabled={past} defaultValue={field(row?.start_ef)} placeholder="0.00" /></label>
            <label className="field"><span className="lab">Travel fund today</span><input className="input" name="startTravel" inputMode="decimal" disabled={past} defaultValue={field(row?.start_travel)} placeholder="0.00" /></label>
            <label className="field"><span className="lab">Wants fund today</span><input className="input" name="startWants" inputMode="decimal" disabled={past} defaultValue={field(row?.start_wants)} placeholder="0.00" /></label>
            <label className="field"><span className="lab">Emergency fund step</span><input className="input" name="efTranche" inputMode="decimal" required disabled={past} defaultValue={field(row?.ef_tranche)} placeholder="100,000.00" /></label>
            <label className="field"><span className="lab">Emergency fund hard cap (0 = none)</span><input className="input" name="efHardCap" inputMode="decimal" disabled={past} defaultValue={field(row?.ef_hard_cap)} placeholder="500,000.00" /></label>
            <label className="field"><span className="lab">Travel cap</span><input className="input" name="travelCap" inputMode="decimal" disabled={past} defaultValue={field(row?.travel_cap)} placeholder="150,000.00" /></label>
            <label className="field"><span className="lab">Wants cap (0 = off)</span><input className="input" name="wantsCap" inputMode="decimal" disabled={past} defaultValue={field(row?.wants_cap)} placeholder="60,000.00" /></label>
          </div>
          <p className="sub" style={{ margin: 0 }}>
            How it works: the Emergency fund is filled one step at a time. Each January the Travel fund resets and gets first call until its cap. A CIP
            in your Bonuses is added to the month it is paid. These rules come from your old app.
          </p>
          {!past && <button type="submit" className="btn">Save settings</button>}
        </form>
      </section>
    </main>
  );
}
