import Link from "next/link";
import { notFound } from "next/navigation";
import { isPastPlan, isUuid } from "@/lib/plans/validate";
import { createClient } from "@/lib/supabase/server";
import { updatePlan } from "../actions";

export default async function EditPlanPage({ params, searchParams }: PageProps<"/plans/[id]">) {
  const { id } = await params;
  const query = await searchParams;
  if (!isUuid(id)) notFound();
  const supabase = await createClient();
  const { data: plan } = supabase ? await supabase.from("plans").select("id,name,start_date,end_date").eq("id", id).single() : { data: null };
  if (!plan) notFound();
  const past = isPastPlan(plan.end_date);

  return (
    <main className="main">
      <div className="head">
        <div>
          <h1>Edit plan</h1>
          <p className="sub">{past ? "This plan has ended, so it is read-only." : "Change the name or the date range."}</p>
        </div>
        <Link href="/plans" className="btn ghost">Back to plans</Link>
      </div>
      {query.error === "invalid" && (
        <p className="notice err" role="alert" style={{ marginBottom: 18 }}>
          Check the plan: it needs a name and a valid start date. If you set an end date, it cannot be before the start date.
        </p>
      )}
      <section className="card">
        <form action={updatePlan} className="form" style={{ maxWidth: 520 }}>
          <input type="hidden" name="id" value={plan.id} />
          <label className="field"><span className="lab">Name</span><input className="input" name="name" maxLength={60} required defaultValue={plan.name} disabled={past} /></label>
          <label className="field"><span className="lab">Starts</span><input className="input" type="date" name="startDate" required defaultValue={plan.start_date} disabled={past} /></label>
          <label className="field"><span className="lab">Ends (blank = ongoing)</span><input className="input" type="date" name="endDate" defaultValue={plan.end_date ?? ""} disabled={past} /></label>
          {!past && <button type="submit" className="btn">Save changes</button>}
        </form>
      </section>
    </main>
  );
}
