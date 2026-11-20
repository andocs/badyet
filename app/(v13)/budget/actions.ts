"use server";

import { revalidatePath } from "next/cache";
import { requireAuthed } from "@/lib/auth/require";
import { validateCategory, validateLine } from "@/lib/budget/line-input";
import type { FormState } from "@/lib/form-state";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const refresh = () => {
  revalidatePath("/budget");
  revalidatePath("/");
};
const monthStart = (m: string | null) => (m ? `${m}-01` : null);

/** Creates or updates a budget line. Only one line can be the RTO contingency; choosing another moves the role. */
export async function saveLine(input: unknown): Promise<FormState> {
  const supabase = await requireAuthed();
  const v = validateLine(input);
  if (!v.ok) return { error: v.error };
  const l = v.value;

  const cat = await supabase.from("categories").select("id").eq("id", l.categoryId).is("archived_at", null).maybeSingle();
  if (!cat.data) return { error: "That category was not found." };
  if (l.accountId) {
    const acct = await supabase.from("accounts").select("id").eq("id", l.accountId).maybeSingle();
    if (!acct.data) return { error: "That account was not found." };
  }
  if (l.kind === "rto_contingency") {
    // The unique index allows one; free the role first so the save below cannot trip it.
    const q = supabase.from("budget_lines_v2").update({ kind: "normal" }).eq("kind", "rto_contingency");
    await (l.id ? q.neq("id", l.id) : q);
  }

  const values = {
    category_id: l.categoryId,
    name: l.name,
    rule: l.rule,
    amount: l.rule === "fixed" ? l.amount : null,
    pct_bp: l.rule === "pct" ? l.pctBp : null,
    cutoff: l.cutoff,
    account_id: l.accountId,
    starts_on: monthStart(l.startsOn),
    ends_on: monthStart(l.endsOn),
    is_draft: l.isDraft,
    counts_to_daily: l.countsToDaily,
    kind: l.kind,
  };
  let lineId = l.id ?? null;
  if (l.id) {
    const { error } = await supabase.from("budget_lines_v2").update(values).eq("id", l.id);
    if (error) return { error: "Could not save the line. Try again." };
  } else {
    const { data, error } = await supabase.from("budget_lines_v2").insert(values).select("id").single();
    if (error) return { error: "Could not save the line. Try again." };
    lineId = data.id;
  }

  // The contingency line funds a pool of the same name; create it the first time.
  if (l.kind === "rto_contingency" && lineId) {
    const pool = await supabase.from("pools").select("id").eq("budget_line_id", lineId).maybeSingle();
    if (!pool.data) await supabase.from("pools").insert({ name: "RTO contingency", budget_line_id: lineId });
  }
  refresh();
  return { ok: true };
}

/** Deletes a line. Transactions that pointed at it stay (they lose the link); raise top-ups on it go. */
export async function deleteLine(id: string): Promise<FormState> {
  const supabase = await requireAuthed();
  if (!UUID.test(id)) return { error: "That line was not found." };
  const { error } = await supabase.from("budget_lines_v2").delete().eq("id", id);
  if (error) return { error: "Could not delete that line. Try again." };
  refresh();
  return { ok: true };
}

export async function saveCategory(input: unknown): Promise<FormState> {
  const supabase = await requireAuthed();
  const v = validateCategory(input);
  if (!v.ok) return { error: v.error };
  const c = v.value;
  const group = await supabase.from("category_groups").select("id").eq("id", c.groupId).maybeSingle();
  if (!group.data) return { error: "That group was not found." };
  const values = { name: c.name, group_id: c.groupId, color: c.color };
  const { error } = c.id ? await supabase.from("categories").update(values).eq("id", c.id) : await supabase.from("categories").insert(values);
  if (error) return { error: "Could not save the category. Try again." };
  refresh();
  return { ok: true };
}

/** Archives a category: it keeps its transactions but leaves the pickers. A category that still has lines cannot be archived. */
export async function archiveCategory(id: string): Promise<FormState> {
  const supabase = await requireAuthed();
  if (!UUID.test(id)) return { error: "That category was not found." };
  const used = await supabase.from("budget_lines_v2").select("id", { count: "exact", head: true }).eq("category_id", id);
  if ((used.count ?? 0) > 0) return { error: "Move or delete its budget lines first." };
  const { error } = await supabase.from("categories").update({ archived_at: new Date().toISOString() }).eq("id", id);
  if (error) return { error: "Could not archive that. Try again." };
  refresh();
  return { ok: true };
}

/** The weekdays you usually go to the office (ISO, 1 = Monday). */
export async function setUsualOfficeDays(days: number[]): Promise<FormState> {
  const supabase = await requireAuthed();
  if (!Array.isArray(days) || days.length > 7 || days.some((d) => !Number.isInteger(d) || d < 1 || d > 7)) return { error: "Pick days of the week." };
  const unique = [...new Set(days)].sort();
  const existing = await supabase.from("user_settings").select("user_id").maybeSingle();
  const { error } = existing.data ? await supabase.from("user_settings").update({ office_days: unique }).eq("user_id", existing.data.user_id) : await supabase.from("user_settings").insert({ office_days: unique });
  if (error) return { error: "Could not save that. Try again." };
  refresh();
  return { ok: true };
}

/** Mark a day as an office day (or not). Going in on a non-usual day draws one day's budget from the contingency pool. */
export async function setOfficeDay(input: { date: string; office: boolean; usual: boolean; dayBudget: number }): Promise<FormState> {
  const supabase = await requireAuthed();
  if (!DAY.test(input.date)) return { error: "Pick a day." };
  if (!Number.isInteger(input.dayBudget) || input.dayBudget < 0 || input.dayBudget > 100_000_000) return { error: "Check the day budget." };
  const wantsOverride = input.office !== input.usual;

  // Three round trips instead of seven: look things up and clear the old tap together, then write.
  const [pool, contingency] = await Promise.all([
    supabase.from("pools").select("id, budget_line_id").not("budget_line_id", "is", null),
    supabase.from("budget_lines_v2").select("id").eq("kind", "rto_contingency").maybeSingle(),
    supabase.from("office_day_overrides").delete().eq("day", input.date),
  ]);
  const poolId = (pool.data ?? []).find((p) => p.budget_line_id === contingency.data?.id)?.id as string | undefined;

  // Remove the previous pool draw for this day while saving the new tap.
  const [, ins] = await Promise.all([
    poolId ? supabase.from("pool_entries").delete().eq("pool_id", poolId).eq("occurred_on", input.date).eq("kind", "use").eq("note", "Extra office day") : Promise.resolve(null),
    wantsOverride ? supabase.from("office_day_overrides").insert({ day: input.date, in_office: input.office }) : Promise.resolve(null),
  ]);
  if (ins?.error) return { error: "Could not save that day. Try again." };
  if (wantsOverride && input.office && !input.usual && poolId && input.dayBudget > 0) {
    await supabase.from("pool_entries").insert({ pool_id: poolId, occurred_on: input.date, kind: "use", amount: input.dayBudget, note: "Extra office day" });
  }
  refresh();
  return { ok: true };
}

const SETTLE_KINDS = ["settle_to_pool", "settle_to_wants", "over_from_wants", "over_from_excess"] as const;

/** Where an office day's difference goes: under budget to the pool or Wants, over budget from Wants or the pool's excess. */
export async function settleDay(input: { date: string; under: boolean; to: "pool" | "wants" | "excess"; amount: number }): Promise<FormState> {
  const supabase = await requireAuthed();
  if (!DAY.test(input.date)) return { error: "Pick a day." };
  if (!Number.isInteger(input.amount) || input.amount <= 0 || input.amount > 100_000_000) return { error: "Check the amount." };
  const kind = input.under ? (input.to === "pool" ? "settle_to_pool" : input.to === "wants" ? "settle_to_wants" : null) : input.to === "wants" ? "over_from_wants" : input.to === "excess" ? "over_from_excess" : null;
  if (!kind) return { error: "Pick where it goes." };
  const contingency = await supabase.from("budget_lines_v2").select("id").eq("kind", "rto_contingency").maybeSingle();
  const pool = contingency.data ? await supabase.from("pools").select("id").eq("budget_line_id", contingency.data.id).maybeSingle() : { data: null };
  if (!pool.data) return { error: "Mark one budget line as the RTO contingency first." };
  await supabase.from("pool_entries").delete().eq("pool_id", pool.data.id).eq("occurred_on", input.date).in("kind", [...SETTLE_KINDS]);
  const { error } = await supabase.from("pool_entries").insert({ pool_id: pool.data.id, occurred_on: input.date, kind, amount: input.amount, note: "Office day settled" });
  if (error) return { error: "Could not save that. Try again." };
  refresh();
  return { ok: true };
}

export async function undoSettle(date: string): Promise<FormState> {
  const supabase = await requireAuthed();
  if (!DAY.test(date)) return { error: "Pick a day." };
  const { error } = await supabase.from("pool_entries").delete().eq("occurred_on", date).in("kind", [...SETTLE_KINDS]);
  if (error) return { error: "Could not undo that. Try again." };
  refresh();
  return { ok: true };
}

/** Take money out of a pool for something unplanned, or move it to Wants (which adds to this cutoff's daily amount). */
export async function takeFromPool(input: { poolId: string; amount: number; to: "use" | "to_wants"; note?: string }): Promise<FormState> {
  const supabase = await requireAuthed();
  if (!UUID.test(input.poolId)) return { error: "That pool was not found." };
  if (!Number.isInteger(input.amount) || input.amount <= 0 || input.amount > 100_000_000_000) return { error: "Enter an amount above zero." };
  if (input.to !== "use" && input.to !== "to_wants") return { error: "Pick what to do." };
  const pool = await supabase.from("pools").select("id").eq("id", input.poolId).maybeSingle();
  if (!pool.data) return { error: "That pool was not found." };
  const today = new Date(Date.now() + 8 * 3_600_000).toISOString().slice(0, 10);
  const { error } = await supabase.from("pool_entries").insert({ pool_id: input.poolId, occurred_on: today, kind: input.to, amount: input.amount, note: (input.note ?? (input.to === "use" ? "Used for something unplanned" : "Moved to Wants")).slice(0, 200) });
  if (error) return { error: "Could not save that. Try again." };
  refresh();
  return { ok: true };
}

/** A new pool, optionally funded each cutoff by a budget line, with an optional "keep up to" level. */
export async function createPool(input: { name: string; lineId: string | null; keepUpTo: number | null }): Promise<FormState> {
  const supabase = await requireAuthed();
  const name = (input.name ?? "").trim();
  if (name.length < 1 || name.length > 40) return { error: "Give the pool a name of up to 40 characters." };
  if (input.lineId !== null && !UUID.test(input.lineId)) return { error: "Pick a line from the list." };
  if (input.keepUpTo !== null && (!Number.isInteger(input.keepUpTo) || input.keepUpTo < 0)) return { error: "Check the keep-up-to amount." };
  const { error } = await supabase.from("pools").insert({ name, budget_line_id: input.lineId, keep_up_to: input.keepUpTo });
  if (error) return { error: "Could not create the pool. Try again." };
  refresh();
  return { ok: true };
}
