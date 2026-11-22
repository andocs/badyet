import Link from "next/link";
import { DiagnosticsLog } from "@/components/v13/diagnostics-log";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Diagnostics · Bad(yet)" };

interface Row { at: string; session: string; event: string; detail: Record<string, unknown> | null }

const stamp = (iso: string) =>
  new Date(iso).toLocaleString("en-PH", { timeZone: "Asia/Manila", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }) +
  "." + String(new Date(iso).getMilliseconds()).padStart(3, "0");

export default async function Diagnostics() {
  const supabase = await createClient();
  if (!supabase) return <p className="v-main">Supabase is not configured.</p>;
  const res = await supabase.from("app_diagnostics").select("at, session, event, detail").order("at", { ascending: false }).limit(500);
  const missing = ["42P01", "PGRST205"].includes(res.error?.code ?? "");
  const rows = (res.data ?? []) as Row[];
  // Oldest first reads like a story, so the text is in time order; the phone's runs are told apart by their session code.
  const text = [...rows].reverse().map((r) => `${stamp(r.at)}  [${r.session}]  ${r.event}${r.detail ? "  " + JSON.stringify(r.detail) : ""}`).join("\n");

  return (
    <main className="v-main">
      <div className="v-narrow v-stack">
        <div>
          <Link className="v-sm" href="/settings">‹ Settings</Link>
          <h1>Diagnostics</h1>
          <div className="v-lbl">A temporary log from the phone app, to find out why it sticks after idling. Events and timings only: no amounts, no notification text.</div>
        </div>
        {missing ? (
          <div className="v-note">Apply supabase/migrations/20261212000000_app_diagnostics.sql, then reload.</div>
        ) : (
          <DiagnosticsLog text={text} count={rows.length} />
        )}
      </div>
    </main>
  );
}
