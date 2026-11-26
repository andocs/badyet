import { monthOf, periodOf, type IsoDate, type YearMonth } from "@/lib/domain/dates";
import { money } from "@/lib/domain/money";
import { cutoffSettingsFromPaydays } from "@/lib/engine/months";
import type { GroupView } from "./view";

/**
 * Office-day (RTO) money you moved somewhere else, shown on the Budget page: taken off where it came from and added where it went.
 */
export type Place =
  /** The office-day (RTO) line. */
  | { kind: "rto" }
  /** The line that feeds a pool, such as the RTO contingency. */
  | { kind: "pool"; lineId: string | null; name: string }
  | { kind: "wants" }
  | { kind: "savings" };

export interface Move {
  from: Place;
  to: Place;
  amount: number;
  cutoff: "first" | "second";
  /**
   * true = it is this cutoff's own money (an office day you settled), so the amounts and totals change. false = it moves a pool's saved
   * balance, which may have built up over earlier cutoffs: it is noted on both sides and no amount changes.
   */
  counted: boolean;
}

export interface MoveNote {
  /** Such as "to Wants" or "from RTO". */
  text: string;
  /** Negative where the money left, positive where it arrived. */
  amount: number;
  counted: boolean;
}

/** A line for money that arrived at Wants or savings, which have no line of their own to add to. */
export interface MoveRow {
  key: string;
  label: string;
  amount: number;
  cutoff: "first" | "second" | "both";
  counted: boolean;
}

interface PoolLike {
  name: string;
  lineId: string | null;
  entries: readonly { kind: string; amount: number; occurredOn: IsoDate }[];
}

/** The moves of one budget month, by the cutoff each was made in (a 2nd cutoff running into the next calendar month stays in its own). */
export function budgetMoves(pools: readonly PoolLike[], paydays: { first: number; second: number }, month: YearMonth): Move[] {
  const settings = cutoffSettingsFromPaydays(paydays.first, paydays.second);
  const out: Move[] = [];
  for (const pool of pools) {
    const here: Place = { kind: "pool", lineId: pool.lineId, name: pool.name };
    for (const e of pool.entries) {
      const pair: [Place, Place, boolean] | null =
        e.kind === "settle_to_wants" ? [{ kind: "rto" }, { kind: "wants" }, true]
        : e.kind === "settle_to_savings" ? [{ kind: "rto" }, { kind: "savings" }, true]
        : e.kind === "settle_to_pool" ? [{ kind: "rto" }, here, true]
        : e.kind === "over_from_wants" ? [{ kind: "wants" }, { kind: "rto" }, true]
        : e.kind === "over_from_excess" ? [here, { kind: "rto" }, false]
        : e.kind === "to_wants" ? [here, { kind: "wants" }, false]
        : null;
      if (!pair || e.amount <= 0) continue;
      const period = periodOf(e.occurredOn, settings);
      if (monthOf(period.start) !== month) continue;
      out.push({ from: pair[0], to: pair[1], counted: pair[2], amount: e.amount, cutoff: period.which === 1 ? "first" : "second" });
    }
  }
  return out;
}

const nameOf = (p: Place) => (p.kind === "rto" ? "RTO" : p.kind === "wants" ? "Wants" : p.kind === "savings" ? "savings" : p.name);

export interface MovedBudget {
  groups: GroupView[];
  /** What to write under a line, by line id. */
  notes: Record<string, MoveNote[]>;
  /** Extra rows to list in a category, by category group id. */
  rows: Record<string, MoveRow[]>;
}

/** The categories with the moves applied. Pass the groups already cut down to a cutoff, and that cutoff. */
export function applyMoves(groupsIn: readonly GroupView[], moves: readonly Move[], cutoff: "first" | "second" | null = null): MovedBudget {
  const groups = groupsIn.map((g) => ({ ...g, lines: g.lines.map((l) => ({ ...l })) }));
  const notes: Record<string, MoveNote[]> = {};
  const rows: Record<string, MoveRow[]> = {};
  const lines = groups.flatMap((g) => g.lines.map((l) => ({ group: g, line: l })));
  const rto = lines.find((x) => x.line.kind === "rto" && x.line.amount !== null) ?? lines.find((x) => x.line.kind === "rto");
  const wantsGroup = groups.find((g) => /want/i.test(g.name)) ?? [...groups].reverse().find((g) => !g.feedsSavings) ?? groups.at(-1);
  const savingsGroup = groups.find((g) => g.feedsSavings) ?? groups.at(-1);

  const note = (lineId: string, text: string, amount: number, counted: boolean) => {
    const list = (notes[lineId] ??= []);
    const found = list.find((n) => n.text === text && n.counted === counted);
    if (found) found.amount += amount;
    else list.push({ text, amount, counted });
  };

  const side = (place: Place, other: Place, amount: number, move: Move) => {
    const text = `${amount < 0 ? "to" : "from"} ${nameOf(other)}`;
    const target = place.kind === "rto" ? rto : place.kind === "pool" ? lines.find((x) => x.line.id === place.lineId) : undefined;
    if (target) {
      note(target.line.id, text, amount, move.counted);
      if (!move.counted || target.line.amount === null) return;
      target.line.amount = money(target.line.amount + amount);
      if (target.line.perCutoff) target.line.perCutoff = { ...target.line.perCutoff, [move.cutoff]: money(target.line.perCutoff[move.cutoff] + amount) };
      target.group.total = money(target.group.total + amount);
      return;
    }
    if (place.kind !== "wants" && place.kind !== "savings") return;
    const group = place.kind === "wants" ? wantsGroup : savingsGroup;
    if (!group) return;
    const label = `${amount < 0 ? "Moved to" : "Moved from"} ${nameOf(other)}`;
    const list = (rows[group.id] ??= []);
    const key = `${label}|${move.counted}`;
    const found = list.find((r) => r.key === key);
    if (found) {
      found.amount += amount;
      if (found.cutoff !== move.cutoff) found.cutoff = "both";
    } else list.push({ key, label, amount, cutoff: move.cutoff, counted: move.counted });
    if (move.counted) group.total = money(group.total + amount);
  };

  for (const move of moves) {
    if (cutoff && move.cutoff !== cutoff) continue;
    side(move.from, move.to, -move.amount, move);
    side(move.to, move.from, move.amount, move);
  }
  return { groups, notes, rows };
}
