"use client";

import { useState } from "react";
import { formatPesos, money } from "@/lib/domain/money";
import { madeLegFor } from "@/lib/capture/claim";
import { BUILTIN_FORMATS, pairCheck, readSample, simulate, suggestPattern, type Channel, type SampleOutcome, type SampleSetup } from "@/lib/capture/explain";
import type { CapturePattern } from "@/lib/capture/patterns";
import type { AccountLite } from "@/lib/capture/row";
import { SOURCE_INFO, type CaptureRule, type SourceConfig, type SourceKey } from "@/lib/capture/sources";
import { PatternsSection } from "./capture-patterns";
import { Money } from "./money";

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
        <label className="v-field">Try reading as
          <select value={source} onChange={(e) => setSource(e.target.value as SourceKey)}>{options.map((k) => <option key={k} value={k}>{labelOf(configs, k)}</option>)}</select>
        </label>
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

const Mark = ({ state }: { state: "ok" | "bad" | "off" }) => <span className={`v-mark${state === "ok" ? "" : ` v-${state}`}`} aria-hidden="true">{state === "ok" ? "✓" : state === "bad" ? "✕" : "–"}</span>;
const Line = ({ state, title, sub }: { state: "ok" | "bad" | "off"; title: React.ReactNode; sub?: React.ReactNode }) => (
  <div className="v-markline"><Mark state={state} /><div>{sub ? <><b>{title}</b><div className="v-xs v-muted">{sub}</div></> : <div className="v-sm">{title}</div>}</div></div>
);

const KIND = { expense: "Spending", income: "Income", transfer: "Transfer" } as const;

function Entry({ name, kind, amount }: { name: string; kind: string; amount: number }) {
  return (
    <div className="v-entry"><span>{name}<br /><small className="v-muted">{kind}</small></span><b className="v-num"><Money value={money(amount)} signed /></b></div>
  );
}

const SKIPPED = { "source-off": "This source is switched off.", "under-minimum": "It is under the source's minimum.", "ignore-rule": "An ignore rule matches it." } as const;

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
  const label = labelOf(configs, setup.source);
  const accounts: readonly AccountLite[] = setup.accounts;
  const nameOf = (id: string | null) => (id ? (accounts.find((a) => a.id === id)?.name ?? "Account") : "You'll be asked which account");

  if (sample.trim() === "") return <div className="v-testbox"><div className="v-xs v-muted">Paste a sample in step 2 to see what it would do.</div></div>;
  const out: SampleOutcome = simulate(sample, setup);
  if (out.kind === "unreadable") {
    return <div className="v-testbox" role="status"><Line state="bad" title="Nothing is saved" sub={`${label} can't read the sample, so the rules are not checked. Nothing shows in the Inbox either. Add a pattern in step 2.`} /></div>;
  }
  if (out.kind === "skipped") {
    return <div className="v-testbox" role="status"><Line state="ok" title="It can be read" /><Line state="bad" title="Nothing is saved" sub={SKIPPED[out.reason]} /></div>;
  }

  const status = out.decision.status === "confirmed" && out.accountId ? "confirmed at once" : "waiting in the Inbox";
  const matched = out.decision.ruleId;
  const matchedName = matched ? ruleNames.get(matched) : undefined;
  const kindOf = (e: (typeof out.entries)[number]) => {
    if (e.kind !== "expense") return KIND[e.kind];
    if (out.decision.move) return "Payment · choose the other account in the Inbox";
    return `Spending · ${out.decision.categoryId ? (categoryName.get(out.decision.categoryId) ?? "category") : "choose a category"}`;
  };

  const other = otherText.trim() === "" ? null : (() => {
    const config = configs.find((c) => c.source === otherSource);
    return config ? simulate(otherText, { ...setup, source: otherSource, config, patterns: allPatterns, channels: undefined, from: undefined }) : null;
  })();
  const madeBoth = out.entries.length === 2;

  return (
    <div className="v-stack" style={{ gap: 10 }}>
      <div className="v-testbox" role="status">
        <Line state="ok" title="It can be read" />
        <Line state="ok" title={`${label} is on and it is not under the minimum`} />
        {ruleId ? (
          matched === ruleId ? <Line state="ok" title={`This rule matches${matchedName ? `: ${matchedName}` : ""}`} /> : <Line state="bad" title="This rule does not decide this sample" sub={matched ? `"${matchedName ?? "Another rule"}" matches first.` : "Its words or places do not match, so \"Everything else\" applies."} />
        ) : matched ? <Line state="ok" title={`A rule catches this one first: ${matchedName ?? "a rule"}`} /> : <Line state="ok" title="No rule matches, so these settings apply" />}
        <div className="v-lab">{out.entries.length === 2 ? "It saves two linked entries" : "It saves one entry"}, {status}</div>
        {out.entries.map((e, i) => <Entry key={i} name={nameOf(e.accountId)} kind={kindOf(e)} amount={e.amount} />)}
        {madeBoth ? <div className="v-xs v-muted">Not counted as spending or income. Confirming one confirms both.</div> : null}
      </div>

      <div className="v-shared">
        <div className="v-grid2">
          <label className="v-field">Other side from
            <select value={otherSource} onChange={(e) => setOtherSource(e.target.value as SourceKey)}>
              {configs.map((c) => <option key={c.source} value={c.source}>{c.label}{c.source === setup.source ? " (this source)" : ""}</option>)}
            </select>
          </label>
          <div className="v-xs v-muted" style={{ alignSelf: "end", paddingBottom: 6 }}>Each message is read by its own source&apos;s patterns and reader.</div>
        </div>
        <label className="v-field">The other side&apos;s message (optional)<textarea rows={3} maxLength={1500} value={otherText} onChange={(e) => setOtherText(e.target.value)} placeholder="Paste what the other account sends, if it sends anything" /></label>
        {otherText.trim() === "" ? null : <ReadPills source={otherSource} label={labelOf(configs, otherSource)} text={otherText} patterns={allPatterns} />}
      </div>

      {other === null ? null : other.kind !== "kept" ? (
        <div className="v-testbox" role="status">
          <Line state="bad" title={madeBoth ? "The second message changes nothing" : "These would not pair"} sub={other.kind === "unreadable" ? `${labelOf(configs, otherSource)} can't read it, so the app would ignore it. Is it the right source?` : SKIPPED[other.reason]} />
        </div>
      ) : madeBoth ? (() => {
        const first = out.entries[1]!;
        const again = madeLegFor(
          { accountId: other.accountId ?? "", amount: other.entries[0]!.amount, at: 0, counterparty: other.read.parsed.counterparty },
          [{ id: "made", accountId: first.accountId ?? "", amount: first.amount, at: 0, peerAccountId: out.accountId ?? "" }],
          accounts,
        );
        return (
          <div className="v-testbox" role="status">
            {again ? <Line state="ok" title="It would not be added again" sub="It is recognised as the entry the rule already made, if it arrives within an hour." /> : <Line state="bad" title="It would be added as another entry" sub="Its account, amount or the name in it does not match the entry the rule made. Check the amount in both messages." />}
          </div>
        );
      })() : (() => {
        const { pairs, checks } = pairCheck(out, other, accounts);
        return (
          <div className="v-testbox" role="status">
            <Line state={pairs ? "ok" : "bad"} title={pairs ? "These two would pair" : "Both can be read, but they would not pair"} sub={pairs ? "They must also arrive within an hour of each other. A sample can't check that." : undefined} />
            {checks.map((c) => <Line key={c.label} state={c.ok ? "ok" : "bad"} title={c.label} />)}
            <div className="v-lab">{pairs ? "One linked transfer, waiting in the Inbox" : "Two separate entries"}</div>
            {[out, other].map((o, i) => <Entry key={i} name={nameOf(o.accountId)} kind={pairs ? "Transfer" : o.entries[0]!.amount < 0 ? "Spending" : "Income"} amount={o.entries[0]!.amount} />)}
          </div>
        );
      })()}
    </div>
  );
}

/** A draft rule, placed where it would be tried, for the sample test. */
export function rulesWithDraft(saved: readonly CaptureRule[], draft: CaptureRule): CaptureRule[] {
  const at = saved.findIndex((r) => r.id === draft.id);
  if (at < 0) return [...saved, { ...draft, position: Math.max(0, ...saved.map((r) => r.position ?? 0)) + 1 }];
  return saved.map((r, i) => (i === at ? { ...draft, position: r.position } : r));
}
