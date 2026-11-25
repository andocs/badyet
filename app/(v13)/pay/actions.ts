"use server";

import { revalidatePath } from "next/cache";
import { requireAuthed } from "@/lib/auth/require";
import type { FormState } from "@/lib/form-state";
import { saveOtherDeduction } from "@/lib/pay/other-deduction";
import { saveSavingsPlan } from "@/lib/pay/savings-plan";
import { validateRaise, validateTemplates } from "@/lib/salary/event-input";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const refresh = () => {
  revalidatePath("/pay");
  revalidatePath("/");
  revalidatePath("/budget");
};
const first = (month: string) => `${month}-01`;

/** Saves the payroll savings plan: what is taken each cutoff and the fund the forecast counts it into. */
export async function saveSavingsPlanAction(input: unknown): Promise<FormState> {
  const supabase = await requireAuthed();
  const r = await saveSavingsPlan(supabase, input);
  if ("error" in r) return { error: r.error };
  refresh();
  revalidatePath("/forecast");
  revalidatePath("/funds");
  return { ok: true };
}

/** Saves the other payroll deduction (HMO plan and the like): its name and what comes off each cutoff. */
export async function saveOtherDeductionAction(input: unknown): Promise<FormState> {
  const supabase = await requireAuthed();
  const r = await saveOtherDeduction(supabase, input);
  if ("error" in r) return { error: r.error };
  refresh();
  revalidatePath("/budget");
  return { ok: true };
}

/** An expected event has happened: it becomes a confirmed one. */
export async function confirmEvent(id: string): Promise<FormState> {
  const supabase = await requireAuthed();
  if (!UUID.test(id)) return { error: "That event was not found." };
  const { error } = await supabase.from("salary_events").update({ status: "confirmed" }).eq("id", id);
  if (error) return { error: "Could not confirm that. Try again." };
  refresh();
  return { ok: true };
}

/** Removes an event. Its "where the extra goes" top-ups go with it. The start event is your base and stays. */
export async function deleteEvent(id: string): Promise<FormState> {
  const supabase = await requireAuthed();
  if (!UUID.test(id)) return { error: "That event was not found." };
  const row = await supabase.from("salary_events").select("kind").eq("id", id).maybeSingle();
  if (!row.data) return { error: "That event was not found." };
  if (row.data.kind === "start") return { error: "The start event is your base pay. Add a raise instead of removing it." };
  const { error } = await supabase.from("salary_events").delete().eq("id", id);
  if (error) return { error: "Could not remove that. Try again." };
  refresh();
  return { ok: true };
}

/** The "Assume a raise every year" card: on or off, the percent, and the month. */
export async function saveAssumptions(input: { on: boolean; pctBp: number; month: number }): Promise<FormState> {
  const supabase = await requireAuthed();
  if (!Number.isInteger(input.pctBp) || input.pctBp < 0 || input.pctBp > 100_000) return { error: "Enter a raise between 0% and 1,000%." };
  if (!Number.isInteger(input.month) || input.month < 1 || input.month > 12) return { error: "Pick a month." };
  const values = { assumed_raise_on: input.on === true, assumed_raise_bp: input.pctBp, assumed_raise_month: input.month };
  const existing = await supabase.from("plan_assumptions").select("user_id").maybeSingle();
  const { error } = existing.data ? await supabase.from("plan_assumptions").update(values).eq("user_id", existing.data.user_id) : await supabase.from("plan_assumptions").insert(values);
  if (error) return { error: "Could not save that. Try again." };
  refresh();
  return { ok: true };
}

export async function setAllowance(id: string, change: { cutoff?: "first" | "second"; taxable?: boolean }): Promise<FormState> {
  const supabase = await requireAuthed();
  if (!UUID.test(id)) return { error: "That allowance was not found." };
  const values: Record<string, unknown> = {};
  if (change.cutoff === "first" || change.cutoff === "second") values.payslip_cutoff = change.cutoff;
  if (typeof change.taxable === "boolean") values.taxable = change.taxable;
  if (Object.keys(values).length === 0) return { error: "Nothing to change." };
  const { error } = await supabase.from("allowances").update(values).eq("id", id);
  if (error) return { error: "Could not save that. Try again." };
  refresh();
  return { ok: true };
}

export async function deleteAllowance(id: string): Promise<FormState> {
  const supabase = await requireAuthed();
  if (!UUID.test(id)) return { error: "That allowance was not found." };
  const { error } = await supabase.from("allowances").delete().eq("id", id);
  if (error) return { error: "Could not remove that. Try again." };
  refresh();
  return { ok: true };
}

/** Saves the payslip layout from a month on: one template per cutoff, replacing any saved for that same month. */
export async function saveTemplates(input: unknown): Promise<FormState> {
  const supabase = await requireAuthed();
  const v = validateTemplates(input);
  if (!v.ok) return { error: v.error };
  const { month, first: firstLines, second: secondLines } = v.value;

  const del = await supabase.from("payslip_templates").delete().eq("effective_month", first(month));
  if (del.error) return { error: "Could not save the layout. Try again." };
  const made = await supabase
    .from("payslip_templates")
    .insert([
      { cutoff: "first", effective_month: first(month) },
      { cutoff: "second", effective_month: first(month) },
    ])
    .select("id, cutoff");
  if (made.error || !made.data) return { error: "Could not save the layout. Try again." };
  const rows = made.data.flatMap((t) =>
    (t.cutoff === "first" ? firstLines : secondLines).map((l, i) => ({
      template_id: t.id,
      kind: l.kind,
      label: l.label,
      source: l.source,
      share_bp: l.shareBp ?? null,
      amount_override: l.amountOverride ?? null,
      sort: i,
    })),
  );
  if (rows.length > 0) {
    const ins = await supabase.from("payslip_lines").insert(rows);
    if (ins.error) return { error: "Saved the layout but not its lines. Try again." };
  }
  refresh();
  return { ok: true };
}

/** Back to the standard layout from a month on: layouts saved for that month and later are removed. */
export async function resetTemplates(month: string): Promise<FormState> {
  const supabase = await requireAuthed();
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return { error: "Pick a month." };
  const { error } = await supabase.from("payslip_templates").delete().gte("effective_month", first(month));
  if (error) return { error: "Could not reset the layout. Try again." };
  refresh();
  return { ok: true };
}

/** The raise wizard's save: the event, an allowance when that is what changed, and the "where the extra goes" top-ups. */
export async function addSalaryEvent(input: unknown): Promise<FormState> {
  const supabase = await requireAuthed();
  const v = validateRaise(input);
  if (!v.ok) return { error: v.error };
  const p = v.value;

  if (p.allocations.length > 0) {
    const ids = p.allocations.map((a) => a.lineId);
    const found = await supabase.from("budget_lines_v2").select("id").in("id", ids);
    if ((found.data ?? []).length !== ids.length) return { error: "One of those budget lines was not found." };
  }

  let allowanceId: string | null = null;
  if (p.kind === "allowance" && p.allowance) {
    const a = p.allowance;
    const made = await supabase
      .from("allowances")
      .insert({ payslip_cutoff: a.cutoff, name: a.name, amount: a.amount, frequency: a.frequency, pay_month: a.frequency === "yearly" ? a.payMonth : null, taxable: a.taxable, starts_on: first(p.month) })
      .select("id")
      .single();
    if (made.error) return { error: "Could not save the allowance. Try again." };
    allowanceId = made.data.id;
  }

  const event = await supabase
    .from("salary_events")
    .insert({
      effective_month: first(p.month),
      kind: p.kind,
      pct_bp: p.pctBp ?? null,
      new_base: p.newBase ?? null,
      allowance_id: allowanceId,
      one_off_amount: p.adjustment?.amount ?? null,
      one_off_taxable: p.adjustment?.taxable ?? false,
      title: p.title ?? null,
      grade: p.grade ?? null,
      status: p.status,
    })
    .select("id")
    .single();
  if (event.error) {
    if (allowanceId) await supabase.from("allowances").delete().eq("id", allowanceId);
    return { error: "Could not save the event. Try again." };
  }

  if (p.allocations.length > 0) {
    const ins = await supabase.from("raise_allocations").insert(
      p.allocations.map((a) => ({ salary_event_id: event.data.id, budget_line_id: a.lineId, mode: a.mode, amount: a.mode === "amount" ? a.amount : null, pct_bp: a.mode === "percent" ? a.pctBp : null })),
    );
    if (ins.error) return { error: "The event was saved but its budget top-ups were not. Edit them from Budget." };
  }
  refresh();
  return { ok: true };
}
