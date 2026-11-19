// Pure helpers for plan input. Dates are ISO strings (YYYY-MM-DD) in Asia/Manila.

export interface PlanInput {
  name: string;
  startDate: string;
  /** null = an ongoing plan with no end date. */
  endDate: string | null;
}

export type PlanResult = { ok: true; value: PlanInput } | { ok: false; error: string };

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidIsoDate(text: string): boolean {
  const m = ISO.exec(text);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d;
}

export function isUuid(text: string): boolean {
  return UUID.test(text);
}

export function validatePlan(raw: { name?: unknown; startDate?: unknown; endDate?: unknown }): PlanResult {
  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  const startDate = typeof raw.startDate === "string" ? raw.startDate : "";
  const endRaw = typeof raw.endDate === "string" ? raw.endDate.trim() : "";
  const endDate = endRaw === "" ? null : endRaw;
  if (name.length < 1 || name.length > 60) return { ok: false, error: "Give the plan a name (1 to 60 characters)." };
  if (!isValidIsoDate(startDate) || (endDate !== null && !isValidIsoDate(endDate))) return { ok: false, error: "Pick a valid start date, and an end date if the plan has one." };
  if (endDate !== null && endDate < startDate) return { ok: false, error: "The end date cannot be before the start date." };
  return { ok: true, value: { name, startDate, endDate } };
}

// Today in Asia/Manila as YYYY-MM-DD. `now` is injectable for tests.
export function todayManila(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

// Past plans (ended before today) are read-only. A plan with no end date never ends.
export function isPastPlan(endDate: string | null, today: string = todayManila()): boolean {
  return endDate !== null && endDate < today;
}
