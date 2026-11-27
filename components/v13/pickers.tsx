"use client";

import { useCallback, useRef, useState } from "react";
import type { YearMonth } from "@/lib/domain/dates";
import { dateText, monthGrid, shiftMonth, WEEKDAY_LETTERS } from "@/lib/domain/calendar";
import { Popover } from "./popover";

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const ord = (n: number) => `${n}${n % 10 === 1 && n !== 11 ? "st" : n % 10 === 2 && n !== 12 ? "nd" : n % 10 === 3 && n !== 13 ? "rd" : "th"}`;
const labelOf = (m: string) => `${MON[Number(m.slice(5)) - 1]} ${m.slice(0, 4)}`;
const ymOf = (y: number, m: number) => `${y}-${String(m).padStart(2, "0")}` as YearMonth;

/**
 * Picks a month and year without dropdowns, like a calendar: a grid of months for the year, arrows to change the year, and the year
 * itself opens a grid of years. Pass `name` to submit it with a form; `clearable` lets the value be empty.
 */
export function MonthPicker({ value, onChange, min, max, label, name, clearable, placeholder = "Not set" }: {
  value: string;
  onChange: (v: YearMonth | "") => void;
  min: string;
  max: string;
  label: string;
  name?: string;
  clearable?: boolean;
  placeholder?: string;
}) {
  const btn = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(() => Number((value || min).slice(0, 4)));
  const [years, setYears] = useState(false);
  const first = Number(min.slice(0, 4));
  const last = Number(max.slice(0, 4));
  const close = () => { setOpen(false); setYears(false); };
  const inRange = (y: number, m: number) => { const ym = ymOf(y, m); return ym >= min && ym <= max; };
  const yearList = Array.from({ length: last - first + 1 }, (_, i) => first + i);
  const shownYear = Math.min(Math.max(year, first), last);

  return (
    <>
      {name ? <input type="hidden" name={name} value={value} /> : null}
      <button ref={btn} type="button" className="v-pickbtn" aria-haspopup="dialog" aria-expanded={open} aria-label={`${label}: ${value ? labelOf(value) : placeholder}. Change`}
        onClick={() => { setYear(Number((value || min).slice(0, 4))); setYears(false); setOpen(true); }}>
        <span className={value ? "" : "v-muted"}>{value ? labelOf(value) : placeholder}</span>
      </button>
      <Popover anchor={btn} open={open} onClose={close} label={label}>
        <div className="v-pophd">
          <button type="button" className="v-iconbtn v-s" aria-label="Previous year" disabled={years || shownYear <= first} onClick={() => setYear(shownYear - 1)}>‹</button>
          <button type="button" className="v-yearbtn" aria-expanded={years} onClick={() => setYears(!years)}>{shownYear}</button>
          <button type="button" className="v-iconbtn v-s" aria-label="Next year" disabled={years || shownYear >= last} onClick={() => setYear(shownYear + 1)}>›</button>
        </div>
        {years ? (
          <div className="v-pg v-years" role="group" aria-label="Year">
            {yearList.map((y) => <button key={y} type="button" aria-pressed={y === shownYear} ref={(el) => { if (el && y === shownYear) el.scrollIntoView({ block: "center" }); }} onClick={() => { setYear(y); setYears(false); }}>{y}</button>)}
          </div>
        ) : (
          <div className="v-pg v-months3" role="group" aria-label={`Month in ${shownYear}`}>
            {MON.map((m, i) => (
              <button key={m} type="button" disabled={!inRange(shownYear, i + 1)} aria-pressed={value === ymOf(shownYear, i + 1)} onClick={() => { onChange(ymOf(shownYear, i + 1)); close(); }}>{m}</button>
            ))}
          </div>
        )}
        {clearable && value ? <button type="button" className="v-btn v-sm v-ghost" onClick={() => { onChange(""); close(); }}>Clear</button> : null}
      </Popover>
    </>
  );
}

/** A month of the year (Jan to Dec) in the same popover as the month picker, for things that repeat every year. */
export function MonthOfYear({ value, onChange, label, disabled }: { value: number; onChange: (m: number) => void; label: string; disabled?: boolean }) {
  const btn = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return (
    <>
      <button ref={btn} type="button" className="v-pickbtn" disabled={disabled} aria-haspopup="dialog" aria-expanded={open} aria-label={`${label}: ${MON[value - 1]}. Change`} onClick={() => setOpen(true)}>
        <span>{MON[value - 1]}</span>
      </button>
      <Popover anchor={btn} open={open} onClose={close} label={label}>
        <div className="v-pophd"><b>{label}</b></div>
        <div className="v-pg v-months3" role="group" aria-label={label}>
          {MON.map((m, i) => <button key={m} type="button" aria-pressed={value === i + 1} onClick={() => { onChange(i + 1); close(); }}>{m}</button>)}
        </div>
      </Popover>
    </>
  );
}

/** A day of the month as a calendar grid, for paydays. */
export function DayOfMonth({ value, onChange, min = 1, max = 28, label }: { value: number; onChange: (d: number) => void; min?: number; max?: number; label: string }) {
  const btn = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return (
    <>
      <button ref={btn} type="button" className="v-pickbtn" aria-haspopup="dialog" aria-expanded={open} aria-label={`${label}: the ${ord(value)}. Change`} onClick={() => setOpen(true)}>
        <span>{ord(value)}</span>
      </button>
      <Popover anchor={btn} open={open} onClose={close} label={label}>
        <div className="v-pophd"><b>{label}</b></div>
        <div className="v-pg v-days" role="group" aria-label="Day of the month">
          {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
            <button key={d} type="button" disabled={d < min || d > max} aria-pressed={value === d} onClick={() => { onChange(d); close(); }}>{d}</button>
          ))}
        </div>
      </Popover>
    </>
  );
}

/**
 * A full date (use it instead of <input type="date">): a calendar in the same popover. The month's name opens a grid of months, with
 * arrows to change the year. `value` is YYYY-MM-DD or "".
 */
export function DatePicker({ value, onChange, label, min, max, disabled, placeholder = "Pick a date" }: { value: string; onChange: (v: string) => void; label: string; min?: string; max?: string; disabled?: boolean; placeholder?: string }) {
  const btn = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [months, setMonths] = useState(false);
  const startMonth = () => (value || (min && min > today() ? min : today())).slice(0, 7);
  const [month, setMonth] = useState(startMonth);
  const close = useCallback(() => { setOpen(false); setMonths(false); }, []);
  const year = Number(month.slice(0, 4));
  const allowed = (d: string) => (!min || d >= min) && (!max || d <= max);
  const monthAllowed = (m: string) => (!min || m >= min.slice(0, 7)) && (!max || m <= max.slice(0, 7));
  const step = (by: number) => setMonth(shiftMonth(month, months ? by * 12 : by));

  return (
    <>
      <button ref={btn} type="button" className="v-pickbtn" disabled={disabled} aria-haspopup="dialog" aria-expanded={open} aria-label={`${label}: ${value ? dateText(value) : placeholder}. Change`}
        onClick={() => { setMonth(startMonth()); setMonths(false); setOpen(true); }}>
        <span className={value ? "" : "v-muted"}>{value ? dateText(value) : placeholder}</span>
      </button>
      <Popover anchor={btn} open={open} onClose={close} label={label}>
        <div className="v-pophd">
          <button type="button" className="v-iconbtn v-s" aria-label={months ? "Previous year" : "Previous month"} onClick={() => step(-1)}>‹</button>
          <button type="button" className="v-yearbtn" aria-expanded={months} onClick={() => setMonths(!months)}>{months ? year : `${MON[Number(month.slice(5)) - 1]} ${year}`}</button>
          <button type="button" className="v-iconbtn v-s" aria-label={months ? "Next year" : "Next month"} onClick={() => step(1)}>›</button>
        </div>
        {months ? (
          <div className="v-pg v-months3" role="group" aria-label={`Month in ${year}`}>
            {MON.map((m, i) => (
              <button key={m} type="button" disabled={!monthAllowed(ymOf(year, i + 1))} aria-pressed={month === ymOf(year, i + 1)} onClick={() => { setMonth(ymOf(year, i + 1)); setMonths(false); }}>{m}</button>
            ))}
          </div>
        ) : (
          <div className="v-pg v-days" role="group" aria-label="Day">
            {WEEKDAY_LETTERS.map((d, i) => <span key={i} className="v-dow" aria-hidden="true">{d}</span>)}
            {monthGrid(month).map((d, i) =>
              d === null ? <span key={`e${i}`} /> : (
                <button key={d} type="button" disabled={!allowed(d)} aria-pressed={d === value} aria-current={d === today() ? "date" : undefined} aria-label={dateText(d)} onClick={() => { onChange(d); close(); }}>{Number(d.slice(8))}</button>
              ),
            )}
          </div>
        )}
      </Popover>
    </>
  );
}

/** Today in Philippine time, which is the app's calendar. */
const today = () => new Date(Date.now() + 8 * 3_600_000).toISOString().slice(0, 10);
