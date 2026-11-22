"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** How often the page quietly re-reads its data while the tab is in front. */
const EVERY_MS = 60_000;

/**
 * Keeps what is on screen current without a reload: the Inbox number and the pages' data are read on the server, so a capture that
 * arrives from the phone would otherwise not show until you navigate. Refreshes when you come back to the tab and once a minute while
 * it is open. Nothing you are typing is lost; only the data is re-read.
 */
export function AutoRefresh() {
  const router = useRouter();
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const timer = setInterval(refresh, EVERY_MS);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [router]);
  return null;
}
