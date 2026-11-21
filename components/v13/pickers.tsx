"use client";

import { useEffect, useRef, useState } from "react";
import type { YearMonth } from "@/lib/domain/dates";

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const ord = (n: number) => `${n}${n % 10 === 1 && n !== 11 ? "st" : n % 10 === 2 && n !== 12 ? "nd" : n % 10 === 3 && n !== 13 ? "rd" : "th"}`;
const labelOf = (m: string) => `${MON[Number(m.slice(5)) - 1]} ${m.slice(0, 4)}`;

/** A small sheet the pickers open in, matching the app's other dialogs. */
function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} className="v-fdlg v-pick" aria-label={title} onClose={onClose} onClick={(e) => e.target === ref.current && onClose()}>
      <div className="v-qa">
        <div className="v-grab" aria-hidden="true" />
        {open ? children : null}
      </div>
    </dialog>
  );
}

/**
 * Picks a month and year without dropdowns. It opens on the years first, then the months of the year you chose.
 * Pass `name` to submit it with a form; `clearable` lets the value be empty.
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
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState<number | null>(null);
  const first = Number(min.slice(0, 4));
  const last = Number(max.slice(0, 4));
  const years = Array.from({ length: last - first + 1 }, (_, i) => first + i);
  const pickYear = (y: number) => setYear(y);
  const close = () => { setOpen(false); setYear(null); };
  const inRange = (y: number, m: number) => { const ym = `${y}-${String(m).padStart(2, "0")}`; return ym >= min && ym <= max; };

  return (
    <>
      {name ? <input type="hidden" name={name} value={value} /> : null}
      <button type="button" className="v-pickbtn" aria-haspopup="dialog" aria-label={`${label}: ${value ? labelOf(value) : placeholder}. Change`} onClick={() => { setYear(null); setOpen(true); }}>
        <span className={value ? "" : "v-muted"}>{value ? labelOf(value) : placeholder}</span>
      </button>
      <Sheet open={open} onClose={close} title={label}>
        <div className="v-row v-sp">
          <h2>{year === null ? "Pick a year" : `${year}`}</h2>
          <button type="button" className="v-iconbtn v-s" aria-label="Close" onClick={close}>×</button>
        </div>
        {year === null ? (
          <div className="v-pg" role="group" aria-label="Year">
            {years.map((y) => <button key={y} type="button" aria-pressed={value.startsWith(String(y))} onClick={() => pickYear(y)}>{y}</button>)}
          </div>
        ) : (
          <>
            <div className="v-pg v-months4" role="group" aria-label={`Month in ${year}`}>
              {MON.map((m, i) => (
                <button key={m} type="button" disabled={!inRange(year, i + 1)} aria-pressed={value === `${year}-${String(i + 1).padStart(2, "0")}`} onClick={() => { onChange(`${year}-${String(i + 1).padStart(2, "0")}` as YearMonth); close(); }}>{m}</button>
              ))}
            </div>
            <div className="v-row v-sp">
              <button type="button" className="v-btn v-sm v-ghost" onClick={() => setYear(null)}>← Years</button>
              {clearable && value ? <button type="button" className="v-btn v-sm" onClick={() => { onChange(""); close(); }}>Clear</button> : null}
            </div>
          </>
        )}
        {year === null && clearable && value ? <button type="button" className="v-btn v-sm" onClick={() => { onChange(""); close(); }}>Clear</button> : null}
      </Sheet>
    </>
  );
}

/** A month of the year (Jan to Dec) as twelve buttons, for things that repeat every year. */
export function MonthOfYear({ value, onChange, label, disabled }: { value: number; onChange: (m: number) => void; label: string; disabled?: boolean }) {
  return (
    <div className="v-moy" role="group" aria-label={label}>
      {MON.map((m, i) => <button key={m} type="button" disabled={disabled} aria-pressed={value === i + 1} onClick={() => onChange(i + 1)}>{m}</button>)}
    </div>
  );
}

/** A day of the month as a calendar grid, for paydays. */
export function DayOfMonth({ value, onChange, min = 1, max = 28, label }: { value: number; onChange: (d: number) => void; min?: number; max?: number; label: string }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return (
    <>
      <button type="button" className="v-pickbtn" aria-haspopup="dialog" aria-label={`${label}: the ${ord(value)}. Change`} onClick={() => setOpen(true)}>
        <span>{ord(value)}</span>
      </button>
      <Sheet open={open} onClose={close} title={label}>
        <div className="v-row v-sp"><h2>{label}</h2><button type="button" className="v-iconbtn v-s" aria-label="Close" onClick={close}>×</button></div>
        <div className="v-pg v-days" role="group" aria-label="Day of the month">
          {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
            <button key={d} type="button" disabled={d < min || d > max} aria-pressed={value === d} onClick={() => { onChange(d); close(); }}>{d}</button>
          ))}
        </div>
        <p className="v-xs v-muted" style={{ margin: 0 }}>Days run 1 to 28 so every month has them.</p>
      </Sheet>
    </>
  );
}
