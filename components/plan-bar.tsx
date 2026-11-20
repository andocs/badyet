import Link from "next/link";
import { activatePlan } from "@/app/(app)/plans/actions";
import type { PickedPlan } from "@/lib/plans/select";
import { isPastPlan } from "@/lib/plans/validate";
import { createClient } from "@/lib/supabase/server";

// "Plan: X" with a list of your other plans. Looking at a plan never changes which one is active.
export async function PlanBar({ basePath, plan, keep = "" }: { basePath: string; plan: PickedPlan; keep?: string }) {
  const supabase = await createClient();
  const { data } = supabase ? await supabase.from("plans").select("id,name,is_active,end_date").order("start_date", { ascending: false }) : { data: null };
  const plans = data ?? [];
  const href = (p: { id: string; is_active: boolean }) => {
    const qs = [p.is_active ? "" : `plan=${p.id}`, keep].filter(Boolean).join("&");
    return qs ? `${basePath}?${qs}` : basePath;
  };
  const compareWith = plans.find((p) => p.id !== plan.id);
  return (
    <div style={{ display: "grid", gap: 10, marginBottom: 18 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <details className="planpick">
          <summary className="pill" style={{ cursor: "pointer", minHeight: 36 }}>
            Plan: {plan.name} ▾
          </summary>
          <ul style={{ listStyle: "none", margin: "6px 0 0", padding: 6, border: "1px solid var(--line)", borderRadius: 10, background: "var(--surface)", display: "grid", gap: 2 }}>
            {plans.map((p) => (
              <li key={p.id}>
                <Link href={href(p)} aria-current={p.id === plan.id ? "page" : undefined} style={{ display: "flex", justifyContent: "space-between", gap: 14, padding: "10px 12px", borderRadius: 8, minHeight: 44, alignItems: "center" }}>
                  <span>{p.name}</span>
                  <span className="lab">{p.is_active ? "Active" : isPastPlan(p.end_date) ? "Past" : "Draft"}</span>
                </Link>
              </li>
            ))}
          </ul>
        </details>
        {compareWith && (
          <Link href={`/plans/compare?a=${plan.id}&b=${compareWith.id}`} className="btn sm">
            Compare plans
          </Link>
        )}
      </div>
      {!plan.is_active && (
        <p className="notice warn" role="status" style={{ margin: 0, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <span>
            Viewing <b>{plan.name}</b>, which is not your active plan. Nothing here changes the active plan.
          </span>
          {!isPastPlan(plan.end_date) && (
            <form action={activatePlan}>
              <input type="hidden" name="id" value={plan.id} />
              <button type="submit" className="btn sm">Make active</button>
            </form>
          )}
        </p>
      )}
    </div>
  );
}
