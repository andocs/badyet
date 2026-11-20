"use client";

import { useEffect } from "react";
import { autoSyncCommitments } from "@/app/(app)/installments/actions";

// Once a day per browser tab session, quietly brings the Installments and Subscriptions budget lines up to this month.
export function AutoSync() {
  useEffect(() => {
    const key = `commitments-synced-${new Date().toISOString().slice(0, 10)}`;
    try {
      if (sessionStorage.getItem(key)) return;
    } catch {
      // storage blocked: just sync once for this visit
    }
    // A background tidy-up must never throw into the page: if the request fails it just tries again next visit.
    autoSyncCommitments()
      .then((ok) => {
        if (!ok) return;
        try {
          sessionStorage.setItem(key, "1");
        } catch {
          // fine
        }
      })
      .catch(() => {});
  }, []);
  return null;
}
