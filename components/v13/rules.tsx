"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { moveRule, saveCaptureRuleFull, saveDedupeRule, setRuleEnabled } from "@/app/(v13)/rules/actions";
import { deleteCaptureRule } from "@/app/(v13)/settings/actions";
import { wordsHit } from "@/lib/capture/decide";
import type { CapturePattern } from "@/lib/capture/patterns";
import { RULE_CHANNELS, RULE_KINDS, SOURCE_INFO, SOURCES, type CaptureRule, type RuleChannel, type RuleKind, type SourceConfig, type SourceKey } from "@/lib/capture/sources";
import { addWord, ruleTitle, windowMinutes, windowParts } from "@/lib/rules/helpers";
import { SourcesArea } from "./capture-rules";
import { useConfirm, useToast } from "./feedback";

export interface DeviceApp { package: string; label: string | null; seen: "installed" | "notified" }
export interface SeenSender { address: string; emails: number }
interface Option { id: string; name: string }

const PACKAGE = /^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+$/i;
const SENDER = /^(@[^\s@]+\.[^\s@]+|[^\s@]+@[^\s@]+\.[^\s@]+)$/;
const CHANNEL_LABEL: Record<RuleChannel, string> = { notifications: "Notifications", emails: "Emails", both: "Notifications + Emails" };
const KIND_LABEL: Record<RuleKind, string> = { spending: "Spending", income: "Income", transfer: "Transfer", payment: "Payment" };
const PICKABLE = SOURCES.filter((k) => k !== "custom");

/** Runs a server action, toasts the result, and tells the caller when it worked. */
function useRun() {
  const toast = useToast();
  const [busy, start] = useTransition();
  const run = (fn: () => Promise<{ ok?: boolean; error?: string }>, ok: string, after?: () => void) =>
    start(async () => {
      const r = await fn();
      toast(r.error ?? ok, r.error ? "bad" : "ok");
      if (!r.error) after?.();
    });
  return { busy, run };
}

function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} className="v-xdlg" aria-label={title} onClose={onClose} onClick={(e) => { if (e.target === ref.current) onClose(); }}>
      <div className="v-qa">
        <div className="v-row v-sp"><h2>{title}</h2><button type="button" className="v-btn v-sm" onClick={onClose}>Close</button></div>
        {open ? children : null}
      </div>
    </dialog>
  );
}

function Seg<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: readonly { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="v-seg v-fit" role="group" aria-label={label}>
      {options.map((o) => <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>{o.label}</button>)}
    </div>
  );
}

function Switch({ on, label, onChange, disabled }: { on: boolean; label: string; onChange: (v: boolean) => void; disabled?: boolean }) {
  return <button type="button" className="v-sw" role="switch" aria-checked={on} aria-label={label} disabled={disabled} onClick={() => onChange(!on)} />;
}

/** A list of words as removable chips, with a box to add another. */
function WordChips({ label, hint, list, onChange, bad }: { label: string; hint?: string; list: string[]; onChange: (l: string[]) => void; bad?: boolean }) {
  const [text, setText] = useState("");
  const add = () => { onChange(addWord(list, text)); setText(""); };
  return (
    <div className="v-stack" style={{ gap: 6 }}>
      <div className="v-lab">{label}</div>
      {list.length > 0 ? (
        <div className="v-chips">{list.map((w) => <button key={w} type="button" className={`v-pill ${bad ? "v-bad" : "v-ok"}`} aria-label={`Remove ${w}`} onClick={() => onChange(list.filter((x) => x !== w))} style={{ border: 0, cursor: "pointer" }}>{w} ✕</button>)}</div>
      ) : hint ? <div className="v-xs v-muted">{hint}</div> : null}
      <div className="v-row">
        <input aria-label={`Add to: ${label}`} className="v-grow" style={{ flex: 1, minWidth: 0, minHeight: 40, borderRadius: 8, border: "1px solid var(--line)", background: "var(--soft)", color: "var(--ink)", padding: "0 12px", font: "inherit" }} value={text} maxLength={80} placeholder="Type a word, press Enter"
          onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
        <button type="button" className="v-btn v-sm" onClick={add}>+ Word</button>
      </div>
    </div>
  );
}

function AppPicker({ open, onClose, apps, lastSynced, picked, onChange }: { open: boolean; onClose: () => void; apps: DeviceApp[]; lastSynced: string | null; picked: string[]; onChange: (l: string[]) => void }) {
  const [tab, setTab] = useState<"phone" | "type">("phone");
  const [q, setQ] = useState("");
  const [typed, setTyped] = useState("");
  const [err, setErr] = useState("");
  // Same text on the server and in the browser, so no effect is needed to avoid a mismatch.
  const when = lastSynced ? `${lastSynced.slice(0, 16).replace("T", " ")} UTC` : "";
  const known = new Set(apps.map((a) => a.package.toLowerCase()));
  const rows: DeviceApp[] = [...picked.filter((p) => !known.has(p)).map((p) => ({ package: p, label: null, seen: "installed" as const })), ...apps];
  const needle = q.trim().toLowerCase();
  const shown = rows.filter((a) => needle === "" || a.package.toLowerCase().includes(needle) || (a.label ?? "").toLowerCase().includes(needle));
  const toggle = (p: string) => {
    const key = p.toLowerCase();
    if (picked.includes(key)) return onChange(picked.filter((x) => x !== key));
    if (picked.length >= 10) return setErr("Up to 10 apps per rule.");
    setErr("");
    onChange([...picked, key]);
  };
  const addTyped = () => {
    const p = typed.trim().toLowerCase();
    if (!PACKAGE.test(p)) return setErr("An app id looks like com.example.app.");
    setTyped("");
    if (!picked.includes(p)) toggle(p); else setErr("");
  };
  return (
    <Modal open={open} onClose={onClose} title="Pick apps">
      <div className="v-seg v-fit" role="group" aria-label="Where to find the app">
        <button type="button" aria-pressed={tab === "phone"} onClick={() => setTab("phone")}>From your phone</button>
        <button type="button" aria-pressed={tab === "type"} onClick={() => setTab("type")}>Type a package id</button>
      </div>
      {tab === "phone" ? (
        <>
          <label className="v-field">Search apps<input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name or package" /></label>
          <div className="v-xs v-muted">
            {lastSynced ? `These are the apps your phone has reported. The web cannot see your phone directly, so the list is saved to your account. Last synced ${when || "recently"}.` : "No apps yet. Open the phone app's Rules page so it can send its list here."}
          </div>
          <div>
            {shown.map((a) => (
              <label key={a.package} className="v-plist">
                <input type="checkbox" checked={picked.includes(a.package.toLowerCase())} onChange={() => toggle(a.package)} />
                <span style={{ flex: 1, minWidth: 0 }}><b>{a.label || a.package}</b><span className="v-xs v-muted" style={{ display: "block", overflowWrap: "anywhere" }}>{a.package}{a.seen === "notified" ? " · sent a notification lately" : ""}</span></span>
              </label>
            ))}
            {shown.length === 0 ? <p className="v-muted v-sm">Nothing matches.</p> : null}
          </div>
        </>
      ) : (
        <div className="v-stack">
          <label className="v-field">Package id<input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="com.example.app" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTyped(); } }} /></label>
          <div className="v-row"><button type="button" className="v-btn v-sm" onClick={addTyped}>Add</button></div>
        </div>
      )}
      {err ? <p className="v-sm v-bad" role="alert" style={{ margin: 0 }}>{err}</p> : null}
      <div className="v-row v-sp"><span className="v-xs v-muted">{picked.length} picked</span><button type="button" className="v-btn v-pri" onClick={onClose}>Done</button></div>
    </Modal>
  );
}

function SenderPicker({ open, onClose, seen, picked, onChange }: { open: boolean; onClose: () => void; seen: SeenSender[]; picked: string[]; onChange: (l: string[]) => void }) {
  const [q, setQ] = useState("");
  const [typed, setTyped] = useState("");
  const [err, setErr] = useState("");
  const known = new Set(seen.map((s) => s.address.toLowerCase()));
  const rows: SeenSender[] = [...picked.filter((p) => !known.has(p)).map((p) => ({ address: p, emails: 0 })), ...seen];
  const needle = q.trim().toLowerCase();
  const shown = rows.filter((s) => needle === "" || s.address.toLowerCase().includes(needle));
  const toggle = (a: string) => {
    const key = a.toLowerCase();
    if (picked.includes(key)) return onChange(picked.filter((x) => x !== key));
    if (picked.length >= 10) return setErr("Up to 10 senders per rule.");
    setErr("");
    onChange([...picked, key]);
  };
  const addTyped = () => {
    const s = typed.trim().toLowerCase();
    if (!SENDER.test(s)) return setErr("A sender looks like name@bank.com or @bank.com.");
    setTyped("");
    if (!picked.includes(s)) toggle(s); else setErr("");
  };
  return (
    <Modal open={open} onClose={onClose} title="Pick senders">
      <label className="v-field">Search senders<input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Address" /></label>
      <div className="v-lab">Recent senders in your Gmail</div>
      <div>
        {shown.map((s) => (
          <label key={s.address} className="v-plist">
            <input type="checkbox" checked={picked.includes(s.address.toLowerCase())} onChange={() => toggle(s.address)} />
            <span style={{ flex: 1, minWidth: 0 }}><b style={{ overflowWrap: "anywhere" }}>{s.address}</b>{s.emails > 0 ? <span className="v-xs v-muted" style={{ display: "block" }}>{s.emails} {s.emails === 1 ? "email" : "emails"}</span> : null}</span>
          </label>
        ))}
        {shown.length === 0 ? <p className="v-muted v-sm">{seen.length === 0 ? "No senders yet. They appear after the phone checks your Gmail." : "Nothing matches."}</p> : null}
      </div>
      <label className="v-field">Or type one<input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="name@bank.com or @bank.com" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTyped(); } }} /></label>
      <div className="v-row"><button type="button" className="v-btn v-sm" onClick={addTyped}>Add</button></div>
      <div className="v-xs v-muted">A whole domain such as @bpi.com.ph matches every address at it.</div>
      {err ? <p className="v-sm v-bad" role="alert" style={{ margin: 0 }}>{err}</p> : null}
      <div className="v-row v-sp"><span className="v-xs v-muted">{picked.length} picked</span><button type="button" className="v-btn v-pri" onClick={onClose}>Done</button></div>
    </Modal>
  );
}

interface Draft {
  name: string;
  enabled: boolean;
  channel: RuleChannel;
  words: string[];
  mustWords: string[];
  skipWords: string[];
  sources: string[];
  packages: string[];
  senders: string[];
  action: "ignore" | "record";
  kind: RuleKind;
  categoryId: string;
  fromId: string;
  toId: string;
  autoConfirm: boolean;
}

function draftOf(r: CaptureRule | null): Draft {
  if (!r) return { name: "", enabled: true, channel: "both", words: [], mustWords: [], skipWords: [], sources: [], packages: [], senders: [], action: "record", kind: "spending", categoryId: "", fromId: "", toId: "", autoConfirm: false };
  return {
    name: r.name ?? "",
    enabled: r.enabled !== false,
    channel: r.channel ?? "both",
    words: r.words && r.words.length > 0 ? r.words : r.matchText ? [r.matchText.toLowerCase()] : [],
    mustWords: r.mustWords ?? [],
    skipWords: r.skipWords ?? [],
    sources: [...new Set([...(r.sources ?? []), ...(r.source ? [r.source] : [])])],
    packages: r.packages ?? [],
    senders: r.senders ?? [],
    action: r.action === "ignore" ? "ignore" : "record",
    kind: r.kind ?? "spending",
    categoryId: r.categoryId ?? "",
    fromId: r.fromAccountId ?? "",
    toId: r.toAccountId ?? "",
    autoConfirm: r.autoConfirm === true || r.action === "auto_confirm",
  };
}

function Editor({ rule, accounts, categories, apps, lastSynced, seenSenders, onDone }: { rule: CaptureRule | null; accounts: Option[]; categories: Option[]; apps: DeviceApp[]; lastSynced: string | null; seenSenders: SeenSender[]; onDone: () => void }) {
  const [d, setD] = useState<Draft>(() => draftOf(rule));
  const [sample, setSample] = useState("");
  const [dlg, setDlg] = useState<"" | "apps" | "senders">("");
  const s = useRun();
  const ask = useConfirm();
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));
  const ignore = d.action === "ignore";
  const moves = !ignore && (d.kind === "transfer" || d.kind === "payment");
  const acct = new Map(accounts.map((a) => [a.id, a.name]));
  const cat = new Map(categories.map((c) => [c.id, c.name]));

  const save = () =>
    s.run(
      () => saveCaptureRuleFull(rule?.id ?? null, { name: d.name, enabled: d.enabled, channel: d.channel, words: d.words, mustWords: d.mustWords, skipWords: d.skipWords, sources: d.sources, packages: d.packages, senders: d.senders, action: d.action, kind: d.kind, categoryId: d.categoryId || null, fromAccountId: d.fromId || null, toAccountId: d.toId || null, autoConfirm: d.autoConfirm }),
      "Rule saved.",
      rule ? undefined : onDone,
    );

  const text = sample.trim().toLowerCase();
  const probe: CaptureRule = { id: "test", source: null, matchText: d.words[0] ?? "", action: "record", categoryId: null, words: d.words, mustWords: d.mustWords, skipWords: d.skipWords };
  const hit = text !== "" && d.words.length > 0 && wordsHit(probe, text);
  const outcome = ignore
    ? "It would be skipped."
    : `${KIND_LABEL[d.kind]}${d.kind === "spending" && d.categoryId ? ` · ${cat.get(d.categoryId) ?? "category"}` : ""}${moves ? ` · ${acct.get(d.fromId) ?? "ask in the Inbox"} → ${acct.get(d.toId) ?? "ask in the Inbox"}` : ""} · ${d.autoConfirm ? "confirmed automatically" : "waits in the Inbox"}`;

  return (
    <section className="v-card v-stack" aria-labelledby="edh" style={{ gap: 14 }}>
      <div className="v-row v-sp"><h2 id="edh">{rule ? "Edit rule" : "New rule"}</h2><span className="v-pill">{rule ? "Saved" : "Not saved yet"}</span></div>
      <label className="v-field">What is it for<input value={d.name} maxLength={60} onChange={(e) => set("name", e.target.value)} placeholder="Credit card payment" /></label>
      <div className="v-stack" style={{ gap: 6 }}>
        <div className="v-lab" id="lo">Listen on</div>
        <Seg label="Listen on" value={d.channel} options={RULE_CHANNELS.map((c) => ({ value: c, label: c === "both" ? "Both" : CHANNEL_LABEL[c] }))} onChange={(v) => set("channel", v)} />
      </div>
      <div className="v-stack" style={{ gap: 6 }}>
        <div className="v-lab">From</div>
        <div className="v-chips">
          {PICKABLE.map((k) => (
            <button key={k} type="button" className="v-pill" aria-pressed={d.sources.includes(k)} style={{ border: 0, cursor: "pointer", minHeight: 34, padding: "0 12px", ...(d.sources.includes(k) ? { background: "var(--accent)", color: "var(--on-accent)" } : {}) }} onClick={() => set("sources", d.sources.includes(k) ? d.sources.filter((x) => x !== k) : [...d.sources, k])}>{SOURCE_INFO[k as SourceKey].label}</button>
          ))}
          {d.packages.map((p) => <button key={p} type="button" className="v-pill v-ok" aria-label={`Remove app ${p}`} style={{ border: 0, cursor: "pointer", minHeight: 34 }} onClick={() => set("packages", d.packages.filter((x) => x !== p))}>{p} ✕</button>)}
          {d.senders.map((p) => <button key={p} type="button" className="v-pill v-ok" aria-label={`Remove sender ${p}`} style={{ border: 0, cursor: "pointer", minHeight: 34 }} onClick={() => set("senders", d.senders.filter((x) => x !== p))}>{p} ✕</button>)}
          <button type="button" className="v-btn v-sm" onClick={() => setDlg("apps")}>+ App</button>
          <button type="button" className="v-btn v-sm" onClick={() => setDlg("senders")}>+ Sender</button>
        </div>
        <div className="v-xs v-muted">Pick none to listen everywhere.</div>
      </div>
      <div className="v-grid2">
        <WordChips label="Look for any of these words" hint="Add at least one." list={d.words} onChange={(l) => set("words", l)} />
        <div className="v-stack">
          <WordChips label="Must also contain (optional)" list={d.mustWords} onChange={(l) => set("mustWords", l)} />
          <WordChips label="Skip it if it contains" list={d.skipWords} onChange={(l) => set("skipWords", l)} bad />
        </div>
      </div>
      <div className="v-row v-sp">
        <div><b>Ignore it</b><div className="v-xs v-muted">Drop what this rule matches instead of recording it. Ignore rules always win.</div></div>
        <Switch on={ignore} label="Ignore what this rule matches" onChange={(v) => set("action", v ? "ignore" : "record")} />
      </div>
      {!ignore ? (
        <>
          <div className="v-stack" style={{ gap: 6 }}>
            <div className="v-lab">What it is</div>
            <Seg label="What it is" value={d.kind} options={RULE_KINDS.map((k) => ({ value: k, label: KIND_LABEL[k] }))} onChange={(v) => set("kind", v)} />
          </div>
          {d.kind === "spending" ? (
            <label className="v-field">Category
              <select value={d.categoryId} onChange={(e) => set("categoryId", e.target.value)}>
                <option value="">Decide in the Inbox</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
          ) : null}
          {moves ? (
            <>
              <div className="v-grid2">
                <label className="v-field">Money leaves
                  <select value={d.fromId} onChange={(e) => set("fromId", e.target.value)}>
                    <option value="">Ask in the Inbox</option>
                    {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </label>
                <label className="v-field">Money arrives in
                  <select value={d.toId} onChange={(e) => set("toId", e.target.value)}>
                    <option value="">Ask in the Inbox</option>
                    {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </label>
              </div>
              <div className="v-xs v-muted">With both set, both sides are recorded. Leave one blank to ask in the Inbox.</div>
            </>
          ) : null}
          <div className="v-row v-sp">
            <div><b>Confirm automatically</b><div className="v-xs v-muted">Only when it is safe: an account is known, and a category for spending. Otherwise it waits in the Inbox.</div></div>
            <Switch on={d.autoConfirm} label="Confirm automatically" onChange={(v) => set("autoConfirm", v)} />
          </div>
        </>
      ) : null}
      <div className="v-testbox">
        <div className="v-lab">Test it</div>
        <label className="v-field">Sample message<textarea rows={2} maxLength={400} value={sample} onChange={(e) => setSample(e.target.value)} placeholder="Paste a notification or email here" /></label>
        {text === "" ? null : (
          <div className="v-row v-wrap" role="status">
            <span className={`v-pill ${hit ? "v-ok" : "v-bad"}`}>{hit ? "Matches" : "Does not match"}</span>
            <span className="v-xs v-muted">{d.words.length === 0 ? "Add a word to look for first." : hit ? outcome : "Nothing would happen."}</span>
          </div>
        )}
      </div>
      <div className="v-row v-sp v-wrap">
        {rule ? (
          <button type="button" className="v-btn v-sm" disabled={s.busy} style={{ color: "var(--red)" }} onClick={async () => {
            if (await ask({ title: "Delete this rule?", message: `"${ruleTitle(rule)}" will stop being applied.`, confirmLabel: "Delete", danger: true })) s.run(() => deleteCaptureRule(rule.id), "Rule deleted.", onDone);
          }}>Delete rule</button>
        ) : <span />}
        <div className="v-row">
          <button type="button" className="v-btn v-sm" onClick={onDone}>Cancel</button>
          <button type="button" className="v-btn v-sm v-pri" disabled={s.busy} onClick={save}>Save</button>
        </div>
      </div>
      <AppPicker open={dlg === "apps"} onClose={() => setDlg("")} apps={apps} lastSynced={lastSynced} picked={d.packages} onChange={(l) => set("packages", l)} />
      <SenderPicker open={dlg === "senders"} onClose={() => setDlg("")} seen={seenSenders} picked={d.senders} onChange={(l) => set("senders", l)} />
    </section>
  );
}

function summary(r: CaptureRule): string {
  const places = [...new Set([...(r.sources ?? []), ...(r.source ? [r.source] : [])])].map((k) => SOURCE_INFO[k].label);
  const np = r.packages?.length ?? 0;
  const ns = r.senders?.length ?? 0;
  if (np) places.push(`${np} ${np === 1 ? "app" : "apps"}`);
  if (ns) places.push(`${ns} ${ns === 1 ? "sender" : "senders"}`);
  return places.length ? places.join(" · ") : "All sources";
}

function RuleCard({ rule, selected, first, last, enabled, busy, acct, cat, onSelect, onToggle, onMove }: { rule: CaptureRule; selected: boolean; first: boolean; last: boolean; enabled: boolean; busy: boolean; acct: Map<string, string>; cat: Map<string, string>; onSelect: () => void; onToggle: (v: boolean) => void; onMove: (d: "up" | "down") => void }) {
  const words = rule.words && rule.words.length > 0 ? rule.words : [rule.matchText];
  const ignore = rule.action === "ignore";
  const kind = rule.kind ?? "spending";
  const what = ignore
    ? "Skips matching items."
    : `${KIND_LABEL[kind]}${kind === "spending" && rule.categoryId ? `, category ${cat.get(rule.categoryId) ?? "a category"}` : ""}${(kind === "transfer" || kind === "payment") && rule.fromAccountId && rule.toAccountId ? `, ${acct.get(rule.fromAccountId) ?? "?"} to ${acct.get(rule.toAccountId) ?? "?"}` : ""}. ${rule.autoConfirm || rule.action === "auto_confirm" ? "Confirms automatically." : "Asks me to confirm."}`;
  return (
    <div className={`v-rule${enabled ? "" : " v-off"}`} aria-current={selected} onClick={onSelect}>
      <div className="v-row v-sp">
        <button type="button" className="v-btn v-sm" style={{ background: "none", padding: 0, fontWeight: 800, textAlign: "left", flex: 1, justifyContent: "flex-start", minWidth: 0 }} aria-label={`Edit ${ruleTitle(rule)}`} onClick={(e) => { e.stopPropagation(); onSelect(); }}>{ruleTitle(rule)}</button>
        <button type="button" className="v-btn v-sm" aria-label={`Move ${ruleTitle(rule)} up`} disabled={first || busy} onClick={(e) => { e.stopPropagation(); onMove("up"); }}>↑</button>
        <button type="button" className="v-btn v-sm" aria-label={`Move ${ruleTitle(rule)} down`} disabled={last || busy} onClick={(e) => { e.stopPropagation(); onMove("down"); }}>↓</button>
        <span onClick={(e) => e.stopPropagation()}><Switch on={enabled} label={`${ruleTitle(rule)} on or off`} disabled={busy} onChange={onToggle} /></span>
      </div>
      <div className="v-row v-wrap"><span className="v-pill v-ok">{CHANNEL_LABEL[rule.channel ?? "both"]}</span><span className="v-xs v-muted">{summary(rule)}</span></div>
      <div className="v-chips">
        {ignore ? <span className="v-pill v-bad">ignore</span> : null}
        {words.slice(0, 3).map((w) => <span key={w} className="v-pill">{w}</span>)}
        {words.length > 3 ? <span className="v-pill">+{words.length - 3}</span> : null}
      </div>
      <div className="v-xs v-muted">{enabled ? what : `Paused. ${what}`}</div>
    </div>
  );
}

function CaptureTab({ rules, sources, patterns, accounts, categories, apps, lastSynced, seenSenders, captureMissing }: Pick<Props, "rules" | "sources" | "patterns" | "accounts" | "categories" | "apps" | "lastSynced" | "seenSenders" | "captureMissing">) {
  const [sel, setSel] = useState<string | "new" | null>(rules[0]?.id ?? null);
  const [over, setOver] = useState<Record<string, boolean>>({});
  const s = useRun();
  const toast = useToast();
  const acct = new Map(accounts.map((a) => [a.id, a.name]));
  const cat = new Map(categories.map((c) => [c.id, c.name]));
  const chosen = sel && sel !== "new" ? rules.find((r) => r.id === sel) ?? null : null;
  const editing = sel === "new" || chosen !== null;

  if (captureMissing) {
    return (
      <section className="v-card v-stack" aria-labelledby="cp">
        <h2 id="cp">Capture rules</h2>
        <p className="v-xs v-muted" style={{ margin: 0 }}>These need a database update first: apply supabase/migrations/20261207000000_capture_rules.sql (see docs/deploy.md), then reload.</p>
      </section>
    );
  }

  return (
    <div className="v-rsplit">
      <div className="v-stack">
        <section className="v-card v-stack" aria-labelledby="rl">
          <div className="v-row v-sp"><h2 id="rl">Capture rules</h2><button type="button" className="v-btn v-sm v-pri" onClick={() => setSel("new")}>+ New rule</button></div>
          <div className="v-xs v-muted">Run top to bottom. The first match decides. Ignore rules always win.</div>
          {rules.length === 0 ? <p className="v-muted v-sm" style={{ margin: 0 }}>No rules yet.</p> : null}
          {rules.map((r, i) => (
            <RuleCard key={r.id} rule={r} selected={sel === r.id} first={i === 0} last={i === rules.length - 1} enabled={over[r.id] ?? r.enabled !== false} busy={s.busy} acct={acct} cat={cat}
              onSelect={() => setSel(r.id)}
              onToggle={(v) => {
                setOver((o) => ({ ...o, [r.id]: v }));
                s.run(async () => {
                  const res = await setRuleEnabled(r.id, v);
                  if (res.error) setOver((o) => ({ ...o, [r.id]: !v }));
                  return res;
                }, v ? "Rule on." : "Rule off.");
              }}
              onMove={(dir) => s.run(() => moveRule(r.id, dir), "Order saved.")} />
          ))}
        </section>
        <SourcesArea sources={sources} patterns={patterns} accounts={accounts} categories={categories} />
      </div>
      {editing ? (
        <Editor key={sel} rule={chosen} accounts={accounts} categories={categories} apps={apps} lastSynced={lastSynced} seenSenders={seenSenders} onDone={() => setSel(null)} />
      ) : (
        <section className="v-card v-stack">
          <p className="v-muted v-sm" style={{ margin: 0 }}>Pick a rule to edit it, or <button type="button" className="v-btn v-sm" onClick={() => { toast("Fill in the form, then Save.", "ok"); setSel("new"); }}>start a new one</button>.</p>
        </section>
      )}
    </div>
  );
}

function DuplicateTab({ dedupe }: { dedupe: { windowMinutes: number; matchSource: boolean } }) {
  const init = windowParts(dedupe.windowMinutes);
  const [amount, setAmount] = useState(String(init.amount));
  const [unit, setUnit] = useState<"min" | "hours">(init.unit);
  const [matchSource, setMatchSource] = useState(dedupe.matchSource);
  const s = useRun();
  const n = Number(amount);
  const minutes = amount.trim() !== "" && Number.isFinite(n) ? windowMinutes(n, unit) : NaN;
  return (
    <section className="v-card v-stack" aria-labelledby="dup" style={{ maxWidth: 640, gap: 14 }}>
      <h2 id="dup">Duplicate rule</h2>
      <p className="v-xs v-muted" style={{ margin: 0 }}>When the same money movement shows up twice, such as a Maya alert and a BPI email, this decides if it becomes one item. It looks for the same amount and direction. Without a saved rule it uses 30 minutes, across any source.</p>
      <div className="v-grid2">
        <div className="v-stack" style={{ gap: 6 }}>
          <div className="v-lab">Within</div>
          <div className="v-row">
            <label className="v-field" style={{ width: 110 }}><span className="v-lab">Amount of time</span><input type="number" inputMode="numeric" min={1} max={unit === "hours" ? 4 : 240} step={1} value={amount} onChange={(e) => setAmount(e.target.value)} /></label>
            <Seg label="Time unit" value={unit} options={[{ value: "min", label: "min" }, { value: "hours", label: "hours" }]} onChange={setUnit} />
          </div>
          <div className="v-xs v-muted">From 1 minute to 4 hours.</div>
        </div>
        <div className="v-stack" style={{ gap: 6 }}>
          <div className="v-lab">Between</div>
          <Seg label="Between" value={matchSource ? "same" : "any"} options={[{ value: "same", label: "Same source" }, { value: "any", label: "Any sources" }]} onChange={(v) => setMatchSource(v === "same")} />
          <div className="v-xs v-muted">{matchSource ? "Only when both come from the same bank or wallet." : "Whichever app or email reported it."}</div>
        </div>
      </div>
      <div className="v-row"><button type="button" className="v-btn v-sm v-pri" disabled={s.busy} onClick={() => s.run(() => saveDedupeRule({ windowMinutes: minutes, matchSource }), "Duplicate rule saved.")}>Save</button></div>
    </section>
  );
}

interface Props {
  rules: CaptureRule[];
  sources: SourceConfig[];
  patterns: CapturePattern[];
  accounts: Option[];
  categories: Option[];
  apps: DeviceApp[];
  lastSynced: string | null;
  seenSenders: SeenSender[];
  dedupe: { windowMinutes: number; matchSource: boolean };
  captureMissing: boolean;
  needsUpdate: boolean;
}

export function RulesView(p: Props) {
  const [tab, setTab] = useState<"capture" | "dup">("capture");
  return (
    <div className="v-stack" style={{ maxWidth: 1100 }}>
      <div><h1>Rules</h1><div className="v-lab" style={{ textTransform: "none", letterSpacing: 0, fontSize: 13, fontWeight: 500 }}>What the app listens for, and what it does with it.</div></div>
      {p.needsUpdate ? <p className="v-card v-sm" role="status" style={{ margin: 0 }}>Apply the Rules database update first (supabase/migrations/20261216000000_rules_page.sql). Until then you can see your old rules but not change them.</p> : null}
      <div className="v-seg v-fit" role="group" aria-label="Rule types">
        <button type="button" aria-pressed={tab === "capture"} onClick={() => setTab("capture")}>Capture rules</button>
        <button type="button" aria-pressed={tab === "dup"} onClick={() => setTab("dup")}>Duplicate rules</button>
      </div>
      {tab === "capture" ? <CaptureTab {...p} /> : <DuplicateTab dedupe={p.dedupe} />}
    </div>
  );
}
