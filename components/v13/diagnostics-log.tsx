"use client";

import { useState, useTransition } from "react";
import { clearDiagnostics } from "@/app/(v13)/settings/diagnostics/actions";
import { useToast } from "./feedback";

/** The phone's diagnostic log as plain text, with a button to copy it all and one to clear it. */
export function DiagnosticsLog({ text, count }: { text: string; count: number }) {
  const toast = useToast();
  const [busy, start] = useTransition();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast("Copied.");
    } catch {
      toast("Could not copy. Select the text and copy it by hand.", "bad");
    }
  };

  return (
    <section className="v-card v-stack" aria-labelledby="dl">
      <div className="v-row v-sp v-wrap">
        <h2 id="dl">{count} events</h2>
        <span className="v-row" style={{ gap: 8 }}>
          <button type="button" className="v-btn v-sm v-pri" disabled={count === 0} onClick={copy}>{copied ? "Copied" : "Copy all"}</button>
          <button type="button" className="v-btn v-sm" disabled={busy || count === 0} onClick={() => start(async () => { const r = await clearDiagnostics(); toast(r.error ?? "Cleared.", r.error ? "bad" : "ok"); })}>Clear</button>
        </span>
      </div>
      {count === 0 ? (
        <p className="v-muted v-sm" style={{ margin: 0 }}>Nothing yet. The phone sends its log once it has loaded something successfully, at most once a minute. After the app sticks and you force-stop and reopen it, the log from that time arrives here.</p>
      ) : (
        <textarea readOnly value={text} rows={24} aria-label="Diagnostic log" style={{ width: "100%", fontFamily: "ui-monospace, monospace", fontSize: 12, whiteSpace: "pre", overflow: "auto" }} />
      )}
    </section>
  );
}
