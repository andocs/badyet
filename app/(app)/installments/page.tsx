import { SubNav } from "@/components/subnav";
import { ConfirmButton } from "@/components/confirm-button";
import { WalletSelect } from "@/components/wallet-select";
import { dueByCutoff, summarize, type InstalmentRow } from "@/lib/installments/calc";
import { formatPesos, money, type Money } from "@/lib/domain/money";
import { createClient } from "@/lib/supabase/server";
import { currentMonth, monthLabel } from "@/lib/transfer/month";
import { addInstalment, deleteInstalment, setNextPayment } from "./actions";

const ERRORS: Record<string, string> = {
  invalid: "Check the form: price, number of payments and the first payment date are needed; down payment must be less than the price.",
  failed: "That did not save. Try again.",
  noplan: "No plan is active, so there is no budget to sync into. Activate a plan first.",
  past: "The active plan has ended, so its budget is read-only.",
};
const peso = (m: Money) => formatPesos(m, { symbol: false });

export default async function InstallmentsPage({ searchParams }: PageProps<"/installments">) {
  const params = await searchParams;
  const error = typeof params.error === "string" ? ERRORS[params.error] : undefined;
  const detail = process.env.NODE_ENV !== "production" && typeof params.detail === "string" ? params.detail : undefined;
  const supabase = await createClient();
  const { data: rows } = supabase ? await supabase.from("installments").select("*").order("created_at") : { data: null };
  const { data: walletRows } = supabase ? await supabase.from("wallets").select("id,name").order("created_at") : { data: null };
  const { data: payRows } = supabase ? await supabase.from("installment_payments").select("installment_id,seq") : { data: null };
  const paidBy = new Map<string, Set<number>>();
  for (const p of payRows ?? []) paidBy.set(p.installment_id, (paidBy.get(p.installment_id) ?? new Set<number>()).add(p.seq));
  const wallets = walletRows ?? [];
  const items: InstalmentRow[] = (rows ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    price: money(r.price),
    downPayment: money(r.down_payment),
    termCount: r.term_count,
    rateBp: r.rate_bp,
    firstDueOn: r.first_due_on,
    cutoff: r.cutoff,
    walletId: r.wallet_id,
  }));
  const month = currentMonth();
  const due = dueByCutoff(items, month);
  const walletName = (id: string | null) => wallets.find((w) => w.id === id)?.name;

  return (
    <main className="main">
      <SubNav group="month" />
      <div className="head">
        <div>
          <h1>Installments</h1>
          <p className="sub">Things you are paying off. Due this month ({monthLabel(month)}): 1st cutoff ₱{peso(due.first)}, 2nd cutoff ₱{peso(due.second)}.</p>
        </div>
        <p className="lab" style={{ maxWidth: 260 }}>Your budget keeps itself in step with this list.</p>
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
          <h2 id="list-h">Your installments</h2>
          {items.length === 0 && <p className="sub">None yet. Add one on the right.</p>}
          {items.map((r) => {
            const s = summarize(r, paidBy.get(r.id));
            return (
              <div key={r.id} className="plan">
                <div>
                  <div className="plan-name">
                    {r.name}
                    <span className="pill quiet">{r.cutoff === "first" ? "1st cutoff" : "2nd cutoff"}</span>
                    {walletName(r.walletId) && <span className="pill quiet">{walletName(r.walletId)}</span>}
                  </div>
                  <span className="lab">
                    ₱{peso(s.perPayment)} × {r.termCount} · {s.paidCount} paid · {s.remaining} left · ends {monthLabel(s.lastDueOn.slice(0, 7))}
                    {s.interest > 0 && <> · interest ₱{peso(s.interest)}</>}
                  </span>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  {s.remaining > 0 && (
                    <form action={setNextPayment}>
                      <input type="hidden" name="id" value={r.id} />
                      <button type="submit" className="btn sm" aria-label={`Mark next payment of ${r.name} paid`}>Mark paid</button>
                    </form>
                  )}
                  {s.paidCount > 0 && (
                    <form action={setNextPayment}>
                      <input type="hidden" name="id" value={r.id} />
                      <input type="hidden" name="undo" value="1" />
                      <button type="submit" className="btn sm" aria-label={`Undo last paid payment of ${r.name}`}>Undo</button>
                    </form>
                  )}
                  <form action={deleteInstalment}>
                    <input type="hidden" name="id" value={r.id} />
                    <ConfirmButton message={`Delete ${r.name} and its paid marks? This cannot be undone.`} className="btn sm danger" aria-label={`Delete ${r.name}`}>Delete</ConfirmButton>
                  </form>
                </div>
              </div>
            );
          })}
        </section>

        <section className="card" aria-labelledby="add-h">
          <h2 id="add-h">Add an installment</h2>
          <form action={addInstalment} className="form">
            <label className="field"><span className="lab">Name</span><input className="input" name="name" maxLength={60} required placeholder="Phone" /></label>
            <div className="form-grid">
              <label className="field"><span className="lab">Price</span><input className="input" name="price" inputMode="decimal" required placeholder="20,000.00" /></label>
              <label className="field"><span className="lab">Down payment (optional)</span><input className="input" name="downPayment" inputMode="decimal" placeholder="0.00" /></label>
              <label className="field"><span className="lab">Number of payments</span><input className="input" name="termCount" inputMode="numeric" required placeholder="12" /></label>
              <label className="field"><span className="lab">Interest per year, % (blank = none)</span><input className="input" name="apr" inputMode="decimal" placeholder="0" /></label>
              <label className="field"><span className="lab">First payment date</span><input className="input" type="date" name="firstDueOn" required /></label>
              <label className="field">
                <span className="lab">Paid in</span>
                <select className="input" name="cutoff" defaultValue="first" aria-label="Cutoff">
                  <option value="first">1st cutoff</option>
                  <option value="second">2nd cutoff</option>
                </select>
              </label>
              <label className="field"><span className="lab">Payments already made (optional)</span><input className="input" name="paidCount" inputMode="numeric" placeholder="0" /></label>
            </div>
            <label className="field"><span className="lab">Wallet</span><WalletSelect wallets={wallets} label="Wallet" /></label>
            <button type="submit" className="btn">Add installment</button>
          </form>
        </section>
      </div>
    </main>
  );
}
