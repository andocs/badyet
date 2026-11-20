import type { createClient } from "@/lib/supabase/server";

type Db = NonNullable<Awaited<ReturnType<typeof createClient>>>;

// Ticks (or un-ticks) transfers for a month and moves the destination balances with them, through one database function.
// Until that function exists in the database (migration 20261202000000), it falls back to plain ticks so nothing breaks.
export async function applyMarks(supabase: Db, lineIds: string[], month: string, sent: boolean): Promise<{ message: string } | null> {
  if (lineIds.length === 0) return null;
  const { error } = await supabase.rpc("apply_transfer_marks", { p_lines: lineIds, p_month: month, p_sent: sent });
  if (!error) return null;
  const missing = error.code === "PGRST202" || error.code === "42883" || /could not find the function/i.test(error.message);
  if (!missing) return error;
  const { error: plain } = sent
    ? await supabase.from("transfer_marks").upsert(lineIds.map((line_id) => ({ line_id, month })), { onConflict: "line_id,month", ignoreDuplicates: true })
    : await supabase.from("transfer_marks").delete().in("line_id", lineIds).eq("month", month);
  return plain;
}
