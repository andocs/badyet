"use client";

import { useState } from "react";
import { formatPesos, money } from "@/lib/domain/money";
import { BUILTIN_FORMATS, readSample, suggestPattern, type Channel, type SampleSetup } from "@/lib/capture/explain";
import { describeOther, describeSample, type ResultBox } from "@/lib/capture/result-view";
import type { CapturePattern } from "@/lib/capture/patterns";
import { SOURCE_INFO, type SourceConfig, type SourceKey } from "@/lib/capture/sources";
import { PatternsSection } from "./capture-patterns";
import { Money } from "./money";
import { Pick } from "./pick";

/** The numbered sections of the Rules editor. Rules and "Everything else" use the same five. */
export function Step({ n, title, aside, children }: { n: number; title: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="v-rsec">
      <div className="v-rsech"><span className="v-step" aria-hidden="true">{n}</span><h3>{title}</h3>{aside}</div>
      {children}
    </div>
  );
}

const labelOf = (configs: readonly SourceConfig[], source: SourceKey) => configs.find((c) => c.source === source)?.label ?? SOURCE_INFO[source].label;

function ReadPills({ source, label, text, patterns, channels }: { source: SourceKey; label: string; text: string; patterns: CapturePattern[]; channels?: readonly Channel[] }) {
  const read = readSample(source, text, patterns, channels);
  if (!read) return <span className="v-pill v-bad">{label} can&apos;t read this message</span>;
  const p = read.parsed;
  return (
    <div className="v-row v-wrap" style={{ gap: 8 }}>
      <span className="v-pill">Read by {read.by === "pattern" ? "your pattern" : `${label}'s built-in reader`}</span>
      <span className="v-pill v-ok">Amount <span className="amt">{formatPesos(money(p.amount))}</span></span>
      <span className="v-pill v-ok">Money {p.direction}</span>
      {p.counterparty ? <span className="v-pill v-ok">{p.direction === "out" ? "To" : "From"} {p.counterparty}</span> : null}
      {p.accountName ? <span className="v-pill v-ok">Account named: {p.accountName}</span> : null}
      {p.accountHint ? <span className="v-pill">Your account ··{p.accountHint}</span> : null}
      {p.ref ? <span className="v-pill">Ref {p.ref}</span> : null}
    </div>
  );
}

/** Step 2: the patterns and built-in reader of one source, and a sample to try. Shared by every rule of that source. */
export function Reading({ source, setSource, options, configs, patterns, channels, sample, setSample }: {
  source: SourceKey; setSource?: (s: SourceKey) => void; options?: SourceKey[]; configs: SourceConfig[]; patterns: CapturePattern[]; channels?: readonly Channel[]; sample: string; setSample: (s: string) => void;
}) {
  const label = labelOf(configs, source);
  const formats = BUILTIN_FORMATS[source] ?? {};
  const lists = (["notification", "email"] as const).flatMap((c) => (formats[c] ? [{ channel: c, list: formats[c]! }] : []));
  const [seed, setSeed] = useState<{ key: number; template: string; sample: string; direction: "in" | "out" } | null>(null);
  const [none, setNone] = useState(false);
  const unreadable = sample.trim() !== "" && !readSample(source, sample, patterns, channels);
  const make = () => {
    const template = suggestPattern(sample);
    setNone(template === null);
    if (template) setSeed((s) => ({ key: (s?.key ?? 0) + 1, template, sample: sample.trim(), direction: /receiv|credit/i.test(sample) ? "in" : "out" }));
  };
  return (
    <div className="v-shared">
      {options && setSource && options.length > 1 ? (
        <div className="v-field">Try reading as
          <Pick label="Try reading as" value={source} options={options.map((k) => ({ value: k, label: labelOf(configs, k) }))} onChange={(v) => setSource(v as SourceKey)} />
        </div>
      ) : null}
      <div className="v-sm">The amount and money in or out come from here, <b>not from a rule&apos;s words</b>. Changing this affects everything from {label}.</div>
      <PatternsSection key={`${source}-${seed?.key ?? 0}`} patterns={patterns} only={source} seed={seed ?? undefined} />
      {lists.length === 0 ? <div className="v-xs v-muted">{label} has no built-in reader: only your patterns can read it.</div> : null}
      {lists.map(({ channel, list }) => (
        <details key={channel} className="v-acc">
          <summary><span className="v-pill v-warn">Built-in</span><span><b>{label} {channel} reader</b><small>{list.length} message {list.length === 1 ? "type" : "types"} · tried after your patterns</small></span></summary>
          <div>
            {list.map((f) => (
              <div key={f.label} className="v-fmt">
                <div className="v-row v-sp" style={{ gap: 8 }}><span className="v-pill v-warn">{f.label}</span><button type="button" className="v-btn v-sm v-ghost" onClick={() => setSample(f.example)}>Try this</button></div>
                <div className="v-sm">{f.wording.split(/(\{[^}]+\})/).map((part, i) => (part.startsWith("{") ? <mark key={i}>{part}</mark> : <span key={i}>{part}</span>))}</div>
                <div className="v-xs v-muted">Reads: {f.reads}</div>
              </div>
            ))}
            <div className="v-xs v-muted">A plain summary of what the reader looks for. A message worded another way is not read: add a pattern for it. The built-in reader can&apos;t be edited; your pattern wins over it.</div>
          </div>
        </details>
      ))}
      <label className="v-field">Sample message<textarea rows={3} maxLength={1500} value={sample} onChange={(e) => setSample(e.target.value)} placeholder="Paste a notification or email here. It stays on this page." /></label>
      {sample.trim() === "" ? null : <ReadPills source={source} label={label} text={sample} patterns={patterns} channels={channels} />}
      {unreadable ? (
        <div className="v-stack" style={{ gap: 8 }}>
          <div className="v-sm">The app would ignore this message, whatever your rules say.</div>
          <button type="button" className="v-btn v-sm v-pri" style={{ alignSelf: "flex-start" }} onClick={make}>+ Make a pattern from this sample</button>
          {none ? <div className="v-xs v-muted">No amount in figures was found. Write the pattern yourself above.</div> : null}
        </div>
      ) : null}
    </div>
  );
}

function Box({ box }: { box: ResultBox }) {
  return (
    <div className="v-testbox" role="status">
      {box.lines.map((l) => (
        <div key={l.title} className="v-markline">
          <span className={`v-mark${l.state === "ok" ? "" : ` v-${l.state}`}`} aria-hidden="true">{l.state === "ok" ? "✓" : l.state === "bad" ? "✕" : "–"}</span>
          <div><span className="v-sr">{l.state === "ok" ? "Yes: " : "No: "}</span>{l.sub ? <><b>{l.title}</b><div className="v-xs v-muted">{l.sub}</div></> : <div className="v-sm">{l.title}</div>}</div>
        </div>
      ))}
      {box.heading ? <div className="v-lab">{box.heading}</div> : null}
      {box.entries.map((e, i) => (
        <div key={i} className="v-entry"><span>{e.name}<br /><small className="v-muted">{e.kind}</small></span><b className="v-num"><Money value={money(e.amount)} signed /></b></div>
      ))}
      {box.foot ? <div className="v-xs v-muted">{box.foot}</div> : null}
    </div>
  );
}

/** Step 5: what the sample would do, and (optionally) whether the other account's message belongs with it. */
export function Result({ setup, sample, configs, allPatterns, ruleId, ruleNames, categoryName }: {
  setup: SampleSetup; sample: string; configs: SourceConfig[]; allPatterns: CapturePattern[];
  /** The rule being edited, or null for "Everything else". */
  ruleId: string | null;
  ruleNames: Map<string, string>;
  categoryName: Map<string, string>;
}) {
  const [otherSource, setOtherSource] = useState<SourceKey>(setup.source);
  const [otherText, setOtherText] = useState("");
  if (sample.trim() === "") return <div className="v-testbox"><div className="v-xs v-muted">Paste a sample in step 2 to see what it would do.</div></div>;
  const { box, outcome } = describeSample(sample, setup, { source: labelOf(configs, setup.source), ruleId, rules: ruleNames, categories: categoryName });
  const otherConfig = configs.find((c) => c.source === otherSource);
  const otherBox = otherConfig ? describeOther(outcome, otherText, { ...setup, source: otherSource, config: otherConfig, patterns: allPatterns, channels: undefined, from: undefined }, otherConfig.label) : null;
  return (
    <div className="v-stack" style={{ gap: 10 }}>
      <Box box={box} />
      {outcome.kind === "kept" ? (
        <div className="v-shared">
          <div className="v-grid2">
            <div className="v-field">Other side from
              <Pick label="Other side from" value={otherSource} options={configs.map((c) => ({ value: c.source, label: `${c.label}${c.source === setup.source ? " (this source)" : ""}` }))} onChange={(v) => setOtherSource(v as SourceKey)} />
            </div>
            <div className="v-xs v-muted" style={{ alignSelf: "end", paddingBottom: 6 }}>Each message is read by its own source&apos;s patterns and reader.</div>
          </div>
          <label className="v-field">The other side&apos;s message (optional)<textarea rows={3} maxLength={1500} value={otherText} onChange={(e) => setOtherText(e.target.value)} placeholder="Paste what the other account sends, if it sends anything" /></label>
          {otherText.trim() === "" ? null : <ReadPills source={otherSource} label={labelOf(configs, otherSource)} text={otherText} patterns={allPatterns} />}
        </div>
      ) : null}
      {otherBox ? <Box box={otherBox} /> : null}
    </div>
  );
}
