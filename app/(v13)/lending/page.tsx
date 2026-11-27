import { LendingManager } from "@/components/v13/lending/manager";
import { loadLendingContext } from "@/lib/lending/context";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Lending · Bad(yet)" };

export default async function Lending() {
  const supabase = await createClient();
  if (!supabase) return <p className="v-main">Supabase is not configured.</p>;
  const d = await loadLendingContext(supabase);
  return (
    <main className="v-main">
      <div className="v-stack v-l">
        <div>
          <h1>Lending</h1>
          <div className="v-lbl">Who owes you, when it is due, and where it came from.</div>
        </div>
        <LendingManager loans={d.loans} lend={d.lend} payback={d.payback} outgoing={d.outgoing} ready={d.ready} />
      </div>
    </main>
  );
}
