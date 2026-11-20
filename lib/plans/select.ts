import type { createClient } from "@/lib/supabase/server";
import { isUuid } from "./validate";

type Db = NonNullable<Awaited<ReturnType<typeof createClient>>>;
export interface PickedPlan {
  id: string;
  name: string;
  start_date: string;
  end_date: string | null;
  is_active: boolean;
}

// The plan a page shows: the one named in ?plan= when it is yours, otherwise the active plan.
// RLS limits the lookup to your own plans, so a made-up id simply falls back to the active one.
export async function pickPlan(supabase: Db | null, param: unknown): Promise<PickedPlan | null> {
  if (!supabase) return null;
  const cols = "id,name,start_date,end_date,is_active";
  if (typeof param === "string" && isUuid(param)) {
    const { data } = await supabase.from("plans").select(cols).eq("id", param).maybeSingle();
    if (data) return data as PickedPlan;
  }
  const { data } = await supabase.from("plans").select(cols).eq("is_active", true).maybeSingle();
  return (data as PickedPlan | null) ?? null;
}

// "&plan=<id>" only when a different plan than the active one is being viewed, so links keep the view.
export function planQuery(plan: PickedPlan | null): string {
  return plan && !plan.is_active ? `&plan=${plan.id}` : "";
}
