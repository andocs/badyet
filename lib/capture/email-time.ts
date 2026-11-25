/**
 * The time a transaction happened, as written inside the email ("November 25, 2026 10:02 AM", "11/25/2026 10:02:15", ...), in
 * Philippine time. The email's own send or receipt time can trail the transaction by a long while (banks queue their emails), so
 * matching a bank email with the wallet notification for the same move uses this time instead.
 */
const MONTHS: Record<string, number> = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
const MON = 'jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec';
const TIME = String.raw`(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?`;

interface Hit {
  index: number;
  at: number;
}

/** Local Philippine time (UTC+8) to epoch milliseconds. */
function manila(y: number, m: number, d: number, hh: number, mm: number, ss: number, ampm: string | undefined): number | null {
  let h = hh;
  if (ampm) {
    if (h < 1 || h > 12) return null;
    h = (h % 12) + (ampm.toLowerCase() === 'pm' ? 12 : 0);
  }
  if (m < 0 || m > 11 || d < 1 || d > 31 || h > 23 || mm > 59 || ss > 59 || y < 2000 || y > 2100) return null;
  return Date.UTC(y, m, d, h, mm, ss) - 8 * 3_600_000;
}

const patterns: { re: RegExp; at: (g: string[]) => number | null }[] = [
  // November 25, 2026 10:02 AM  /  Nov 25th 2026 at 10:02:15
  { re: new RegExp(String.raw`\b(${MON})[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4}),?\s+(?:at\s+)?${TIME}`, 'gi'), at: (g) => manila(+g[3]!, MONTHS[g[1]!.slice(0, 3).toLowerCase()]!, +g[2]!, +g[4]!, +g[5]!, +(g[6] ?? 0), g[7]) },
  // 25 November 2026 10:02  /  25-Nov-2026 10:02 PM
  { re: new RegExp(String.raw`\b(\d{1,2})[\s-]+(${MON})[a-z]*\.?,?[\s-]+(\d{4}),?\s+(?:at\s+)?${TIME}`, 'gi'), at: (g) => manila(+g[3]!, MONTHS[g[2]!.slice(0, 3).toLowerCase()]!, +g[1]!, +g[4]!, +g[5]!, +(g[6] ?? 0), g[7]) },
  // 11/25/2026 10:02:15 AM (month first, as is usual here; day first when the first number cannot be a month)
  { re: new RegExp(String.raw`\b(\d{1,2})/(\d{1,2})/(\d{4}),?\s+${TIME}`, 'g'), at: (g) => (+g[1]! > 12 ? manila(+g[3]!, +g[2]! - 1, +g[1]!, +g[4]!, +g[5]!, +(g[6] ?? 0), g[7]) : manila(+g[3]!, +g[1]! - 1, +g[2]!, +g[4]!, +g[5]!, +(g[6] ?? 0), g[7])) },
  // 2026-11-25 10:02:15
  { re: new RegExp(String.raw`\b(\d{4})-(\d{2})-(\d{2})[T\s]+${TIME}`, 'g'), at: (g) => manila(+g[1]!, +g[2]! - 1, +g[3]!, +g[4]!, +g[5]!, +(g[6] ?? 0), g[7]) },
];

const LABEL = /(date|time|transaction|transfer|posted|processed|completed)[^\n]{0,24}$/i;

/**
 * The transaction time found in an email's text, or null when there is none. A time written next to a label such as "Transaction date"
 * wins over one found elsewhere. `near` is when the email arrived: a time more than 15 minutes after it, or more than 5 days before
 * it, cannot be the transaction (it is a due date, a statement date, ...), so it is skipped.
 */
export function transactionTime(text: string, near?: number): number | null {
  const flat = text.replace(/[\t\r]+/g, ' ');
  const hits: (Hit & { labelled: boolean })[] = [];
  for (const { re, at } of patterns) {
    for (const m of flat.matchAll(re)) {
      const t = at([...m]);
      if (t === null || Number.isNaN(t)) continue;
      if (near !== undefined && near > 0 && (t > near + 15 * 60_000 || t < near - 5 * 86_400_000)) continue;
      const before = flat.slice(Math.max(0, (m.index ?? 0) - 40), m.index ?? 0);
      hits.push({ index: m.index ?? 0, at: t, labelled: LABEL.test(before) });
    }
  }
  if (hits.length === 0) return null;
  hits.sort((a, b) => a.index - b.index);
  return (hits.find((h) => h.labelled) ?? hits[0]!).at;
}
