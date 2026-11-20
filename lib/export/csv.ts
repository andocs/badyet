// Tables you can download, and the name each file gets.
export const EXPORTS = [
  "plans",
  "pay_profiles",
  "budget_lines",
  "wallets",
  "transfer_marks",
  "installments",
  "installment_payments",
  "subscriptions",
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
