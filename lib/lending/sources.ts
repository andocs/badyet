import { buildBudgetScreen } from "@/lib/budget/screen";
import { bonusCards } from "@/lib/bonuses/view";
import type { BonusData } from "@/lib/bonuses/load";
import type { FundsData } from "@/lib/funds/load";
import { formatPesos, money } from "@/lib/domain/money";
import type { SourceInput } from "./write";
import { cutoffDraws, leftThisCutoff } from "./model";

/** "Take it from": what lent money can come out of, in the groups the picker shows. */
export interface SourceOption {
  /** "kind" or "kind:ref"; see sourceOfKey. */
  key: string;
  /** The name alone, for "What changes". */
  name: string;
  label: string;
}
export interface SourceGroup {
  title: string;
  options: SourceOption[];
}

export const NO_SOURCE = "none";
export const sourceKey = (s: SourceInput): string => (s.ref ? `${s.kind}:${s.ref}` : s.kind);
export function sourceOfKey(key: string): SourceInput {
  const at = key.indexOf(":");
  return at < 0 ? { kind: key as SourceInput["kind"], ref: null } : { kind: key.slice(0, at) as SourceInput["kind"], ref: key.slice(at + 1) };
}

export function sourceGroups(funds: FundsData, bonuses: BonusData): SourceGroup[] {
  const screen = buildBudgetScreen(funds.budget, { fut: false });
  const cutoff = funds.budget.period.which === 1 ? "first" : "second";
  const wants: SourceOption[] = [];
  const other: SourceOption[] = [];
  const left = leftThisCutoff(cutoffDraws(funds.budget.draws, funds.budget.period), new Set(funds.budget.lines.filter((l) => l.rule === "rest").map((l) => l.id)));
  const moved = screen.wantsAdj;
  const total = left.wants(screen.shown?.budget.rest[cutoff] ?? 0, moved);
  wants.push({ key: "wants", name: "Wants", label: `Wants · ${formatPesos(total)} ${moved > 0 ? `incl. ${formatPesos(moved)} RTO` : moved < 0 ? `after ${formatPesos(money(-moved))} RTO` : "this cutoff"}` });
  for (const g of screen.groups) {
    if (g.feedsSavings) continue;
    const isWants = g.name.trim().toLowerCase() === "wants";
    for (const l of g.lines) {
      const planned = l.perCutoff?.[cutoff] ?? 0;
      if (l.rule === "rest" || planned <= 0) continue;
      const amount = left.line(l.id, planned);
      (isWants ? wants : other).push({ key: `line:${l.id}`, name: l.name, label: `${l.name} · ${formatPesos(money(amount))} this cutoff` });
    }
  }
  const savings: SourceOption[] = funds.funds.map((f) => ({ key: `fund:${f.id}`, name: f.name, label: `${f.name} · ${formatPesos(money(funds.fundStart[f.id] ?? 0))}` }));
  const received: SourceOption[] = [bonuses.thisYear - 1, bonuses.thisYear].flatMap((year) =>
    bonusCards(year, bonuses.salary.input, bonuses.saved)
      .filter((c) => c.status === "received" || c.month <= bonuses.salary.thisMonth)
      .map((c) => ({ key: `bonus:${c.key}`, name: `${c.name} ${c.year}`, label: `${c.name} ${c.year} · ${formatPesos(c.net)}` })),
  );
  return [
    { title: "Wants", options: wants },
    { title: "Savings (your funds)", options: savings },
    { title: "Bonuses (received)", options: received },
    { title: "Other budget lines", options: other },
  ].filter((g) => g.options.length > 0);
}
