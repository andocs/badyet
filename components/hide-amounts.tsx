"use client";

import { useSyncExternalStore } from "react";
import { Icon } from "./icons";

const EVENT = "hide-amounts-change";
const subscribe = (notify: () => void) => {
  window.addEventListener(EVENT, notify);
  return () => window.removeEventListener(EVENT, notify);
};
const read = () => document.documentElement.dataset.hide === "1";

// Blurs every money figure so you can look at the app with people around. The choice is remembered on this device.
export function HideAmounts({ className = "btn ghost", withIcon = false, iconOnly = false }: { className?: string; withIcon?: boolean; iconOnly?: boolean }) {
  const hidden = useSyncExternalStore(subscribe, read, () => false);
  function flip() {
    const next = !hidden;
    if (next) document.documentElement.dataset.hide = "1";
    else delete document.documentElement.dataset.hide;
    try {
      localStorage.setItem("hide", next ? "1" : "0");
    } catch {
      // storage can be blocked; it still applies for this visit
    }
    window.dispatchEvent(new Event(EVENT));
  }
  return (
    <button type="button" className={className} onClick={flip} aria-pressed={hidden} aria-label={iconOnly ? (hidden ? "Show amounts" : "Hide amounts") : undefined} title={iconOnly ? (hidden ? "Show amounts" : "Hide amounts") : undefined}>
      {(withIcon || iconOnly) && <Icon name={hidden ? "eyeOff" : "eye"} />}
      {!iconOnly && (hidden ? "Show amounts" : "Hide amounts")}
    </button>
  );
}
