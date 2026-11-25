"use client";

import { useEffect, useId, useRef, useState } from "react";
import { V13Icon } from "./icons";

export interface PickOption {
  value: string;
  label: string;
}

/**
 * A dropdown that matches the rest of the app: a field that shows the choice, and a list that floats over the page (it never pushes the
 * page down). Closes when you tap outside it or press Escape.
 */
export function Pick({ label, value, options, placeholder, disabled, onChange }: { label: string; value: string | null; options: PickOption[]; placeholder: string; disabled?: boolean; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const listId = useId();
  const chosen = options.find((o) => o.value === value) ?? null;

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("keydown", esc); };
  }, [open]);

  return (
    <div ref={box} style={{ position: "relative" }}>
      <button type="button" className="v-pk" aria-label={`${label}: ${chosen?.label ?? placeholder}`} aria-haspopup="listbox" aria-expanded={open} aria-controls={listId} disabled={disabled} onClick={() => setOpen((o) => !o)}>
        <span className={chosen ? "" : "v-ph"}>{chosen?.label ?? placeholder}</span>
        <span className="v-cr" aria-hidden="true">▾</span>
      </button>
      {open ? (
        <div id={listId} className="v-pkm" role="listbox" aria-label={label}>
          {options.map((o) => (
            <button key={o.value} type="button" role="option" aria-selected={o.value === value} className="v-pko" onClick={() => { setOpen(false); if (o.value !== value) onChange(o.value); }}>
              <span>{o.label}</span>
              {o.value === value ? <V13Icon name="check" /> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
