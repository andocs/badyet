import type { SupabaseClient } from "@supabase/supabase-js";
import type { YearMonth } from "@/lib/domain/dates";
import { money, type Money } from "@/lib/domain/money";
import { loadBudget, type BudgetData } from "@/lib/budget/load";
import { balanceNow } from "@/lib/engine/balances";
import { startBalances } from "@/lib/engine/funds";
import type { Fund, MonthOverride } from "@/lib/engine/types";
import { loadLending, type Lending } from "@/lib/lending/load";
import { fundLending, type Held } from "@/lib/lending/model";

export interface FundsData {
  budget: BudgetData;
  /** Active funds in default priority order. */
  funds: Fund[];
  colors: Map<string, string | null>;
  accountBalances: Record<string, Money>;
  fundStart: Record<string, Money>;
  /** Lent money still out of a fund, and when the forecast expects it back. */
  held: Held[];
  lending: Lending;
  overrides: MonthOverride[];
  notes: Map<string, string>;
}

interface FundDb {
  id: string; name: string; color: string | null; priority: number; rule: Fund["rule"]; target: number | null; tranches: number[] | null;
  max_per_month: number | null; fixed_amount: number | null; reset_month: number | null; linked_account_id: string | null; share_bp: number | null; start_balance: number | null;
}
const rows = <T,>(r: { data: unknown }): T[] => (r.data ?? []) as T[];
const m = (n: number | null) => (n == null ? null : money(n));

export const fundOf = (f: FundDb): Fund => ({
  id: f.id,
  name: f.name,
  priority: f.priority,
  rule: f.rule,
  target: m(f.target),
  tranches: f.tranches ? f.tranches.map((t) => money(Number(t))) : null,
  maxPerMonth: m(f.max_per_month),
  fixedAmount: m(f.fixed_amount),
  resetMonth: f.reset_month,
  linkedAccountId: f.linked_account_id,
  shareBp: f.share_bp,
  startBalance: m(f.start_balance),
});

/** The balance of every account now (the latest anchor plus confirmed transactions after it). */
async function loadAccountBalances(supabase: SupabaseClient): Promise<Record<string, Money>> {
  const [accts, anchors] = await Promise.all([supabase.from("accounts").select("id").is("archived_at", null), supabase.from("balance_anchors").select("account_id, as_of, amount")]);
  const anchorRows = rows<{ account_id: string; as_of: string; amount: number }>(anchors);
  const earliest = anchorRows.map((a) => a.as_of).sort()[0];
  const txns = earliest ? rows<{ account_id: string; occurred_at: string; amount: number; status: "pending" | "confirmed" | "ignored" }>(await supabase.from("transactions").select("account_id, occurred_at, amount, status").eq("status", "confirmed").gte("occurred_at", earliest)) : [];
  const out: Record<string, Money> = {};
  for (const a of rows<{ id: string }>(accts)) {
    out[a.id] = balanceNow(
      anchorRows.filter((x) => x.account_id === a.id).map((x) => ({ asOf: x.as_of, amount: money(x.amount) })),
      txns.filter((t) => t.account_id === a.id).map((t) => ({ occurredAt: t.occurred_at, amount: money(t.amount), status: t.status })),
    );
  }
  return out;
}

export async function loadFunds(supabase: SupabaseClient): Promise<FundsData> {
  const [budget, fundRes, ovRes, pinRes, balances, lending] = await Promise.all([
    loadBudget(supabase),
    supabase.from("funds").select("id, name, color, priority, rule, target, tranches, max_per_month, fixed_amount, reset_month, linked_account_id, share_bp, start_balance").is("archived_at", null).order("priority"),
    supabase.from("month_overrides").select("id, month, fund_order, note"),
    supabase.from("month_fund_overrides").select("override_id, fund_id, pin_amount, skip"),
    loadAccountBalances(supabase),
    loadLending(supabase),
  ]);
  const fundRows = rows<FundDb>(fundRes);
  const funds = fundRows.map(fundOf);
  // Where a full fund's extra goes is a newer column, asked for on its own so a database without that update still loads.
  const overflowOf = new Map(rows<{ id: string; overflow_to: string | null }>(await supabase.from("month_overrides").select("id, overflow_to")).map((o) => [o.id, o.overflow_to]));
  const pins = rows<{ override_id: string; fund_id: string; pin_amount: number | null; skip: boolean }>(pinRes);
  const notes = new Map<string, string>();
  const overrides: MonthOverride[] = rows<{ id: string; month: string; fund_order: string[] | null; note: string | null }>(ovRes).map((o) => {
    const mine = pins.filter((p) => p.override_id === o.id);
    const month = o.month.slice(0, 7) as YearMonth;
    if (o.note) notes.set(month, o.note);
    return {
      month,
      order: o.fund_order,
      pins: Object.fromEntries(mine.filter((p) => p.pin_amount !== null && !p.skip).map((p) => [p.fund_id, money(p.pin_amount!)])),
      skips: mine.filter((p) => p.skip).map((p) => p.fund_id),
      overflow: overflowOf.get(o.id) ?? null,
    };
  });
  const { balances: fundStart, held } = fundLending(funds, startBalances(funds, balances), lending.loans, lending.outside, budget.today);
  return {
    budget,
    funds,
    colors: new Map(fundRows.map((f) => [f.id, f.color])),
    accountBalances: balances,
    fundStart,
    held,
    lending,
    overrides,
    notes,
  };
}
