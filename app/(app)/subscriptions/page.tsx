import { WalletSelect } from "@/components/wallet-select";
import { formatPesos, money, sum, type Money } from "@/lib/domain/money";
import { createClient } from "@/lib/supabase/server";
import { syncBudget } from "../installments/actions";
import { addSubscription, deleteSubscription, toggleSubscription } from "./actions";

const ERRORS: Record<string, string> = {
  invalid: "Check the form: a name, an amount above zero, and a cutoff.",
  failed: "That did not save. Try again.",
  noplan: "No plan is active, so there is no budget to sync into. Activate a plan first.",
  past: "The active plan has ended, so its budget is read-only.",
};
const peso = (m: Money) => formatPesos(m, { symbol: false });

export default async function SubscriptionsPage({ searchParams }: PageProps<"/subscriptions">) {
  const params = await searchParams;
  const error = typeof params.error === "string" ? ERRORS[params.error] : undefined;
  const detail = process.env.NODE_ENV !== "production" && typeof params.detail === "string" ? params.detail : undefined;
  const supabase = await createClient();
  const { data: rows } = supabase ? await supabase.from("subscriptions").select("*").order("created_at") : { data: null };
  const { data: walletRows } = supabase ? await supabase.from("wallets").select("id,name").order("created_at") : { data: null };
  const wallets = walletRows ?? [];
  const subs = rows ?? [];
  const monthly = (cutoff: string) => sum(subs.filter((s) => s.active && s.cutoff === cutoff).map((s) => money(s.amount)));
  const walletName = (id: string | null) => wallets.find((w) => w.id === id)?.name;

  return (
    <main className="main">
      <div className="head">
        <div>
          <h1>Subscriptions</h1>
          <p className="sub">Monthly charges. Active ones: 1st cutoff ₱{peso(monthly("first"))}, 2nd cutoff ₱{peso(monthly("second"))}.</p>
        </div>
        <form action={syncBudget}>
          <input type="hidden" name="page" value="subscriptions" />
          <button type="submit" className="btn">Sync to budget</button>
        </form>
      </div>
      {error && (
        <p className="notice err" role="alert" style={{ marginBottom: 18 }}>
          {error}
          {detail && <small style={{ display: "block", marginTop: 4, fontWeight: 500 }}>Technical detail: {detail}</small>}
        </p>
      )}
      {params.synced === "1" && (
        <p className="notice ok" role="status" style={{ marginBottom: 18 }}>
          Budget updated: the &quot;Installments&quot; and &quot;Subscriptions&quot; lines under Essentials now match what is due this month.
        </p>
      )}

      <div className="split">
        <section className="card" aria-labelledby="list-h">
          <h2 id="list-h">Your subscriptions</h2>
          {subs.length === 0 && <p className="sub">None yet. Add one on the right.</p>}
          {subs.map((s) => (
            <div key={s.id} className="plan">
              <div>
                <div className="plan-name">
                  {s.name}
                  <span className="pill quiet">{s.cutoff === "first" ? "1st cutoff" : "2nd cutoff"}</span>
                  {walletName(s.wallet_id) && <span className="pill quiet">{walletName(s.wallet_id)}</span>}
                  {!s.active && <span className="pill quiet">Paused</span>}
                </div>
                <span className="lab"><span className="num">₱{peso(money(s.amount))}</span> a month</span>
              </div>
              <div className="plan-actions">
                <form action={toggleSubscription}>
                  <input type="hidden" name="id" value={s.id} />
                  <input type="hidden" name="active" value={s.active ? "1" : "0"} />
                  <button type="submit" className="btn sm ghost">{s.active ? "Pause" : "Resume"}</button>
                </form>
                <form action={deleteSubscription}>
                  <input type="hidden" name="id" value={s.id} />
                  <button type="submit" className="btn sm danger" aria-label={`Delete ${s.name}`}>Delete</button>
                </form>
              </div>
            </div>
          ))}
        </section>

        <section className="card" aria-labelledby="add-h">
          <h2 id="add-h">Add a subscription</h2>
          <form action={addSubscription} className="form">
            <label className="field"><span className="lab">Name</span><input className="input" name="name" maxLength={60} required placeholder="Streaming" /></label>
            <label className="field"><span className="lab">Amount per month</span><input className="input" name="amount" inputMode="decimal" required placeholder="549.00" /></label>
            <label className="field">
              <span className="lab">Paid in</span>
              <select className="input" name="cutoff" defaultValue="first" aria-label="Cutoff">
                <option value="first">1st cutoff</option>
                <option value="second">2nd cutoff</option>
              </select>
            </label>
            <label className="field"><span className="lab">Wallet</span><WalletSelect wallets={wallets} label="Wallet" /></label>
            <button type="submit" className="btn">Add subscription</button>
          </form>
        </section>
      </div>
    </main>
  );
}
