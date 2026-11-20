import { NowPage, NowSetup } from "@/components/v13/now";
import { loadNow } from "@/lib/now/load";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Now · Bad(yet)" };

export default async function Now() {
  const supabase = await createClient();
  if (!supabase) return <NowSetup reason="no-salary" />;
  const data = await loadNow(supabase);
  if (data.kind === "setup") return <NowSetup reason={data.reason} />;
  const { count } = await supabase.from("transactions").select("id", { count: "exact", head: true }).eq("status", "pending");
  return <NowPage data={data} pending={count ?? 0} />;
}
