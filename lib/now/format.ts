import type { IsoDate } from "@/lib/domain/dates";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const parts = (d: IsoDate) => ({ y: Number(d.slice(0, 4)), m: Number(d.slice(5, 7)), day: Number(d.slice(8, 10)) });
const weekday = (d: IsoDate) => WEEKDAYS[new Date(Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10)))).getUTCDay()]!;

/** "20 Nov" */
export function shortDate(d: IsoDate): string {
  const p = parts(d);
  return `${p.day} ${MONTHS[p.m - 1]}`;
}

/** "Fri 20 Nov" */
export function dayLabel(d: IsoDate): string {
  return `${weekday(d)} ${shortDate(d)}`;
}

/** "11–24 Nov", or "25 Mar–10 Apr" when the cutoff crosses a month. */
export function rangeLabel(start: IsoDate, end: IsoDate): string {
  const a = parts(start);
  const b = parts(end);
  return a.m === b.m ? `${a.day}–${b.day} ${MONTHS[b.m - 1]}` : `${shortDate(start)}–${shortDate(end)}`;
}

export const weekdayName = weekday;

/** "Today", "Yesterday", or "Wed 18 Nov" for the day group headings in Recent. */
export function relativeDay(d: IsoDate, today: IsoDate): string {
  const diff = Math.round((Date.parse(today) - Date.parse(d)) / 86_400_000);
  return diff === 0 ? "Today" : diff === 1 ? "Yesterday" : dayLabel(d);
}

export const ordinalCutoff = (cutoff: "first" | "second"): string => (cutoff === "first" ? "1st" : "2nd");

/** "6:42 pm", in Asia/Manila. */
export function timeLabel(iso: string): string {
  const d = new Date(Date.parse(iso) + 8 * 3_600_000);
  const h = d.getUTCHours();
  return `${h % 12 === 0 ? 12 : h % 12}:${String(d.getUTCMinutes()).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
}
