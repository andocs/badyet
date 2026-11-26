"use server";

import { revalidatePath } from "next/cache";
import { requireAuthed } from "@/lib/auth/require";
import { validateInstance, validateRule } from "@/lib/bonuses/input";
import type { FormState } from "@/lib/form-state";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const refresh = () => {
  revalidatePath("/bonuses");
  revalidatePath("/pay");
  revalidatePath("/budget");
};

/** Creates or updates a bonus rule (yearly, or a one-off). */
export async function saveRule(input: unknown): Promise<FormState> {
  const supabase = await requireAuthed();
  const v = validateRule(input);
  if (!v.ok) return { error: v.error };
  const r = v.value;
  const values = {
    payslip_cutoff: r.cutoff,
    recurrence: r.recurrence,
    kind: r.kind,
    name: r.name,
    pay_month: r.payMonth,
    once_on: r.recurrence === "once" && r.onceOn ? `${r.onceOn}-01` : null,
    formula: r.formula,
    base_multiple_bp: r.formula === "base_multiple" ? r.baseMultipleBp : null,
    eligible_amount: r.formula === "eligible_x_component_x_multiplier" ? r.eligibleAmount : null,
    component_num: r.formula === "eligible_x_component_x_multiplier" ? r.componentNum : null,
    fixed_amount: r.formula === "fixed" ? r.fixedAmount : null,
    de_minimis: r.deMinimis,
  };
  const { error } = r.id ? await supabase.from("bonus_rules").update(values).eq("id", r.id) : await supabase.from("bonus_rules").insert(values);
  if (error) return { error: "Could not save the bonus. Try again." };
  refresh();
  return { ok: true };
}

/** Removes a bonus from every future plan. Past years it was received keep their history, so it is archived, not deleted. */
export async function archiveRule(id: string): Promise<FormState> {
  const supabase = await requireAuthed();
  if (!UUID.test(id)) return { error: "That bonus was not found." };
  const { error } = await supabase.from("bonus_rules").update({ archived_at: new Date().toISOString() }).eq("id", id);
  if (error) return { error: "Could not remove that. Try again." };
  refresh();
  return { ok: true };
}

/**
 * Saves one year's choices for a bonus: the CIP Low/Base/High pick, where the money goes (replacing the earlier list, with done ticks),
 * and, when it has been paid, what actually arrived.
 */
export async function saveInstance(input: unknown): Promise<FormState> {
  const supabase = await requireAuthed();
  const v = validateInstance(input);
  if (!v.ok) return { error: v.error };
  const i = v.value;

  const rule = await supabase.from("bonus_rules").select("id").eq("id", i.ruleId).maybeSingle();
  if (!rule.data) return { error: "That bonus was not found." };

  const values = {
    multiplier_num: i.multiplierNum,
    ...(i.received
      ? { status: "received", gross_actual: i.received.gross, de_minimis_actual: i.received.deMinimis, net_actual: i.received.net, tax_actual: i.received.gross - i.received.net }
      : {}),
  };
  const existing = await supabase.from("bonus_instances").select("id").eq("rule_id", i.ruleId).eq("year", i.year).maybeSingle();
  let instanceId = existing.data?.id as string | undefined;
  if (instanceId) {
    const { error } = await supabase.from("bonus_instances").update(values).eq("id", instanceId);
    if (error) return { error: "Could not save that. Try again." };
  } else {
    const { data, error } = await supabase.from("bonus_instances").insert({ rule_id: i.ruleId, year: i.year, status: "planned", ...values }).select("id").single();
    if (error) return { error: "Could not save that. Try again." };
    instanceId = data.id;
  }

  const del = await supabase.from("bonus_instance_splits").delete().eq("instance_id", instanceId);
  if (del.error) return { error: "Could not save the destinations. Try again." };
  if (i.splits.length > 0) {
    const ins = await supabase.from("bonus_instance_splits").insert(
      i.splits.map((s) => ({ instance_id: instanceId, target_kind: s.kind, target_id: s.targetId, label: s.label, amount: s.amount, done: s.done })),
    );
    if (ins.error) return { error: "Saved the bonus but not its destinations. Try again." };
  }
  refresh();
  return { ok: true };
}
