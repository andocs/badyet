import { SetupWizard } from "@/components/v13/setup-wizard";
import type { YearMonth } from "@/lib/domain/dates";
import { todayManila } from "@/lib/plans/validate";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Setup · Bad(yet)" };

export default async function Setup() {
  const supabase = await createClient();
  const thisMonth = todayManila().slice(0, 7) as YearMonth;
  // A user who already has a salary is re-running the wizard: it adds to what they have.
  let rerun = false;
  if (supabase) {
    const start = await supabase.from("salary_events").select("id", { count: "exact", head: true }).eq("kind", "start");
    rerun = (start.count ?? 0) > 0;
  }
  return <SetupWizard thisMonth={thisMonth} rerun={rerun} />;
}
