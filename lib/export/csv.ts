// Tables you can download, and the name each file gets.
export const EXPORTS = [
  "accounts", // kind, last 4 digits only
  "balance_anchors",
  "transactions", // amount, merchant, time; never raw notification text
  "category_groups",
  "categories",
  "budget_lines_v2",
  "salary_events",
  "allowances",
  "bonus_rules",
  "bonus_instances",
  "bonus_instance_splits",
  "funds",
  "month_overrides",
  "pools",
  "pool_entries",
] as const;
export type ExportName = (typeof EXPORTS)[number];

export function isExportName(v: string): v is ExportName {
  return (EXPORTS as readonly string[]).includes(v);
}

function cell(v: unknown): string {
  if (v === null || v === undefined) return "";
  let s = typeof v === "object" ? JSON.stringify(v) : String(v);
  // A text cell that starts with = + - @ can run as a formula when opened in a spreadsheet.
  if (typeof v === "string" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const cols = Object.keys(rows[0]);
  return [cols.join(","), ...rows.map((r) => cols.map((c) => cell(r[c])).join(","))].join("\r\n") + "\r\n";
}
