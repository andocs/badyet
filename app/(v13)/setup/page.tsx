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
  const existing = { accounts: [] as string[], lines: [] as string[], funds: [] as string[] };
  if (supabase) {
    const start = await supabase.from("salary_events").select("id", { count: "exact", head: true }).eq("kind", "start");
    rerun = (start.count ?? 0) > 0;
    const [a, l, f] = await Promise.all([
      supabase.from("accounts").select("name").is("archived_at", null),
      supabase.from("budget_lines_v2").select("name").is("ends_on", null),
      supabase.from("funds").select("name").is("archived_at", null),
    ]);
    const names = (r: { data: { name: string }[] | null }) => (r.data ?? []).map((x) => x.name);
    existing.accounts = names(a);
    existing.lines = names(l);
    existing.funds = names(f);
  }
  return <SetupWizard thisMonth={thisMonth} rerun={rerun} existing={existing} />;
}
