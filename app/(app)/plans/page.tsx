import Link from "next/link";
import { formatRange } from "@/lib/plans/format";
import { isPastPlan, todayManila } from "@/lib/plans/validate";
import { createClient } from "@/lib/supabase/server";
import { activatePlan, createPlan, deletePlan, duplicatePlan } from "./actions";

const ERRORS: Record<string, string> = {
  invalid: "Check the plan: it needs a name, valid dates, and the end date cannot be before the start date.",
  failed: "That did not work. Try again.",
  past: "Past plans are read-only. Duplicate it to make an editable copy.",
  active: "You cannot delete the active plan. Activate another plan first.",
};

export default async function PlansPage({ searchParams }: PageProps<"/plans">) {
  const params = await searchParams;
  const error = typeof params.error === "string" ? ERRORS[params.error] : undefined;
  const supabase = await createClient();
  const { data: plans } = supabase
    ? await supabase.from("plans").select("id,name,start_date,end_date,is_active").order("start_date", { ascending: false })
    : { data: null };
  const today = todayManila();

  return (
    <main className="main">
      <div className="head">
        <div>
          <h1>Plans</h1>
          <p className="sub">Each plan is one version of your budget. One is active; duplicate it to try an estimate.</p>
        </div>
      </div>

      {error && <p className="notice err" role="alert" style={{ marginBottom: 18 }}>{error}</p>}

      <section className="card" aria-labelledby="new-h" style={{ marginBottom: 18 }}>
        <h2 id="new-h">New plan</h2>
        <form action={createPlan} className="form-row">
          <label className="field"><span className="lab">Name</span><input className="input" name="name" maxLength={60} required placeholder="December 2026" /></label>
          <label className="field"><span className="lab">Starts</span><input className="input" type="date" name="startDate" required /></label>
          <label className="field"><span className="lab">Ends</span><input className="input" type="date" name="endDate" required /></label>
          <button type="submit" className="btn">Create</button>
        </form>
      </section>

      <section className="card" aria-labelledby="list-h">
        <h2 id="list-h">Your plans</h2>
        {!plans || plans.length === 0 ? (
          <p className="sub">No plans yet. Create your first one above.</p>
        ) : (
          plans.map((p) => {
            const past = isPastPlan(p.end_date, today);
            return (
              <div key={p.id} className="plan">
                <div>
                  <div className="plan-name">
                    {p.name}
                    {p.is_active && <span className="pill">Active</span>}
                    {past && <span className="pill quiet">Past · read-only</span>}
                  </div>
                  <span className="lab">{formatRange(p.start_date, p.end_date)}</span>
                </div>
                <div className="plan-actions">
                  {!p.is_active && !past && (
                    <form action={activatePlan}><input type="hidden" name="id" value={p.id} /><button type="submit" className="btn sm">Activate</button></form>
                  )}
                  {!past && <Link href={`/plans/${p.id}`} className="btn sm ghost">Edit</Link>}
                  <form action={duplicatePlan}><input type="hidden" name="id" value={p.id} /><button type="submit" className="btn sm ghost">Duplicate</button></form>
                  {!p.is_active && (
                    <form action={deletePlan}><input type="hidden" name="id" value={p.id} /><button type="submit" className="btn sm danger" aria-label={`Delete ${p.name}`}>Delete</button></form>
                  )}
                </div>
              </div>
            );
          })
        )}
      </section>
    </main>
  );
}
