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
import { Pick } from "./pick";

/** Your own notification patterns: wording with placeholders, tried on a sample message. The phone turns each into a regex. */
export function PatternsSection({ patterns: patternsIn, only, seed }: { patterns: CapturePattern[]; /** Show and add patterns for this source only (the source editor). */ only?: SourceKey; /** A first draft to fill the add form with (made from a sample). */ seed?: { template: string; sample: string; direction: "in" | "out" } }) {
  const ask = useConfirm();
  const toast = useToast();
  const add = useAct();
  const [patterns, drop] = useOptimistic(only ? patternsIn.filter((p) => p.source === only) : patternsIn, (cur, id: string) => cur.filter((x) => x.id !== id));
  const [, startDrop] = useTransition();
  const [picked, setSource] = useState<SourceKey>("custom");
  const source = only ?? picked;
  const [direction, setDirection] = useState<"in" | "out">(seed?.direction ?? "in");
  const [template, setTemplate] = useState(seed?.template ?? "");
  const [sample, setSample] = useState(seed?.sample ?? "");

  const result = template.trim() !== "" && sample.trim() !== "" ? testPattern(template, direction, sample) : null;

  return (
    <div className="v-stack">
      <h3 className="v-capsec">{only ? "My patterns · tried first" : "Your own patterns"}</h3>
      <div className="v-xs v-muted">
        Write the wording with placeholders: <code>{"{amount}"}</code> the amount (required), <code>{"{name}"}</code> who it was with,
        {" "}<code>{"{last4}"}</code> the last digits of your account, <code>{"{ref}"}</code> a reference number, <code>{"{any}"}</code> anything to skip. Yours are tried before the built-in readers, on notifications and on emails.
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

      {/* Folded until you want it; a draft made from a sample opens it. */}
      <details className="v-addpat" open={seed ? true : undefined}>
        <summary>+ Add a pattern</summary>
      <div className="v-cappanel">
        <div className="v-grid2">
          {only ? null : (
            <div className="v-field">For
              <Pick label="For" value={source} options={SOURCES.map((k) => ({ value: k, label: SOURCE_INFO[k].label }))} onChange={(v) => setSource(v as SourceKey)} />
            </div>
          )}
          <div className="v-field">Money
            <Pick label="Money" value={direction} options={[{ value: "in", label: "Comes in" }, { value: "out", label: "Goes out" }]} onChange={(v) => setDirection(v as "in" | "out")} />
          </div>
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
      </details>
    </div>
  );
}
