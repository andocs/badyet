import Link from "next/link";
import { formatPesos, type Money } from "@/lib/domain/money";
import { diffMetrics, loadPlanMetrics, type PlanMetrics } from "@/lib/plans/metrics";
import { isUuid } from "@/lib/plans/validate";
import { createClient } from "@/lib/supabase/server";

const peso = (m: Money) => formatPesos(m, { symbol: false });
const signed = (m: Money | null) => (m === null ? "n/a" : `${m > 0 ? "+" : m < 0 ? "-" : ""}₱${peso((Math.abs(m) as Money))}`);
const ROWS: { key: keyof PlanMetrics; label: string }[] = [
  { key: "netFirst", label: "Net pay, 1st cutoff" },
  { key: "netSecond", label: "Net pay, 2nd cutoff" },
  { key: "leftToBudget", label: "Left to budget (both cutoffs)" },
  { key: "savingsPerMonth", label: "Savings per month" },
  { key: "savingsAfter12", label: "Savings after 12 months" },
];

export default async function ComparePage({ searchParams }: PageProps<"/plans/compare">) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data } = supabase
    ? await supabase.from("plans").select("id,name,is_active").order("start_date", { ascending: false })
    : { data: null };
  const plans = data ?? [];
  const byId = (v: unknown) => (typeof v === "string" && isUuid(v) ? plans.find((p) => p.id === v) : undefined);
  const a = byId(params.a) ?? plans.find((p) => p.is_active) ?? plans[0];
  const b = byId(params.b) ?? plans.find((p) => p.id !== a?.id);
  const [ma, mb] = supabase && a && b ? await Promise.all([loadPlanMetrics(supabase, a.id), loadPlanMetrics(supabase, b.id)]) : [null, null];
  const d = ma && mb ? diffMetrics(ma, mb) : null;
  const pick = (name: "a" | "b", current: string | undefined) => (
    <select className="input" name={name} defaultValue={current} aria-label={name === "a" ? "First plan" : "Second plan"}>
      {plans.map((p) => (
        <option key={p.id} value={p.id}>{p.name}{p.is_active ? " (active)" : ""}</option>
      ))}
    </select>
  );

  return (
    <main className="main">
      <div className="head">
        <div>
          <h1>Compare plans</h1>
          <p className="sub">Nothing here changes your active plan. The difference is the second plan minus the first.</p>
        </div>
        <Link href="/plans" className="btn">Back to Plans</Link>
      </div>
      {plans.length < 2 ? (
        <section className="card">
          <p className="sub" style={{ margin: 0 }}>You need two plans to compare. Duplicate your plan on the Plans page, change the pay, then come back.</p>
        </section>
      ) : (
        <>
          <form method="get" className="card" style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "end", marginBottom: 18 }}>
            <label className="field" style={{ flex: "1 1 200px" }}><span className="lab">First plan</span>{pick("a", a?.id)}</label>
            <label className="field" style={{ flex: "1 1 200px" }}><span className="lab">Second plan</span>{pick("b", b?.id)}</label>
            <button type="submit" className="btn">Compare</button>
          </form>
          {!ma || !mb || !d ? (
            <p className="notice warn" role="status">One of these plans has no pay set up yet, so there is nothing to compare. Open it on Plans and fill in Pay first.</p>
          ) : (
            <section className="card" aria-label="Comparison" style={{ overflowX: "auto" }}>
              <table className="paytable" style={{ width: "100%" }}>
                <thead>
                  <tr>
                    <th scope="col" style={{ textAlign: "left" }}>&nbsp;</th>
                    <th scope="col" style={{ textAlign: "right" }}>{a?.name}</th>
                    <th scope="col" style={{ textAlign: "right" }}>Difference</th>
                    <th scope="col" style={{ textAlign: "right" }}>{b?.name}</th>
                  </tr>
                </thead>
                <tbody>
                  {ROWS.map(({ key, label }) => (
                    <tr key={key}>
                      <th scope="row" style={{ textAlign: "left", fontWeight: 600 }}>{label}</th>
                      <td className="num">{ma[key] === null ? "n/a" : `₱${peso(ma[key] as Money)}`}</td>
                      <td className="num" style={{ fontWeight: 800, color: d[key] === null || d[key] === 0 ? "var(--muted)" : (d[key] as number) > 0 ? "var(--accent-text)" : "var(--err)" }}>
                        {signed(d[key])}
                      </td>
                      <td className="num">{mb[key] === null ? "n/a" : `₱${peso(mb[key] as Money)}`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="sub" style={{ marginBottom: 0 }}>
                Savings after 12 months adds up your Emergency, Travel and Wants funds at the end of each plan&apos;s forecast. &quot;n/a&quot; means that plan has no savings forecast set up.
              </p>
            </section>
          )}
        </>
      )}
    </main>
  );
}
