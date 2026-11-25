import type { SupabaseClient } from "@supabase/supabase-js";
import { loadBudget } from "@/lib/budget/load";
import { buildBudgetScreen } from "@/lib/budget/screen";
import { makeDate, periodOf, type IsoDate, type YearMonth } from "@/lib/domain/dates";
import { money, type Money } from "@/lib/domain/money";
import { cutoffSettingsFromPaydays } from "@/lib/engine/months";
import type { PayCutoff } from "@/lib/engine/types";
import { buildChecklist, type Checklist, type ChecklistLine, type ChecklistTransfer } from "./checklist";

interface TxnRow {
  id: string;
  account_id: string;
  amount: number;
  transfer_peer_id: string | null;
  budget_line_id: string | null;
  status: string;
}

/** Pairs each money-out transfer row with its other side, giving one transfer per move. Rows with no other side found are skipped. */
export function transfersFromRows(rows: readonly TxnRow[]): ChecklistTransfer[] {
  const byId = new Map(rows.map((r) => [r.id, r]));
  const out: ChecklistTransfer[] = [];
  for (const o of rows) {
    const peer = o.transfer_peer_id ? byId.get(o.transfer_peer_id) : undefined;
    if (o.amount >= 0 || !peer) continue;
    out.push({
      id: o.id,
      fromId: o.account_id,
      toId: peer.account_id,
      amount: money(-o.amount),
      lineId: o.budget_line_id ?? peer.budget_line_id ?? null,
      pending: o.status === "pending" || peer.status === "pending",
    });
  }
  return out;
}

export interface UnassignedLine {
  id: string;
  name: string;
  amount: Money;
}

export type ChecklistData =
  | { kind: "setup" }
  | {
      kind: "ready";
      cutoff: PayCutoff;
      /** The cutoff that is running now, to label its tab. */
      currentCutoff: PayCutoff;
      month: YearMonth;
      period: { start: IsoDate; end: IsoDate };
      payrollId: string | null;
      /** The payday of each cutoff (day of the month), for the tab labels. */
      paydays: { first: number; second: number };
      accounts: { id: string; name: string }[];
      checklist: Checklist;
      /** Budget lines with an amount in this cutoff but no wallet yet. */
      unassigned: UnassignedLine[];
    };

const nextDay = (d: IsoDate): string => new Date(Date.parse(d) + 86_400_000).toISOString().slice(0, 10);

/**
 * The pay checklist for a cutoff of the current budget month: each budget line's amount, the wallet it goes to, and which are sent,
 * from the transfers you ticked and the ones the app detected from notifications and emails.
 */
export async function loadChecklist(supabase: SupabaseClient, wanted?: PayCutoff): Promise<ChecklistData> {
  const data = await loadBudget(supabase);
  const screen = buildBudgetScreen(data, { fut: false });
  if (!screen.nowRun) return { kind: "setup" };

  const currentCutoff: PayCutoff = data.period.which === 1 ? "first" : "second";
  const cutoff = wanted ?? currentCutoff;
  const month = data.period.month;
  const day = cutoff === "first" ? data.paydays.first : data.paydays.second;
  const period = periodOf(makeDate(month, day), cutoffSettingsFromPaydays(data.paydays.first, data.paydays.second));

  // The lines in force for this cutoff (its plan, or the normal budget), with what each comes to.
  const amountOf = new Map(screen.nowRun.budget.lines.map((l) => [l.lineId, l[cutoff]]));
  const lines: ChecklistLine[] = [];
  const unassigned: UnassignedLine[] = [];
  for (const l of data.lines) {
    const amount = amountOf.get(l.id) ?? 0;
    if (amount <= 0) continue;
    if (l.accountId) lines.push({ id: l.id, name: l.name, walletId: l.accountId, amount: money(amount), reimbursed: !!l.reimburse, sort: l.sort ?? 0 });
    else unassigned.push({ id: l.id, name: l.name, amount: money(amount) });
  }

  const settings = await supabase.from("user_settings").select("pay_account_id").maybeSingle();
  const saved = settings.error ? null : ((settings.data as { pay_account_id: string | null } | null)?.pay_account_id ?? null);
  const payrollId = saved && data.accounts.some((a) => a.id === saved) ? saved : null;

  const from = `${period.start}T00:00:00+08:00`;
  const to = `${nextDay(period.end)}T00:00:00+08:00`;
  const res = await supabase.from("transactions").select("id, account_id, amount, transfer_peer_id, budget_line_id, status").eq("kind", "transfer").neq("status", "ignored").gte("occurred_at", from).lt("occurred_at", to);
  let rows = (res.error ? [] : (res.data ?? [])) as TxnRow[];
  // The other side of a move can fall just outside the range; fetch it by id.
  const have = new Set(rows.map((r) => r.id));
  const missing = [...new Set(rows.map((r) => r.transfer_peer_id).filter((id): id is string => !!id && !have.has(id)))];
  if (missing.length > 0) {
    const more = await supabase.from("transactions").select("id, account_id, amount, transfer_peer_id, budget_line_id, status").in("id", missing).neq("status", "ignored");
    rows = [...rows, ...((more.error ? [] : (more.data ?? [])) as TxnRow[])];
  }

  const checklist = buildChecklist({ lines, transfers: transfersFromRows(rows), payrollId });
  return { kind: "ready", cutoff, currentCutoff, month, period: { start: period.start, end: period.end }, payrollId, paydays: data.paydays, accounts: data.accounts, checklist, unassigned };
}
