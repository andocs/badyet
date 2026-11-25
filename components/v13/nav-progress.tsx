"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * A thin bar across the top while a page or tab you picked is still loading, so a slow selection visibly responds at once. It starts
 * when you click a link to another address in this app and stops by itself when the address changes (or after a safety timeout).
 */
export function NavProgress() {
  const search = useSearchParams().toString();
  const here = `${usePathname()}?${search}`;
  // The address you were on when you clicked. While it is still the current address, the next page has not arrived.
  const [from, setFrom] = useState<string | null>(null);
  const busy = from !== null && from === here;

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      setFrom(`${window.location.pathname}?${window.location.search.replace(/^\?/, "")}`);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  // Never leave the bar up if the navigation was cancelled or failed.
  useEffect(() => {
    if (!busy) return;
    const t = window.setTimeout(() => setFrom(null), 15_000);
    return () => window.clearTimeout(t);
  }, [busy]);

  return busy ? <div className="v-navbar" role="progressbar" aria-label="Loading" /> : null;
}
