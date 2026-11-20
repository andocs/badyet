import type { SupabaseClient } from "@supabase/supabase-js";
import { money } from "@/lib/domain/money";
import { loadSalary, type SalaryData } from "@/lib/salary/load";
import type { DestKind, SavedSplit } from "./view";

export interface BonusData {
  salary: SalaryData;
  thisYear: number;
  /** Saved destinations by `ruleId|year`. */
  saved: Map<string, SavedSplit[]>;
  funds: { id: string; name: string }[];
}

const rows = <T,>(r: { data: unknown }): T[] => (r.data ?? []) as T[];

export async function loadBonuses(supabase: SupabaseClient): Promise<BonusData> {
  const salary = await loadSalary(supabase);
  const [inst, splits, funds] = await Promise.all([
    supabase.from("bonus_instances").select("id, rule_id, year"),
    supabase.from("bonus_instance_splits").select("instance_id, target_kind, target_id, label, amount, done"),
    supabase.from("funds").select("id, name").is("archived_at", null).order("priority"),
  ]);
  const keyOf = new Map(rows<{ id: string; rule_id: string; year: number }>(inst).map((i) => [i.id, `${i.rule_id}|${i.year}`]));
  const saved = new Map<string, SavedSplit[]>();
  for (const s of rows<{ instance_id: string; target_kind: DestKind; target_id: string | null; label: string | null; amount: number; done: boolean }>(splits)) {
    const key = keyOf.get(s.instance_id);
    if (!key) continue;
    saved.set(key, [...(saved.get(key) ?? []), { kind: s.target_kind, targetId: s.target_id, label: s.label, amount: money(s.amount), done: s.done }]);
  }
  return { salary, thisYear: Number(salary.thisMonth.slice(0, 4)), saved, funds: rows<{ id: string; name: string }>(funds) };
}
