import { SubNav } from "@/components/subnav";
import { ConfirmButton } from "@/components/confirm-button";
import Link from "next/link";
import { formatPesos, money, sum, type Money } from "@/lib/domain/money";
import type { PayProfile } from "@/lib/pay/compute";
import { formatRange } from "@/lib/plans/format";
import { createClient } from "@/lib/supabase/server";
import { computeEvents, remaining, type WindfallEvent } from "@/lib/windfall/compute";
import { addAllocation, addEvent, deleteAllocation, deleteEvent, toggleAllocation } from "./actions";

const ERRORS: Record<string, string> = {
  invalid: "Check the form: a type, a name, a pay date and the amounts that type needs.",
  "invalid-allocation": "An allocation needs a name and an amount above zero.",
  failed: "That did not save. Try again.",
  noplan: "No plan is active yet. Activate a plan first.",
  past: "The active plan has ended, so it is read-only.",
};
const KIND_LABEL = { thirteenth: "13th month", cip: "CIP", bonus: "Bonus" } as const;
const peso = (m: Money) => formatPesos(m, { symbol: false });
const dateLabel = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return `${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m - 1]} ${d}, ${y}`;
};

export default async function BonusesPage({ searchParams }: PageProps<"/bonuses">) {
  const params = await searchParams;
  const error = typeof params.error === "string" ? ERRORS[params.error] : undefined;
  const detail = process.env.NODE_ENV !== "production" && typeof params.detail === "string" ? params.detail : undefined;

  const supabase = await createClient();
  const { data: plan } = supabase
    ? await supabase.from("plans").select("id,name,start_date,end_date").eq("is_active", true).maybeSingle()
    : { data: null };
  const { data: pay } =
    plan && supabase ? await supabase.from("pay_profiles").select("*").eq("plan_id", plan.id).maybeSingle() : { data: null };
  const { data: eventRows } =
    plan && supabase ? await supabase.from("windfall_events").select("*").eq("plan_id", plan.id).order("pay_date") : { data: null };
  const ids = (eventRows ?? []).map((e) => e.id);
  const { data: allocRows } =
    supabase && ids.length > 0 ? await supabase.from("windfall_allocations").select("*").in("event_id", ids).order("created_at") : { data: null };

  if (!plan || !pay) {
    return (
      <main className="main">
      <SubNav group="month" />
        <div className="head"><div><h1>Bonuses</h1></div></div>
        <section className="card">
          <p className="sub" style={{ margin: 0 }}>{!plan ? "Bonuses belong to a plan, and no plan is active yet." : "Set up your pay first: bonus estimates are worked out from it."}</p>
          <p style={{ marginBottom: 0 }}><Link href={!plan ? "/plans" : "/pay"} className="btn">{!plan ? "Go to Plans" : "Go to Pay"}</Link></p>
        </section>
      </main>
    );
  }

  const profile: PayProfile = {
    annualBase: money(pay.annual_base),
    allowanceSecond: money(pay.allowance_second),
    sss: money(pay.sss),
    pagibig: money(pay.pagibig),
    savingsPlanBp: pay.savings_plan_bp,
    philhealthOverride: pay.philhealth_override === null ? null : money(pay.philhealth_override),
    taxOverrideFirst: null,
    taxOverrideSecond: null,
  };
  const events: WindfallEvent[] = (eventRows ?? []).map((e) => ({
    id: e.id,
    kind: e.kind,
    cutoff: e.cutoff,
    payDate: e.pay_date,
    gross: e.gross === null ? null : money(e.gross),
    cipEligible: e.cip_eligible === null ? null : money(e.cip_eligible),
    cipComponentNum: e.cip_component_num,
    cipMultiplierNum: e.cip_multiplier_num,
  }));
  const results = new Map(computeEvents(profile, events).map((r) => [r.id, r]));
  const allocs = allocRows ?? [];

  return (
    <main className="main">
      <SubNav group="month" />
      <div className="head">
        <div>
          <span className="lab">{plan.name} · {formatRange(plan.start_date, plan.end_date)}</span>
          <h1 style={{ marginTop: 6 }}>Bonuses</h1>
          <p className="sub">13th month, CIP and other windfalls: what you will net, and where it goes.</p>
        </div>
      </div>
      {error && (
        <p className="notice err" role="alert" style={{ marginBottom: 18 }}>
          {error}
          {detail && <small style={{ display: "block", marginTop: 4, fontWeight: 500 }}>Technical detail: {detail}</small>}
        </p>
      )}
      <p className="notice warn" style={{ marginBottom: 18 }}>
        These are estimates. The 90,000 yearly tax-free cap matches published 2026 guides. The way tax is worked out on a bonus (the cutoff
        is annualized, as your old app did) is an approximation, so compare with your payslip.
      </p>

      <div className="split">
        <div className="stack">
          {events.length === 0 && (
            <section className="card"><p className="sub" style={{ margin: 0 }}>No bonuses yet. Add your 13th month or CIP on the right.</p></section>
          )}
          {(eventRows ?? []).map((row) => {
            const r = results.get(row.id)!;
            const mine = allocs.filter((a) => a.event_id === row.id);
            const allocated = sum(mine.map((a) => money(a.amount)));
            const left = remaining(r.net, allocated);
            return (
              <section key={row.id} className="card" aria-labelledby={`e-${row.id}`}>
                <div className="head" style={{ margin: "0 0 8px" }}>
                  <div>
                    <h2 id={`e-${row.id}`} style={{ margin: 0 }}>{row.name} <span className="pill quiet">{KIND_LABEL[row.kind as keyof typeof KIND_LABEL]}</span></h2>
                    <span className="lab">{dateLabel(row.pay_date)} · {row.cutoff === "first" ? "1st" : "2nd"} cutoff</span>
                  </div>
                  <form action={deleteEvent}>
                    <input type="hidden" name="id" value={row.id} />
                    <ConfirmButton message={`Delete ${row.name}? This cannot be undone.`} className="btn sm danger" aria-label={`Delete ${row.name}`}>Delete</ConfirmButton>
                  </form>
                </div>
                <table className="paytable">
                  <tbody>
                    <tr><th scope="row">Gross</th><td className="num">{peso(r.gross)}</td></tr>
                    <tr><th scope="row">Tax-free part (yearly cap)</th><td className="num">{peso(r.exempt)}</td></tr>
                    <tr className="strong"><th scope="row">Estimated net</th><td className="num">{peso(r.net)}</td></tr>
                    <tr><th scope="row">Allocated</th><td className="num">{peso(allocated)}</td></tr>
                    <tr className="strong"><th scope="row">Left to allocate</th><td className="num" style={{ color: left < 0 ? "var(--err)" : undefined }}>{left < 0 ? "−" : ""}{peso(money(Math.abs(left)))}</td></tr>
                  </tbody>
                </table>
                {left < 0 && <p className="notice err" role="status" style={{ marginTop: 10 }}>You have allocated more than the estimated net.</p>}

                <h3 style={{ margin: "16px 0 4px", fontSize: 15 }}>Where it goes</h3>
                {mine.length === 0 && <p className="sub" style={{ margin: "6px 0" }}>Nothing allocated yet.</p>}
                {mine.map((a) => (
                  <div key={a.id} className={`trow${a.done ? " done" : ""}`} style={{ gridTemplateColumns: "44px minmax(0, 1fr) auto auto" }}>
                    <form action={toggleAllocation}>
                      <input type="hidden" name="id" value={a.id} />
                      <input type="hidden" name="done" value={a.done ? "1" : "0"} />
                      <button type="submit" className="check" aria-pressed={a.done} aria-label={`${a.name}, ${peso(money(a.amount))}. ${a.done ? "Moved. Tap to undo." : "Not moved yet. Tap to mark moved."}`} />
                    </form>
                    <span className="tname">{a.name}</span>
                    <span className="num">{peso(money(a.amount))}</span>
                    <form action={deleteAllocation}>
                      <input type="hidden" name="id" value={a.id} />
                      <ConfirmButton message={`Remove ${a.name}?`} className="btn sm danger" aria-label={`Remove ${a.name}`}>Remove</ConfirmButton>
                    </form>
                  </div>
                ))}
                <form action={addAllocation} className="bline add" style={{ gridTemplateColumns: "minmax(0, 1fr) 9rem auto" }}>
                  <input type="hidden" name="eventId" value={row.id} />
                  <input className="input" name="name" placeholder="Where it goes" maxLength={60} aria-label="Allocation name" required />
                  <input className="input num" name="amount" placeholder="0.00" inputMode="decimal" aria-label="Allocation amount" required />
                  <button type="submit" className="btn sm">Add</button>
                </form>
              </section>
            );
          })}
        </div>

        <section className="card" aria-labelledby="add-h">
          <h2 id="add-h">Add a bonus</h2>
          <form action={addEvent} className="form">
            <label className="field">
              <span className="lab">Type</span>
              <select className="input" name="kind" defaultValue="thirteenth" aria-label="Type">
                <option value="thirteenth">13th month</option>
                <option value="cip">CIP</option>
                <option value="bonus">Other bonus</option>
              </select>
            </label>
            <label className="field"><span className="lab">Name</span><input className="input" name="name" maxLength={60} required placeholder="13th month 2026" /></label>
            <div className="form-grid">
              <label className="field"><span className="lab">Pay date</span><input className="input" type="date" name="payDate" required /></label>
              <label className="field">
                <span className="lab">Paid in</span>
                <select className="input" name="cutoff" defaultValue="first" aria-label="Cutoff"><option value="first">1st cutoff</option><option value="second">2nd cutoff</option></select>
              </label>
            </div>
            <label className="field"><span className="lab">Gross amount (blank for a 13th month = one month of basic)</span><input className="input" name="gross" inputMode="decimal" placeholder="50,000.00" /></label>
            <p className="sub" style={{ margin: 0 }}>CIP only: gross = eligible earnings × your component × the company multiplier.</p>
            <label className="field"><span className="lab">CIP: eligible earnings</span><input className="input" name="cipEligible" inputMode="decimal" placeholder="600,000.00" /></label>
            <div className="form-grid">
              <label className="field"><span className="lab">CIP: component, %</span><input className="input" name="cipComponentPct" inputMode="decimal" placeholder="13.81505" /></label>
              <label className="field"><span className="lab">CIP: multiplier</span><input className="input" name="cipMultiplier" inputMode="decimal" placeholder="1.25" /></label>
            </div>
            <button type="submit" className="btn">Add bonus</button>
          </form>
        </section>
      </div>
    </main>
  );
}
