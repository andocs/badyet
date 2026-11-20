import type { AllocatorSettings, GoalId } from "@/lib/domain/allocator";
import { parsePesos, ZERO, type Money } from "@/lib/domain/money";
import { isMonth } from "@/lib/transfer/month";

export const PRIORITIES = [
  "EF,TRAVEL,WANTS",
  "EF,WANTS,TRAVEL",
  "TRAVEL,EF,WANTS",
  "TRAVEL,WANTS,EF",
  "WANTS,EF,TRAVEL",
  "WANTS,TRAVEL,EF",
] as const;
export const GOAL_LABEL: Record<GoalId, string> = { EF: "Emergency fund", TRAVEL: "Travel fund", WANTS: "Wants fund" };
export const isGoal = (v: unknown): v is GoalId => v === "EF" || v === "TRAVEL" || v === "WANTS";
export const priorityLabel = (p: string) => p.split(",").map((g) => GOAL_LABEL[g as GoalId].replace(" fund", "")).join(" > ");

export interface SavingsInput {
  startMonth: string;
  start: { ef: Money; travel: Money; wants: Money };
  settings: AllocatorSettings;
  priority: string;
}
export type SavingsParse = { ok: true; value: SavingsInput } | { ok: false; error: string };

const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const MAX = 100_000_000_000;

function amount(raw: unknown, label: string, opts: { positive?: boolean } = {}): Money | string {
  const t = text(raw);
  if (t === "") return opts.positive ? `${label} is required.` : ZERO;
  const m = parsePesos(t);
  if (m === undefined || m < 0 || m > MAX) return `${label} must be an amount like 100,000.`;
  if (opts.positive && m === 0) return `${label} must be more than zero.`;
  return m;
}

export function parseSavingsForm(raw: Record<string, unknown>): SavingsParse {
  const month = text(raw.startMonth);
  if (!isMonth(month)) return { ok: false, error: "Pick the month the forecast starts." };
  const priority = text(raw.priority);
  if (!(PRIORITIES as readonly string[]).includes(priority)) return { ok: false, error: "Pick a priority order." };
  const fields = {
    ef: amount(raw.startEf, "Emergency fund balance"),
    travel: amount(raw.startTravel, "Travel fund balance"),
    wants: amount(raw.startWants, "Wants fund balance"),
    tranche: amount(raw.efTranche, "Emergency fund step", { positive: true }),
    efCap: amount(raw.efHardCap, "Emergency fund hard cap"),
    travelCap: amount(raw.travelCap, "Travel cap"),
    wantsCap: amount(raw.wantsCap, "Wants cap"),
  };
  const bad = Object.values(fields).find((v) => typeof v === "string");
  if (typeof bad === "string") return { ok: false, error: bad };
  const f = fields as Record<keyof typeof fields, Money>;
  return {
    ok: true,
    value: {
      startMonth: month,
      start: { ef: f.ef, travel: f.travel, wants: f.wants },
      priority,
      settings: {
        efTranche: f.tranche,
        efHardCap: f.efCap,
        travelCap: f.travelCap,
        wantsCap: f.wantsCap,
        defaultOrder: priority.split(",") as GoalId[],
      },
    },
  };
}
