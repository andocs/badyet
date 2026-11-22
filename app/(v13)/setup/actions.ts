"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { anchorAmount, parseNewAccount } from "@/lib/accounts/v13";
import { requireAuthed } from "@/lib/auth/require";
import type { FormState } from "@/lib/form-state";
import { validateSetup, type SetupLine } from "@/lib/setup/input";

const GROUP_ORDER = ["Essentials", "Wants", "Savings"] as const;

/** Makes sure the three starter groups exist and returns their ids by name. */
async function ensureGroups(supabase: SupabaseClient): Promise<Map<string, string>> {
  const existing = await supabase.from("category_groups").select("id, name").is("archived_at", null);
  const byName = new Map(((existing.data ?? []) as { id: string; name: string }[]).map((g) => [g.name.toLowerCase(), g.id]));
  for (const [i, name] of GROUP_ORDER.entries()) {
    if (byName.has(name.toLowerCase())) continue;
    const { data } = await supabase.from("category_groups").insert({ name, sort: i + 1, feeds_savings: name === "Savings" }).select("id").single();
    if (data) byName.set(name.toLowerCase(), data.id);
  }
  return byName;
}

async function addLines(supabase: SupabaseClient, lines: SetupLine[]): Promise<string | null> {
  const groups = await ensureGroups(supabase);
  const all = [...lines];
  // The savings pool needs a "Whatever is left" line to fill from; add one unless there already is one.
  const hasRest = await supabase.from("budget_lines_v2").select("id", { count: "exact", head: true }).eq("rule", "rest");
  const rest = (hasRest.count ?? 0) === 0;
  for (const [i, l] of all.entries()) {
    const groupId = groups.get(l.group.toLowerCase());
    if (!groupId) return "Could not set up the budget groups.";
    const cat = await supabase.from("categories").insert({ group_id: groupId, name: l.name, sort: i }).select("id").single();
    if (cat.error) return "Could not save a budget category. Try again.";
    const { error } = await supabase.from("budget_lines_v2").insert({
      category_id: cat.data.id, name: l.name, rule: l.rule, amount: l.rule === "fixed" ? l.amount : null, pct_bp: l.rule === "pct" ? l.pctBp : null,
      cutoff: l.cutoff, counts_to_daily: l.group === "Wants", kind: "normal", sort: i,
    });
    if (error) return "Could not save a budget line. Try again.";
  }
  if (rest) {
    const savings = groups.get("savings");
    if (savings) {
      const cat = await supabase.from("categories").insert({ group_id: savings, name: "Whatever is left", sort: 99 }).select("id").single();
      if (cat.data) await supabase.from("budget_lines_v2").insert({ category_id: cat.data.id, name: "Whatever is left", rule: "rest", cutoff: "both", kind: "normal", sort: 99 });
    }
  }
  return null;
}

/**
 * The first-run wizard's save. Each step is optional. Running it again adds to what you already have: accounts and budget lines are added,
 * your starting salary and paydays are updated, funds are added after the ones you have. Stops at the first problem and says what.
 */
export async function completeSetup(input: unknown): Promise<FormState> {
  const supabase = await requireAuthed();
  const v = validateSetup(input);
  if (!v.ok) return { error: v.error };
  const s = v.value;

  const parsed = s.accounts.map((a) => parseNewAccount(a));
  const bad = parsed.find((p) => !p.ok);
  if (bad && !bad.ok) return { error: bad.error };
  for (const p of parsed) {
    if (!p.ok) continue;
    const a = p.value;
    const { data, error } = await supabase
      .from("accounts")
      .insert({ name: a.name, kind: a.kind, institution: a.institution, last4: a.last4, color: a.color, credit_limit: a.creditLimit, statement_day: a.statementDay, due_day: a.dueDay })
      .select("id")
      .single();
    if (error) return { error: error.code === "23505" ? `You already have an account called ${a.name}.` : "Could not save an account. Try again." };
    await supabase.from("balance_anchors").insert({ account_id: data.id, as_of: new Date().toISOString(), amount: anchorAmount(a.kind, a.opening), source: "wizard" });
  }

  if (s.salary) {
    const values = { effective_month: `${s.salary.startMonth}-01`, kind: "start", new_base: s.salary.base, title: s.salary.title, grade: s.salary.grade, status: "confirmed" };
    const existing = await supabase.from("salary_events").select("id").eq("kind", "start").maybeSingle();
    const { error } = existing.data ? await supabase.from("salary_events").update(values).eq("id", existing.data.id) : await supabase.from("salary_events").insert(values);
    if (error) return { error: "Could not save your salary. Try again." };
    if (s.salary.sss !== null || s.salary.pagibig !== null) {
      const ps = await supabase.from("pay_settings").select("user_id").maybeSingle();
      const pv = { sss_override: s.salary.sss, pagibig_override: s.salary.pagibig };
      if (ps.data) await supabase.from("pay_settings").update(pv).eq("user_id", ps.data.user_id);
      else await supabase.from("pay_settings").insert(pv);
    }
    const assumptions = await supabase.from("plan_assumptions").select("user_id").maybeSingle();
    if (!assumptions.data) await supabase.from("plan_assumptions").insert({});
  }

  if (s.paydays) {
    const values = { first_payday_day: s.paydays.first, second_payday_day: s.paydays.second, first_cutoff_start_day: s.paydays.first + 1, second_cutoff_start_day: s.paydays.second, updated_at: new Date().toISOString() };
    const existing = await supabase.from("user_settings").select("user_id").maybeSingle();
    const { error } = existing.data ? await supabase.from("user_settings").update(values).eq("user_id", existing.data.user_id) : await supabase.from("user_settings").insert(values);
    if (error) return { error: "Could not save your paydays. Try again." };
  }

  if (s.lines && s.lines.length > 0) {
    const err = await addLines(supabase, s.lines);
    if (err) return { error: err };
  }

  if (s.funds && (s.funds.emergency || s.funds.travel)) {
    const last = await supabase.from("funds").select("priority").is("archived_at", null).order("priority", { ascending: false }).limit(1).maybeSingle();
    let priority = ((last.data?.priority as number | undefined) ?? 0) + 1;
    if (s.funds.emergency) {
      const { error } = await supabase.from("funds").insert({ name: "Emergency fund", color: "#34D399", priority: priority++, rule: "steps", tranches: [10_000_000], start_balance: 0 });
      if (error) return { error: "Could not add the emergency fund. Try again." };
    }
    if (s.funds.travel) {
      const { error } = await supabase.from("funds").insert({ name: "Travel", color: "#7FA8FF", priority, rule: "reset", target: 5_000_000, reset_month: 1, start_balance: 0 });
      if (error) return { error: "Could not add the travel fund. Try again." };
    }
  }

  for (const path of ["/", "/accounts", "/pay", "/budget", "/funds", "/forecast", "/settings"]) revalidatePath(path);
  return { ok: true };
}
