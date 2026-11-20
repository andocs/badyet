import { SubNav } from "@/components/subnav";
import { HideAmounts } from "@/components/hide-amounts";
import { cutoffLabel, loadRule } from "@/lib/dashboard/helpers";
import { EXPORTS } from "@/lib/export/csv";
import { createClient } from "@/lib/supabase/server";
import { saveSettings } from "./actions";

const ERRORS: Record<string, string> = {
  invalid: "Enter two days: the 1st cutoff starts on a day from 2 to 27 and the 2nd on a later day, up to 28.",
  failed: "That did not save. Try again.",
};

export default async function SettingsPage({ searchParams }: PageProps<"/settings">) {
  const params = await searchParams;
  const error = typeof params.error === "string" ? ERRORS[params.error] : undefined;
  const detail = process.env.NODE_ENV !== "production" && typeof params.detail === "string" ? params.detail : undefined;
  const supabase = await createClient();
  const rule = await loadRule(supabase);
  const month = new Date().toISOString().slice(0, 7);

  return (
    <main className="main">
      <SubNav group="setup" />
      <div className="head">
        <div>
          <h1>Settings</h1>
          <p className="sub">How the app splits time into your two paydays.</p>
        </div>
      </div>
      {error && (
        <p className="notice err" role="alert" style={{ marginBottom: 18 }}>
          {error}
          {detail && <small style={{ display: "block", marginTop: 4, fontWeight: 500 }}>Technical detail: {detail}</small>}
        </p>
      )}
      {params.saved === "1" && <p className="notice ok" role="status" style={{ marginBottom: 18 }}>Saved.</p>}
      <section className="card" aria-labelledby="c-h" style={{ maxWidth: 520 }}>
        <h2 id="c-h">Cutoffs</h2>
        <form action={saveSettings} className="form">
          <div className="form-grid">
            <label className="field">
              <span className="lab">1st cutoff starts on day</span>
              <input className="input" name="firstStart" inputMode="numeric" required defaultValue={rule.firstStartDay} aria-describedby="c-hint" />
            </label>
            <label className="field">
              <span className="lab">2nd cutoff starts on day</span>
              <input className="input" name="secondStart" inputMode="numeric" required defaultValue={rule.secondStartDay} aria-describedby="c-hint" />
            </label>
          </div>
          <p id="c-hint" className="sub" style={{ margin: 0 }}>
            Cutoffs run payday to payday. With {rule.firstStartDay} and {rule.secondStartDay}: {cutoffLabel(month, "first", rule)}, then {cutoffLabel(month, "second", rule)}.
            The 2nd cutoff ends the day before the 1st starts in the next month, and belongs to the month it starts in.
          </p>
          <button type="submit" className="btn">Save</button>
        </form>
      </section>
      <section className="card" aria-labelledby="p-h" style={{ maxWidth: 520, marginTop: 18 }}>
        <h2 id="p-h">Privacy</h2>
        <p className="sub" style={{ marginTop: 0 }}>Blur every amount while people can see your screen. Remembered on this device.</p>
        <HideAmounts className="btn" />
      </section>
      <section className="card" aria-labelledby="x-h" style={{ maxWidth: 520, marginTop: 18 }}>
        <h2 id="x-h">Export your data</h2>
        <p className="sub" style={{ marginTop: 0 }}>One CSV file per table, with only your own rows.</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {EXPORTS.map((n) => (
            <a key={n} className="btn sm" href={`/export/${n}`} download>
              {n.replace(/_/g, " ")}
            </a>
          ))}
        </div>
      </section>
    </main>
  );
}
