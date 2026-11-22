"use client";

import { useRef } from "react";
import { V13Icon } from "./icons";

/** A sideways row with its scrollbar hidden and previous and next buttons instead. Arrow keys work on the row when it has focus. */
export function HScroll({ label, children }: { label: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const by = (dir: -1 | 1) => {
    const el = ref.current;
    if (!el) return;
    const reduce = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: reduce ? "auto" : "smooth" });
  };
  return (
    <div className="v-hs">
      <button type="button" className="v-hsb v-prev" onClick={() => by(-1)} aria-label={`${label}: scroll back`}>
        <V13Icon name="chev" className="v-i" />
      </button>
      <div
        ref={ref}
        className="v-hscroll"
        tabIndex={0}
        role="region"
        aria-label={label}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") { e.preventDefault(); by(1); }
          if (e.key === "ArrowLeft") { e.preventDefault(); by(-1); }
        }}
      >
        {children}
      </div>
      <button type="button" className="v-hsb v-next" onClick={() => by(1)} aria-label={`${label}: scroll forward`}>
        <V13Icon name="chev" className="v-i" />
      </button>
    </div>
  );
}
