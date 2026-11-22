"use client";

import { useLinkStatus } from "next/link";

/** Put inside a Link: shimmers over it while the page behind the link is loading, so a tap answers at once. */
export function LinkPending() {
  const { pending } = useLinkStatus();
  return <span aria-hidden="true" className={`v-lpend${pending ? " v-on" : ""}`} />;
}
