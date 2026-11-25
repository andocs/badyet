"use client";

import { useState } from "react";
import { setGmailAlertCheck } from "@/app/(v13)/rules/actions";
import { useAct } from "./settings";

/** The Gmail check setting. Sources themselves are cards in the capture list ("Everything else from…") with their own editor. */
export function SourcesArea({ gmailAlert }: { gmailAlert: boolean }) {
  const [alertOn, setAlertOn] = useState(gmailAlert);
  const g = useAct();
  return (
    <section className="v-card v-stack" aria-labelledby="gm">
      <h2 id="gm">Gmail</h2>
      <div className="v-row v-sp">
        <div><b>Check Gmail when Gmail notifies</b><div className="v-xs v-muted">When the Gmail app on the phone shows a notification, it reads new bank emails right away instead of waiting for its next check. The notification itself is never read.</div></div>
        <button type="button" className="v-sw" role="switch" aria-checked={alertOn} aria-label="Check Gmail when Gmail notifies" disabled={g.busy} onClick={() => { const next = !alertOn; setAlertOn(next); g.act(() => setGmailAlertCheck(next), next ? "Gmail check on." : "Gmail check off."); }} />
      </div>
    </section>
  );
}
