"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { V13Icon } from "./icons";
import { Popover } from "./popover";

export interface PickOption {
  value: string;
  label: string;
  /** A heading the option sits under. Options of one group must be next to each other. */
  group?: string;
}

/**
 * The app's dropdown (use it instead of <select>): a field that shows the choice, and a list that floats over the page in the browser's
 * top layer, so it never pushes the page down and a dialog never clips it. Closes when you tap outside it or press Escape.
 * Put it inside a `<div className="v-field">`, not a <label>. With `name` it is sent with a form.
 */
export function Pick({ label, value, options, placeholder = "Pick one", disabled, name, onChange }: { label: string; value: string | null; options: PickOption[]; placeholder?: string; disabled?: boolean; name?: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const listId = useId();
  const chosen = options.find((o) => o.value === value) ?? null;
  const close = useCallback(() => setOpen(false), []);

  // Opening starts on the current choice, and the arrow keys move through the list.
  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => (list.current?.querySelector<HTMLButtonElement>('[aria-selected="true"]') ?? list.current?.querySelector("button"))?.focus({ preventScroll: false }));
    return () => cancelAnimationFrame(frame);
  }, [open]);
  const move = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const items = [...(list.current?.querySelectorAll<HTMLButtonElement>("button") ?? [])];
    const at = items.indexOf(document.activeElement as HTMLButtonElement);
    items[Math.min(items.length - 1, Math.max(0, at + (e.key === "ArrowDown" ? 1 : -1)))]?.focus();
  };

  return (
    <>
      {name ? <input type="hidden" name={name} value={value ?? ""} /> : null}
      <button ref={btn} type="button" className="v-pk" aria-label={`${label}: ${chosen?.label ?? placeholder}`} aria-haspopup="listbox" aria-expanded={open} aria-controls={listId} disabled={disabled} onClick={() => setOpen((o) => !o)}>
        <span className={chosen ? "" : "v-ph"}>{chosen?.label ?? placeholder}</span>
        <span className="v-cr" aria-hidden="true">▾</span>
      </button>
      <Popover anchor={btn} open={open} onClose={close} label={label} variant="list">
        <div ref={list} id={listId} className="v-pkm" role="listbox" aria-label={label} onKeyDown={move}>
          {options.map((o, i) => (
            <div key={o.value} role="presentation" style={{ display: "contents" }}>
              {o.group && o.group !== options[i - 1]?.group ? <div className="v-pkg" role="presentation">{o.group}</div> : null}
              <button type="button" role="option" aria-selected={o.value === value} className="v-pko" onClick={() => { setOpen(false); if (o.value !== value) onChange(o.value); }}>
                <span>{o.label}</span>
                {o.value === value ? <V13Icon name="check" /> : null}
              </button>
            </div>
          ))}
        </div>
      </Popover>
    </>
  );
}

/** A Pick that keeps its own choice, for forms that are sent by name (including forms rendered on the server). */
export function FormPick({ label, name, options, defaultValue = "", placeholder }: { label: string; name: string; options: PickOption[]; defaultValue?: string; placeholder?: string }) {
  const [value, setValue] = useState(defaultValue);
  return <Pick label={label} name={name} value={value} options={options} placeholder={placeholder} onChange={setValue} />;
}
