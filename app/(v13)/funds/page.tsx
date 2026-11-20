import { FundsManager, type FundCard } from "@/components/v13/funds/manager";
import { loadFunds } from "@/lib/funds/load";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Funds · Bad(yet)" };

const PALETTE = ["#34D399", "#7FA8FF", "#F6C453", "#C4A0FF", "#5CD0E6", "#F28BC8"];

export default async function Funds() {
  const supabase = await createClient();
  if (!supabase) return <p className="v-main">Supabase is not configured.</p>;
  const d = await loadFunds(supabase);
  const cards: FundCard[] = d.funds.map((f, i) => ({
    id: f.id,
    name: f.name,
    color: d.colors.get(f.id) ?? PALETTE[i % PALETTE.length]!,
    rule: f.rule,
    target: f.target ?? null,
    tranches: f.tranches ?? null,
    maxPerMonth: f.maxPerMonth ?? null,
    fixedAmount: f.fixedAmount ?? null,
    resetMonth: f.resetMonth ?? null,
    linkedAccountId: f.linkedAccountId ?? null,
    shareBp: f.shareBp ?? null,
    balance: d.fundStart[f.id] ?? 0,
  }));
  return (
    <main className="v-main">
      <div className="v-stack v-l">
        <div>
          <h1>Savings funds</h1>
          <div className="v-lbl">Where the savings pool goes each month, first come first served.</div>
        </div>
        <FundsManager funds={cards} accounts={d.budget.accounts} />
      </div>
    </main>
  );
}
