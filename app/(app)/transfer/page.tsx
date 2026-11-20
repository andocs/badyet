import Link from "next/link";
import { ConfirmButton } from "@/components/confirm-button";
import { PlanBar } from "@/components/plan-bar";
import { pickPlan, planQuery } from "@/lib/plans/select";
import { type Cutoff } from "@/lib/budget/validate";
import { currentPeriod, loadRule, resolveCutoff } from "@/lib/dashboard/helpers";
import { todayManila } from "@/lib/plans/validate";
import { formatPesos, money, sum, type Money } from "@/lib/domain/money";
import { isMonth, monthLabel, shiftMonth } from "@/lib/transfer/month";
import { groupByWallet, leftToSend, type TransferLine } from "@/lib/transfer/summary";
import { createClient } from "@/lib/supabase/server";
import { addDefaultWallets, addWallet, deleteWallet, toggleSent } from "./actions";

const ERRORS: Record<string, string> = {
  invalid: "Give the wallet a name (1 to 30 characters).",
  failed: "That did not save. Try again (a wallet with that name may already exist).",
};
const peso = (m: Money) => formatPesos(m, { symbol: false });

export default async function TransferPage({ searchParams }: PageProps<"/transfer">) {
  const params = await searchParams;
  const error = typeof params.error === "string" ? ERRORS[params.error] : undefined;
  const detail = process.env.NODE_ENV !== "production" && typeof params.detail === "string" ? params.detail : undefined;

  const supabase = await createClient();
  const rule = await loadRule(supabase);
  const month = isMonth(params.month) ? params.month : currentPeriod(todayManila(), rule).month;
  const cutoff: Cutoff = resolveCutoff(params.cutoff, todayManila(), rule);
  const plan = await pickPlan(supabase, params.plan);
  const { data: lineRows } =
    plan && supabase
      ? await supabase.from("budget_lines").select("id,name,amount,wallet_id").eq("plan_id", plan.id).eq("cutoff", cutoff).order("created_at")
      : { data: null };
  const { data: walletRows } = supabase ? await supabase.from("wallets").select("id,name").order("created_at") : { data: null };
  const { data: markRows } = supabase ? await supabase.from("transfer_marks").select("line_id").eq("month", month) : { data: null };

  const wallets = walletRows ?? [];
  const lines: TransferLine[] = (lineRows ?? []).map((r) => ({ id: r.id, name: r.name, amount: money(r.amount), walletId: r.wallet_id }));
  const sent = new Set((markRows ?? []).map((r) => r.line_id as string));
  const groups = groupByWallet(lines, wallets, sent);
  const total = sum(lines.map((l) => l.amount));
  const left = leftToSend(groups);
  const pct = total > 0 ? Math.round(((total - left) / total) * 100) : 0;
  const allDone = lines.length > 0 && left === 0;

  const hidden = (
    <>
      <input type="hidden" name="month" value={month} />
      <input type="hidden" name="cutoff" value={cutoff} />
      {plan && !plan.is_active && <input type="hidden" name="plan" value={plan.id} />}
    </>
  );

  return (
    <main className="main">
      <div className="head">
        <div>
          <span className="lab">{plan ? plan.name : "No active plan"}</span>
          <h1 style={{ marginTop: 6 }}>To transfer</h1>
          <p className="sub">Tick each transfer once you have sent it.</p>
        </div>
        <div className="head-tools">
          <nav className="segmented" aria-label="Month">
            <Link href={`/transfer?month=${shiftMonth(month, -1)}&cutoff=${cutoff}${planQuery(plan)}`} aria-label="Previous month">←</Link>
            <span className="seg-label">{monthLabel(month)}</span>
            <Link href={`/transfer?month=${shiftMonth(month, 1)}&cutoff=${cutoff}${planQuery(plan)}`} aria-label="Next month">→</Link>
          </nav>
          <nav className="segmented" aria-label="Cutoff">
            <Link href={`/transfer?month=${month}&cutoff=first${planQuery(plan)}`} aria-current={cutoff === "first" ? "page" : undefined}>1st cutoff</Link>
            <Link href={`/transfer?month=${month}&cutoff=second${planQuery(plan)}`} aria-current={cutoff === "second" ? "page" : undefined}>2nd cutoff</Link>
          </nav>
        </div>
      </div>
      {error && (
        <p className="notice err" role="alert" style={{ marginBottom: 18 }}>
          {error}
          {detail && <small style={{ display: "block", marginTop: 4, fontWeight: 500 }}>Technical detail: {detail}</small>}
        </p>
      )}

      {plan && <PlanBar basePath="/transfer" plan={plan} keep={`month=${month}&cutoff=${cutoff}`} />}
      {!plan ? (
        <section className="card">
          <p className="sub" style={{ margin: 0 }}>Transfers come from your budget, which belongs to a plan. No plan is active yet.</p>
          <p style={{ marginBottom: 0 }}><Link href="/plans" className="btn">Go to Plans</Link></p>
        </section>
      ) : lines.length === 0 ? (
        <section className="card">
          <p className="sub" style={{ margin: 0 }}>No budget lines for the {cutoff === "first" ? "1st" : "2nd"} cutoff yet.</p>
          <p style={{ marginBottom: 0 }}><Link href={`/budget?cutoff=${cutoff}`} className="btn">Go to Budget</Link></p>
        </section>
      ) : (
        <>
          <section className="card" aria-label="Progress" style={{ marginBottom: 18 }}>
            <div className={`budget-state ${allDone ? "ok" : ""}`} role="status">
              <span>{allDone ? "All sent for this cutoff. Go touch grass." : `${lines.filter((l) => !sent.has(l.id)).length} transfers to go`}</span>
              <span className="num">₱{peso(left)} left of ₱{peso(total)}</span>
            </div>
            <div className="bar" role="progressbar" aria-label="Sent so far" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} style={{ marginTop: 12 }}>
              <i style={{ width: `${pct}%` }} />
            </div>
          </section>

          <div className="split">
            <div className="stack">
              {groups.map((g) => (
                <section key={g.wallet?.id ?? "none"} className="card" aria-label={g.wallet?.name ?? "No wallet"}>
                  <div className="head" style={{ margin: "0 0 6px" }}>
                    <h2 style={{ margin: 0 }}>{g.wallet?.name ?? "No wallet yet"}</h2>
                    <span className="lab"><span className="num">₱{peso(g.total)}</span> · {g.sentCount} of {g.lines.length} sent</span>
                  </div>
                  {g.lines.map((l) => {
                    const done = sent.has(l.id);
                    return (
                      <form key={l.id} action={toggleSent} className={`trow${done ? " done" : ""}`}>
                        {hidden}
                        <input type="hidden" name="lineId" value={l.id} />
                        <input type="hidden" name="sent" value={done ? "1" : "0"} />
                        <button type="submit" className="check" aria-pressed={done} aria-label={`${l.name}, ${peso(l.amount)}. ${done ? "Sent. Tap to undo." : "Not sent. Tap to mark sent."}`} />
                        <span className="tname">{l.name}</span>
                        <span className="num">{peso(l.amount)}</span>
                      </form>
                    );
                  })}
                  {!g.wallet && <p className="sub" style={{ marginBottom: 0 }}>Pick a wallet for these on the <Link href={`/budget?cutoff=${cutoff}`}>Budget</Link> page.</p>}
                </section>
              ))}
            </div>

            <section className="card" aria-labelledby="w-h">
              <h2 id="w-h">Wallets</h2>
              {wallets.length === 0 ? (
                <>
                  <p className="sub" style={{ marginTop: 0 }}>Wallets are where you send money (Gcash, Maya, a bank). Add yours.</p>
                  <form action={addDefaultWallets}>{hidden}<button type="submit" className="btn">Add Gcash, Maya, BPI, Vybe</button></form>
                </>
              ) : (
                wallets.map((w) => (
                  <form key={w.id} action={deleteWallet} className="row">
                    {hidden}
                    <input type="hidden" name="id" value={w.id} />
                    <span>{w.name}</span>
                    <ConfirmButton message={`Delete wallet ${w.name}? Lines using it lose their wallet.`} className="btn sm danger" aria-label={`Delete wallet ${w.name}`}>Delete</ConfirmButton>
                  </form>
                ))
              )}
              <form action={addWallet} className="bline add" style={{ gridTemplateColumns: "minmax(0,1fr) auto", marginTop: 10 }}>
                {hidden}
                <input className="input" name="name" placeholder="New wallet" maxLength={30} aria-label="New wallet name" required />
                <button type="submit" className="btn sm">Add</button>
              </form>
              <p className="sub">Deleting a wallet keeps its budget lines; they just lose their wallet.</p>
            </section>
          </div>
        </>
      )}
    </main>
  );
}
