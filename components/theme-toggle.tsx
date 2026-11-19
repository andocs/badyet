"use client";

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
    <button type="button" className="btn ghost" onClick={flip} aria-label="Switch between dark and light theme">
      Theme
    </button>
  );
}
