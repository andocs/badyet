"use client";

import { Icon } from "./icons";

export function ThemeToggle() {
  function flip() {
    const root = document.documentElement;
    const next = root.dataset.theme === "light" ? "dark" : "light";
    root.dataset.theme = next;
    try {
      localStorage.setItem("theme", next);
    } catch {
      // storage can be blocked; the theme still applies for this visit
    }
  }
  return (
    <button type="button" className="tool" onClick={flip} aria-label="Switch between dark and light theme">
      <Icon name="theme" />
      Theme
    </button>
  );
}
