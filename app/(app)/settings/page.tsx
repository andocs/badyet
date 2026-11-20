import { DEFAULT_SECOND_START } from "@/lib/dashboard/helpers";
import { createClient } from "@/lib/supabase/server";
import { saveSettings } from "./actions";

const ERRORS: Record<string, string> = {
  invalid: "Enter a day from 2 to 28.",
  failed: "That did not save. Try again.",
};

export default async function SettingsPage({ searchParams }: PageProps<"/settings">) {
  const params = await searchParams;
  const error = typeof params.error === "string" ? ERRORS[params.error] : undefined;
  const detail = process.env.NODE_ENV !== "production" && typeof params.detail === "string" ? params.detail : undefined;
  const supabase = await createClient();
  const { data } = supabase ? await supabase.from("user_settings").select("second_cutoff_start_day").maybeSingle() : { data: null };
  const start: number = data?.second_cutoff_start_day ?? DEFAULT_SECOND_START;

  return (
    <main className="main">
      <div className="head">
        <div>
          <h1>Settings</h1>
          <p className="sub">How the app splits your month into two paydays.</p>
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
          <label className="field">
            <span className="lab">The 2nd cutoff starts on day</span>
            <input className="input" name="secondStart" inputMode="numeric" required defaultValue={start} aria-describedby="c-hint" />
          </label>
          <p id="c-hint" className="sub" style={{ margin: 0 }}>
            The 1st cutoff runs from the 1st up to the day before. With {start}, the 1st cutoff is days 1 to {start - 1} and the 2nd is day {start} to
            the end of the month. The dashboard uses this to pick the cutoff you are in today.
          </p>
          <button type="submit" className="btn">Save</button>
        </form>
      </section>
    </main>
  );
}
