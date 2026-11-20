import { AccountWizard } from "@/components/account-wizard";
import { ConfirmButton } from "@/components/confirm-button";
import { SubNav } from "@/components/subnav";
import { KIND_LABEL, isKind, type Kind } from "@/lib/accounts/input";
import { daysUntilDay, position } from "@/lib/accounts/summary";
import { formatPesos, money, type Money } from "@/lib/domain/money";
import { todayManila } from "@/lib/plans/validate";
import { createClient } from "@/lib/supabase/server";
import { addAccount, deleteAccount, updateBalance } from "./actions";

const ERRORS: Record<string, string> = {
  invalid: "Check the form. The name is needed, the last 4 digits must be exactly 4 (never the full number), and amounts look like 1,234.50.",
  failed: "That did not save. Try again (an account with that name may already exist).",
};
const peso = (m: Money) => formatPesos(m, { symbol: false });

export default async function AccountsPage({ searchParams }: PageProps<"/accounts">) {
  const params = await searchParams;
  const error = typeof params.error === "string" ? ERRORS[params.error] : undefined;
  const detail = process.env.NODE_ENV !== "production" && typeof params.detail === "string" ? params.detail : undefined;
  const supabase = await createClient();
  const { data } = supabase
    ? await supabase.from("wallets").select("id,name,kind,institution,last4,balance,balance_as_of,credit_limit,statement_day,due_day").order("created_at")
    : { data: null };
  const rows = (data ?? []).map((r) => ({
    id: r.id as string,
    name: r.name as string,
    kind: (isKind(r.kind) ? r.kind : "ewallet") as Kind,
    institution: r.institution as string | null,
    last4: r.last4 as string | null,
    balance: money(r.balance),
    asOf: r.balance_as_of as string | null,
    limit: r.credit_limit === null ? null : money(r.credit_limit),
    statementDay: r.statement_day as number | null,
    dueDay: r.due_day as number | null,
  }));
  const pos = position(rows.map((r) => ({ kind: r.kind, balance: r.balance, creditLimit: r.limit })));
  const today = todayManila();

  return (
    <main className="main">
      <SubNav group="setup" />
      <div className="head">
        <div>
          <h1>Accounts</h1>
          <p className="sub">Where your money sits and what you owe. Nothing connects to your bank. Ticking a transfer as sent adds it to the account it went to (a card goes down by what you paid), and un-ticking undoes it. Correct a balance by hand any time.</p>
        </div>
      </div>
      {error && (
        <p className="notice err" role="alert" style={{ marginBottom: 18 }}>
          {error}
          {detail && <small style={{ display: "block", marginTop: 4, fontWeight: 500 }}>Technical detail: {detail}</small>}
        </p>
      )}
      {params.saved === "1" && <p className="notice ok" role="status" style={{ marginBottom: 18 }}>Saved.</p>}

      {rows.length > 0 && (
        <section className="card" aria-label="Your position" style={{ marginBottom: 18, display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
          <div><span className="lab">In your accounts</span><div className="num" style={{ fontSize: 22, fontWeight: 800 }}>₱{peso(pos.cash)}</div></div>
          <div><span className="lab">Owed on cards</span><div className="num" style={{ fontSize: 22, fontWeight: 800, color: pos.debt > 0 ? "var(--err)" : undefined }}>₱{peso(pos.debt)}</div></div>
          <div><span className="lab">Cash minus debt</span><div className="num" style={{ fontSize: 22, fontWeight: 800 }}>{pos.net < 0 ? "-" : ""}₱{peso(money(Math.abs(pos.net)))}</div></div>
          {pos.utilizationPct !== null && <div><span className="lab">Card limit used</span><div className="num" style={{ fontSize: 22, fontWeight: 800 }}>{pos.utilizationPct}%</div></div>}
        </section>
      )}

      <div className="split">
        <section className="card" aria-labelledby="list-h">
          <h2 id="list-h">Your accounts</h2>
          {rows.length === 0 && <p className="sub">None yet. Add your first one on the right.</p>}
          {rows.map((r) => {
            const used = r.limit !== null && r.limit > 0 ? Math.round((r.balance / r.limit) * 100) : null;
            return (
              <div key={r.id} className="plan" style={{ display: "grid", gap: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                  <div>
                    <div className="plan-name">
                      {r.name}
                      <span className="pill quiet">{KIND_LABEL[r.kind]}</span>
                    </div>
                    <span className="lab">
                      {[r.institution, r.last4 ? `•••• ${r.last4}` : null].filter(Boolean).join(" · ") || "No details added"}
                      {r.dueDay !== null && ` · due in ${daysUntilDay(today, r.dueDay)} days (day ${r.dueDay})`}
                    </span>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div className="num" style={{ fontWeight: 800, fontSize: 18, color: r.kind === "credit" && r.balance > 0 ? "var(--err)" : undefined }}>
                      {r.kind === "credit" ? "owes " : ""}<span className="amt">₱{peso(r.balance)}</span>
                    </div>
                    {r.kind === "credit" && r.limit !== null && <span className="lab">of <span className="amt">₱{peso(r.limit)}</span>{used !== null ? ` · ${used}% used` : ""}</span>}
                    {r.asOf && <span className="lab" style={{ display: "block" }}>as of {r.asOf}</span>}
                  </div>
                </div>
                <details>
                  <summary style={{ cursor: "pointer", minHeight: 36 }}>Update balance</summary>
                  <form action={updateBalance} className="form" style={{ marginTop: 8 }}>
                    <input type="hidden" name="id" value={r.id} />
                    <label className="field"><span className="lab">{r.kind === "credit" ? "Amount owed" : "Balance"} (₱)</span><input className="input" name="balance" inputMode="decimal" defaultValue={peso(r.balance)} /></label>
                    {r.kind === "credit" && (
                      <div className="form-grid">
                        <label className="field"><span className="lab">Credit limit</span><input className="input" name="creditLimit" inputMode="decimal" defaultValue={r.limit === null ? "" : peso(r.limit)} /></label>
                        <label className="field"><span className="lab">Statement day</span><input className="input" name="statementDay" inputMode="numeric" defaultValue={r.statementDay ?? ""} /></label>
                        <label className="field"><span className="lab">Due day</span><input className="input" name="dueDay" inputMode="numeric" defaultValue={r.dueDay ?? ""} /></label>
                      </div>
                    )}
                    <div style={{ display: "flex", gap: 8 }}>
                      <button type="submit" className="btn sm">Save</button>
                    </div>
                  </form>
                </details>
                <form action={deleteAccount}>
                  <input type="hidden" name="id" value={r.id} />
                  <ConfirmButton message={`Delete ${r.name}? Budget lines sent to it keep their amounts but lose this account. This cannot be undone.`} className="btn sm danger" aria-label={`Delete ${r.name}`}>Delete</ConfirmButton>
                </form>
              </div>
            );
          })}
        </section>

        <section className="card" aria-labelledby="add-h">
          <h2 id="add-h">Add an account</h2>
          <AccountWizard action={addAccount} />
        </section>
      </div>
    </main>
  );
}
