/** What the web and phone date pickers draw. Dates are YYYY-MM-DD and months YYYY-MM. */
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Weeks start on Sunday. */
export const WEEKDAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"] as const;

/** The cells of a month's calendar: empty ones before the 1st, then every day. */
export function monthGrid(month: string): (string | null)[] {
  const y = Number(month.slice(0, 4));
  const m = Number(month.slice(5, 7));
  const lead = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return [...Array<null>(lead).fill(null), ...Array.from({ length: days }, (_, i) => `${month.slice(0, 7)}-${String(i + 1).padStart(2, "0")}`)];
}

/** The month `by` months later (earlier when negative). */
export function shiftMonth(month: string, by: number): string {
  const total = Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7)) - 1 + by;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

/** "10 Dec 2026". Anything that is not a date is shown as typed. */
export function dateText(date: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  return m ? `${Number(m[3])} ${MON[Number(m[2]) - 1]} ${m[1]}` : date;
}

export const monthText = (month: string): string => `${MON[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`;
