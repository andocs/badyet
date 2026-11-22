import { RulesView, type DeviceApp, type SeenSender } from "@/components/v13/rules";
import { configsFromRows, rulesFromRows, type RuleRow, type SourceRow } from "@/lib/capture/sources";
import { patternsFromRows, type PatternRow } from "@/lib/capture/patterns";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Rules · Bad(yet)" };

const NO_TABLE = ["42P01", "PGRST205"];
const RULE_COLS = "id, source, match_text, action, category_id, name, enabled, channel, words, must_words, skip_words, sources, packages, senders, kind, from_account_id, to_account_id, auto_confirm, position";
const OLD_COLS = "id, source, match_text, action, category_id";

export default async function Rules() {
  const supabase = await createClient();
  if (!supabase) return <p className="v-main">Supabase is not configured.</p>;
  const [catRes, acctRes, srcRes, patRes, appsRes, sendersRes, dedupeRes, setRes] = await Promise.all([
    supabase.from("categories").select("id, name").is("archived_at", null).order("sort"),
    supabase.from("accounts").select("id, name").is("archived_at", null).order("sort"),
    supabase.from("capture_sources").select("source, enabled, packages, senders, account_id, category_id, auto_confirm, min_amount"),
    supabase.from("capture_patterns").select("id, source, template, direction").order("created_at"),
    supabase.from("device_apps").select("package, label, seen, updated_at").order("label"),
    supabase.from("seen_senders").select("address, emails").order("emails", { ascending: false }),
    supabase.from("dedupe_rules").select("window_minutes, match_source").maybeSingle(),
    supabase.from("user_settings").select("gmail_alert_check").maybeSingle(),
  ]);
  let rulesRes: { data: unknown; error: { code?: string } | null } = await supabase.from("capture_rules").select(RULE_COLS).order("position").order("created_at");
  // Until the Rules database update is applied the new columns do not exist; fall back to the old ones and say so.
  let needsUpdate = false;
  if (rulesRes.error?.code === "42703") {
    needsUpdate = true;
    rulesRes = await supabase.from("capture_rules").select(OLD_COLS).order("created_at");
  }
  // Until the capture migration is applied the tables do not exist; say so instead of failing the page.
  const captureMissing = NO_TABLE.includes(srcRes.error?.code ?? "") || NO_TABLE.includes(rulesRes.error?.code ?? "");

  const appRows = appsRes.error ? [] : ((appsRes.data ?? []) as { package: string; label: string | null; seen: string; updated_at: string }[]);
  const apps: DeviceApp[] = appRows.map((a) => ({ package: a.package, label: a.label, seen: a.seen === "notified" ? "notified" : "installed" }));
  const lastSynced = appRows.reduce<string | null>((m, a) => (m === null || a.updated_at > m ? a.updated_at : m), null);
  const senders: SeenSender[] = sendersRes.error ? [] : ((sendersRes.data ?? []) as { address: string; emails: number }[]).map((s) => ({ address: s.address, emails: Number(s.emails) }));
  const d = dedupeRes.error ? null : (dedupeRes.data as { window_minutes: number; match_source: boolean } | null);

  return (
    <main className="v-main">
      <RulesView
        rules={rulesFromRows(rulesRes.error ? [] : ((rulesRes.data ?? []) as unknown as RuleRow[]))}
        sources={configsFromRows(srcRes.error ? [] : ((srcRes.data ?? []) as SourceRow[]))}
        patterns={patRes.error ? [] : patternsFromRows((patRes.data ?? []) as PatternRow[])}
        accounts={(acctRes.data ?? []) as { id: string; name: string }[]}
        categories={(catRes.data ?? []) as { id: string; name: string }[]}
        apps={apps}
        lastSynced={lastSynced}
        seenSenders={senders}
        dedupe={{ windowMinutes: d?.window_minutes ?? 30, matchSource: d?.match_source ?? false }}
        gmailAlert={(setRes.data as { gmail_alert_check?: boolean } | null)?.gmail_alert_check ?? true}
        captureMissing={captureMissing}
        needsUpdate={needsUpdate}
      />
    </main>
  );
}
