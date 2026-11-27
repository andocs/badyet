"use client";

import { useEffect, useRef } from "react";

/**
 * A panel that opens under its field. It sits in the browser's top layer, so a dialog or a scrolling sheet never clips it, and it
 * closes when you tap outside, press Escape, scroll or resize. "panel" is the calendar size; "list" is a dropdown, at least as wide
 * as its field.
 */
export function Popover({ anchor, open, onClose, label, variant = "panel", children }: { anchor: React.RefObject<HTMLButtonElement | null>; open: boolean; onClose: () => void; label: string; variant?: "panel" | "list"; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    const btn = anchor.current;
    if (!el || !btn) return;
    if (!open) {
      if (el.matches(":popover-open")) el.hidePopover();
      return;
    }
    const place = () => {
      const r = btn.getBoundingClientRect();
      const width = Math.min(variant === "list" ? Math.max(r.width, 220) : 320, window.innerWidth - 16);
      el.style.width = `${width}px`;
      const height = el.offsetHeight || 340;
      const left = Math.min(Math.max(8, r.left), window.innerWidth - width - 8);
      const below = r.bottom + 6;
      const top = below + height > window.innerHeight - 8 ? Math.max(8, r.top - height - 6) : below;
      el.style.left = `${left}px`;
      el.style.top = `${top}px`;
    };
    if (!el.matches(":popover-open")) el.showPopover();
    place();
    const onScroll = (e: Event) => { if (!el.contains(e.target as Node)) onClose(); };
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onClose);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onClose);
    };
  }, [open, anchor, onClose, variant]);
  return (
    <div ref={ref} popover="auto" role={variant === "panel" ? "dialog" : "presentation"} aria-label={variant === "panel" ? label : undefined} className={`v-popp${variant === "list" ? " v-poplist" : ""}`} onToggle={(e) => { if (e.newState === "closed") onClose(); }}>
      {open ? children : null}
    </div>
  );
}
