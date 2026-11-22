import { InstallmentsManager } from "@/components/v13/installments/manager";
import { loadInstallments } from "@/lib/installments/save";
import { todayManila } from "@/lib/plans/validate";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Installments · Bad(yet)" };

export default async function Installments() {
  const supabase = await createClient();
  if (!supabase) return <p className="v-main">Supabase is not configured.</p>;
  const [{ plans, missing }, accounts] = await Promise.all([
    loadInstallments(supabase),
    supabase.from("accounts").select("id, name").is("archived_at", null).order("sort").order("created_at"),
  ]);
  return (
    <main className="v-main">
      <div className="v-stack v-l">
        <div>
          <h1>Installments</h1>
          <div className="v-lbl">Card plans and loans. Each one sits in your budget as its own line until the last payment.</div>
        </div>
        <InstallmentsManager plans={plans} accounts={(accounts.data ?? []) as { id: string; name: string }[]} today={todayManila()} missing={missing} />
      </div>
    </main>
  );
}
