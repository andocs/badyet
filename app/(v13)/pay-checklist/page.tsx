import { PayChecklistView } from "@/components/v13/pay-checklist";
import { loadChecklist } from "@/lib/bills/load";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Pay checklist · Bad(yet)" };

export default async function PayChecklist({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const supabase = await createClient();
  if (!supabase) return <p className="v-main">Supabase is not configured.</p>;
  const sp = await searchParams;
  const data = await loadChecklist(supabase, sp.c === "1" ? "first" : sp.c === "2" ? "second" : undefined);
  return (
    <main className="v-main">
      {data.kind === "setup" ? (
        <div className="v-note"><b>No salary on file yet.</b> The checklist needs your budget. Add your salary under Salary and tax first.</div>
      ) : (
        <PayChecklistView data={data} />
      )}
    </main>
  );
}
