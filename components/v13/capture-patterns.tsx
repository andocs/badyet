"use client";

import { useOptimistic, useState, useTransition } from "react";
import { addCapturePattern, deleteCapturePattern } from "@/app/(v13)/settings/actions";
import type { CapturePattern } from "@/lib/capture/patterns";
import { testPattern } from "@/lib/capture/parsers";
import { SOURCES, SOURCE_INFO, type SourceKey } from "@/lib/capture/sources";
import { money } from "@/lib/domain/money";
import { useConfirm, useToast } from "./feedback";
import { Money } from "./money";
import { useAct } from "./settings";

/** Your own notification patterns: wording with placeholders, tried on a sample message. The phone turns each into a regex. */
export function PatternsSection({ patterns: patternsIn }: { patterns: CapturePattern[] }) {
  const ask = useConfirm();
  const toast = useToast();
  const add = useAct();
  const [patterns, drop] = useOptimistic(patternsIn, (cur, id: string) => cur.filter((x) => x.id !== id));
  const [, startDrop] = useTransition();
  const [source, setSource] = useState<SourceKey>("custom");
  const [direction, setDirection] = useState<"in" | "out">("in");
  const [template, setTemplate] = useState("");
  const [sample, setSample] = useState("");

  const result = template.trim() !== "" && sample.trim() !== "" ? testPattern(template, direction, sample) : null;

  return (
    <div className="v-stack">
      <h3 className="v-capsec">Your own patterns</h3>
      <div className="v-xs v-muted">
        Teach the app a notification without waiting for an update. Write the wording with placeholders: <code>{"{amount}"}</code> the amount (required), <code>{"{name}"}</code> who it was with,
        {" "}<code>{"{last4}"}</code> the last digits of your account, <code>{"{ref}"}</code> a reference number, <code>{"{any}"}</code> anything to skip. Yours are tried before the built-in readers.
      </div>
      {patterns.length === 0 ? <p className="v-muted v-sm" style={{ margin: 0 }}>No patterns yet.</p> : (
        <div className="v-caprules">
          {patterns.map((p) => (
            <div key={p.id} className="v-caprule">
              <span><b>{p.template}</b> · {SOURCE_INFO[p.source].label} · money {p.direction === "in" ? "in" : "out"}</span>
              <button type="button" className="v-btn v-sm v-ghost" onClick={async () => {
                if (await ask({ title: "Delete this pattern?", message: `"${p.template}" will stop being read.`, confirmLabel: "Delete", danger: true })) {
                  startDrop(async () => { drop(p.id); const res = await deleteCapturePattern(p.id); toast(res.error ?? "Pattern deleted.", res.error ? "bad" : "ok"); });
                }
              }}>Delete</button>
            </div>
          ))}
        </div>
      )}

      <div className="v-cappanel">
        <h3 className="v-capsec">Add a pattern</h3>
        <div className="v-grid2">
          <label className="v-field">For
            <select value={source} onChange={(e) => setSource(e.target.value as SourceKey)}>
              {SOURCES.map((k) => <option key={k} value={k}>{SOURCE_INFO[k].label}</option>)}
            </select>
          </label>
          <label className="v-field">Money
            <select value={direction} onChange={(e) => setDirection(e.target.value as "in" | "out")}>
              <option value="in">Comes in</option>
              <option value="out">Goes out</option>
            </select>
          </label>
        </div>
        <label className="v-field">Wording<input value={template} maxLength={200} onChange={(e) => setTemplate(e.target.value)} placeholder="You received {amount} from {name}" /></label>
        <label className="v-field">Try it on a real message<textarea rows={2} value={sample} maxLength={400} onChange={(e) => setSample(e.target.value)} placeholder="Paste a notification here to see what the pattern reads" /></label>
        {result ? (
          <p className="v-sm" role="status" style={{ margin: 0 }}>
            {!result.ok ? <span className="v-bad">{result.error}</span> : result.parsed ? (
              <span>Reads <b><Money value={money(result.parsed.amount)} /></b> {result.parsed.direction === "in" ? "in" : "out"}
                {result.parsed.counterparty ? ` · with ${result.parsed.counterparty}` : ""}
                {result.parsed.accountHint ? ` · account …${result.parsed.accountHint}` : ""}
                {result.parsed.ref ? ` · ref ${result.parsed.ref}` : ""}</span>
            ) : <span className="v-bad">This pattern does not match that message.</span>}
          </p>
        ) : null}
        <div className="v-row">
          <button type="button" className="v-btn v-sm v-pri" disabled={add.busy} onClick={() => add.act(async () => {
            const r = await addCapturePattern({ source, template, direction });
            if (!r.error) { setTemplate(""); setSample(""); }
            return r;
          }, "Pattern added.")}>Save pattern</button>
        </div>
      </div>
    </div>
  );
}
