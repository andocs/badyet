import type { SupabaseClient } from "@supabase/supabase-js";
import { isoDate, type YearMonth } from "@/lib/domain/dates";
import {
  allowanceOf,
  assumptionsOf,
  bonusInstancesOf,
  bonusRulesOf,
  paySettingsOf,
  withPlanExtra,
  salaryEventOf,
  templatesOf,
  type AllowanceRow,
  type AssumptionsRow,
  type BonusInstanceRow,
  type BonusInstanceSplitRow,
  type BonusRuleRow,
  type BonusSplitRow,
  type PaySettingsRow,
  type SalaryEventRow,
  type TemplateLineRow,
  type TemplateRow,
} from "@/lib/engine/rows";
import { todayManila } from "@/lib/plans/validate";
import type { SalaryInput } from "./view";

/** A budget line the raise wizard can put part of the extra on. */
export interface PlaceableLine {
  id: string;
  name: string;
  /** How many cutoffs the line applies to (1, or 2 for "both"). */
  cutoffs: 1 | 2;
}

export interface SalaryData {
  input: SalaryInput;
  /** The current month, Asia/Manila. */
  thisMonth: YearMonth;
  placeable: PlaceableLine[];
  /** Day of the month each cutoff is paid. */
  paydays: { first: number; second: number };
}

const rows = <T,>(r: { data: unknown }): T[] => (r.data ?? []) as T[];

/** Everything the Salary and tax screens need, from the rehaul tables (row-level security keeps it to your own rows). */
export async function loadSalary(supabase: SupabaseClient): Promise<SalaryData> {
  const [events, allowances, assumptions, pay, templates, tlines, brules, bsplits, binst, binstSplits, lines, cats, groups, us] = await Promise.all([
    supabase.from("salary_events").select("id, effective_month, kind, pct_bp, new_base, allowance_id, one_off_amount, one_off_taxable, status"),
    supabase.from("allowances").select("id, payslip_cutoff, name, amount, frequency, pay_month, taxable, starts_on, ends_on").order("starts_on"),
    supabase.from("plan_assumptions").select("cip_multiplier_num, assumed_raise_on, assumed_raise_bp, assumed_raise_month").maybeSingle(),
    supabase.from("pay_settings").select("sss_override, philhealth_override, pagibig_override, tax_override_first, tax_override_second, other_deduction, savings_plan_bp").maybeSingle(),
    supabase.from("payslip_templates").select("id, cutoff, effective_month"),
    supabase.from("payslip_lines").select("template_id, kind, label, source, share_bp, amount_override, sort"),
    supabase.from("bonus_rules").select("id, payslip_cutoff, recurrence, kind, name, pay_month, once_on, formula, base_multiple_bp, eligible_amount, component_num, fixed_amount, de_minimis").is("archived_at", null),
    supabase.from("bonus_splits").select("rule_id, target_kind, target_id, label, mode, amount, pct_bp"),
    supabase.from("bonus_instances").select("id, rule_id, year, multiplier_num, status, gross_actual, de_minimis_actual, net_actual"),
    supabase.from("bonus_instance_splits").select("instance_id, target_kind, target_id, label, amount"),
    supabase.from("budget_lines_v2").select("id, name, cutoff, rule, kind, is_draft, category_id").order("sort"),
    supabase.from("categories").select("id, group_id").is("archived_at", null),
    supabase.from("category_groups").select("id, feeds_savings"),
    supabase.from("user_settings").select("first_payday_day, second_payday_day").maybeSingle(),
  ]);
  // The savings plan's amount and fund are asked for on their own, so a database without that update still loads.
  const planExtra = await supabase.from("pay_settings").select("savings_plan_amount, savings_plan_fund_id").maybeSingle();

  const ps = us.data as { first_payday_day: number; second_payday_day: number } | null;

  const ruleRows = rows<BonusRuleRow>(brules);
  const instanceRows = rows<BonusInstanceRow>(binst);
  const feeds = new Map(rows<{ id: string; feeds_savings: boolean }>(groups).map((g) => [g.id, g.feeds_savings]));
  const groupOf = new Map(rows<{ id: string; group_id: string }>(cats).map((c) => [c.id, c.group_id]));
  const placeable = rows<{ id: string; name: string; cutoff: "first" | "second" | "both"; rule: string; kind: string; is_draft: boolean; category_id: string }>(lines)
    .filter((l) => l.rule !== "rest" && l.kind === "normal" && !l.is_draft && !feeds.get(groupOf.get(l.category_id) ?? ""))
    .map((l) => ({ id: l.id, name: l.name, cutoffs: (l.cutoff === "both" ? 2 : 1) as 1 | 2 }));

  return {
    thisMonth: isoDate(todayManila()).slice(0, 7) as YearMonth,
    placeable,
    paydays: { first: ps?.first_payday_day ?? 10, second: ps?.second_payday_day ?? 25 },
    input: {
      events: rows<SalaryEventRow>(events).map(salaryEventOf),
      allowances: rows<AllowanceRow>(allowances).map(allowanceOf),
      assumptions: assumptionsOf((assumptions.data as AssumptionsRow | null) ?? null),
      settings: paySettingsOf(withPlanExtra((pay.data as PaySettingsRow | null) ?? null, planExtra)),
      templates: templatesOf(rows<TemplateRow>(templates), rows<TemplateLineRow>(tlines)),
      bonusRules: bonusRulesOf(ruleRows, rows<BonusSplitRow>(bsplits), instanceRows),
      bonusInstances: bonusInstancesOf(instanceRows, rows<BonusInstanceSplitRow>(binstSplits)),
    },
  };
}
