"use client";

import Link from "next/link";
import { useState } from "react";

export interface YearMonthCol {
  month: string;
  short: string;
  aria: string;
  href: string;
  selected: boolean;
  flag: "over" | "tight" | null;
  expected: boolean;
  /** Bar height in px. */
  h: number;
}

/** The twelve month columns. On a phone only one half-year (six months) shows, with arrows to the other half. */
export function YearMonths({ cols, year }: { cols: YearMonthCol[]; year: number }) {
  const [half, setHalf] = useState<0 | 1>(() => (Math.max(0, cols.findIndex((c) => c.selected)) >= 6 ? 1 : 0));
  return (
    <>
      <div className="v-mnav">
        <button type="button" className="v-iconbtn v-s" aria-label="First six months" disabled={half === 0} onClick={() => setHalf(0)}>‹</button>
        <b aria-live="polite">{half === 0 ? "Jan to Jun" : "Jul to Dec"} {year}</b>
        <button type="button" className="v-iconbtn v-s" aria-label="Last six months" disabled={half === 1} onClick={() => setHalf(1)}>›</button>
      </div>
      <div className="v-months" data-half={half} style={{ marginTop: 12 }} role="group" aria-label="Pick a month">
        {cols.map((c) => (
          <Link key={c.month} href={c.href} className="v-mcol" aria-pressed={c.selected} aria-label={c.aria}>
            {c.flag ? <span className="v-fl v-neg" aria-hidden="true">!</span> : null}
            {c.expected ? <span className="v-fl" style={{ left: "auto", right: 4, color: "var(--accent-text)" }} aria-hidden="true">○</span> : null}
            <span className="v-stk" style={{ height: c.h }} />
            {c.short}
          </Link>
        ))}
      </div>
    </>
  );
}
