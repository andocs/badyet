"use client";

import { useOptimistic, useState, useTransition } from "react";
import { addCaptureRule, deleteCaptureRule, saveCaptureSource } from "@/app/(v13)/settings/actions";
import { ACTION_LABEL, RULE_ACTIONS, SOURCES, SOURCE_INFO, type CaptureRule, type RuleAction, type SourceConfig, type SourceKey } from "@/lib/capture/sources";
import { formatPesos, money } from "@/lib/domain/money";
import { useConfirm, useToast } from "./feedback";
import { useAct } from "./settings";

interface Option { id: string; name: string }

function SourceRow({ cfg, accounts, categories }: { cfg: SourceConfig; accounts: Option[]; categories: Option[] }) {
  const info = SOURCE_INFO[cfg.source];
  const [enabled, setEnabled] = useState(cfg.enabled);
  const [packages, setPackages] = useState(cfg.packages.join("\n"));
  const [senders, setSenders] = useState(cfg.senders.join("\n"));
  const [accountId, setAccountId] = useState(cfg.accountId ?? "");
  const [categoryId, setCategoryId] = useState(cfg.categoryId ?? "");
  const [autoConfirm, setAutoConfirm] = useState(cfg.autoConfirm);
  const [minAmount, setMinAmount] = useState(cfg.minAmount > 0 ? formatPesos(money(cfg.minAmount), { symbol: false }) : "");
  const s = useAct();
  const save = (over: { enabled?: boolean } = {}) =>
    s.act(
      () => saveCaptureSource({ source: cfg.source, enabled: over.enabled ?? enabled, packages, senders, accountId: accountId || null, categoryId: categoryId || null, autoConfirm, minAmount }),
      `${info.label} saved.`,
    );
  return (
    <details className="v-env v-capitem">
      <summary className="v-row v-sp">
        <span><b>{info.label}</b><span className="v-xs v-muted"> · {info.blurb}</span></span>
        <button
          type="button"
          className="v-sw"
          role="switch"
          aria-checked={enabled}
          aria-label={`Capture ${info.label}`}
          disabled={s.busy}
          onClick={(e) => { e.preventDefault(); const next = !enabled; setEnabled(next); save({ enabled: next }); }}
        />
      </summary>
      <div className="v-capbody">
        <label className="v-field">Apps on the phone (one per line)<textarea rows={2} value={packages} onChange={(e) => setPackages(e.target.value)} placeholder="com.example.app" /></label>
        <label className="v-field">Email senders (one per line)<textarea rows={2} value={senders} onChange={(e) => setSenders(e.target.value)} placeholder="name@bank.com" /></label>
        <div className="v-grid2">
          <label className="v-field">Usual account
            <select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              <option value="">Decide in the Inbox</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </label>
          <label className="v-field">Usual category
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">Decide in the Inbox</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
        </div>
        <label className="v-field">Ignore amounts below (₱)<input inputMode="decimal" value={minAmount} onChange={(e) => setMinAmount(e.target.value)} placeholder="0" /></label>
        <div className="v-row v-sp">
          <div><b>Confirm without asking</b><div className="v-xs v-muted">Only when the account is set, and a category for spending. Otherwise it waits in the Inbox.</div></div>
          <button type="button" className="v-sw" role="switch" aria-checked={autoConfirm} aria-label={`Confirm ${info.label} without asking`} onClick={() => setAutoConfirm((v) => !v)} />
        </div>
        <div className="v-row"><button type="button" className="v-btn v-sm v-pri" disabled={s.busy} onClick={() => save()}>Save {info.label}</button></div>
      </div>
    </details>
  );
}

export function CaptureCard({ sources, rules: rulesIn, accounts, categories, missing }: { sources: SourceConfig[]; rules: CaptureRule[]; accounts: Option[]; categories: Option[]; missing: boolean }) {
  const ask = useConfirm();
  const toast = useToast();
  const add = useAct();
  const [rules, drop] = useOptimistic(rulesIn, (cur, id: string) => cur.filter((x) => x.id !== id));
  const [, startDrop] = useTransition();
  const [source, setSource] = useState<"" | SourceKey>("");
  const [words, setWords] = useState("");
  const [action, setAction] = useState<RuleAction>("ignore");
  const [categoryId, setCategoryId] = useState("");
  const catName = new Map(categories.map((c) => [c.id, c.name]));

  if (missing) {
    return (
      <section className="v-card v-stack" aria-labelledby="cp">
        <h2 id="cp">Capture rules</h2>
        <p className="v-xs v-muted" style={{ margin: 0 }}>These need a database update first: apply supabase/migrations/20261207000000_capture_rules.sql (see docs/deploy.md), then reload.</p>
      </section>
    );
  }

  return (
    <section className="v-card v-stack" aria-labelledby="cp">
      <h2 id="cp">Capture rules</h2>
      <p className="v-xs v-muted" style={{ margin: 0 }}>How the phone turns bank, wallet and shop notifications and emails into pending items. The same settings show on the phone.</p>
      <div className="v-capsrc">{SOURCES.map((k) => <SourceRow key={k} cfg={sources.find((c) => c.source === k)!} accounts={accounts} categories={categories} />)}</div>

      <div className="v-stack">
        <h3 className="v-capsec">Keyword rules</h3>
        <div className="v-xs v-muted">When a notification or email contains these words, do this. Ignore rules win over the rest.</div>
        {rules.length === 0 ? <p className="v-muted v-sm" style={{ margin: 0 }}>No keyword rules yet.</p> : <div className="v-caprules">{rules.map((r) => (
          <div key={r.id} className="v-caprule">
            <span>
              <b>&quot;{r.matchText}&quot;</b> in {r.source ? SOURCE_INFO[r.source].label : "any source"} → {ACTION_LABEL[r.action].toLowerCase()}
              {r.action === "set_category" ? `: ${catName.get(r.categoryId ?? "") ?? "a category"}` : ""}
            </span>
            <button type="button" className="v-btn v-sm v-ghost" onClick={async () => {
              if (await ask({ title: "Delete this rule?", message: `Captures containing "${r.matchText}" will no longer be handled this way.`, confirmLabel: "Delete", danger: true })) {
                startDrop(async () => { drop(r.id); const res = await deleteCaptureRule(r.id); toast(res.error ?? "Rule deleted.", res.error ? "bad" : "ok"); });
              }
            }}>Delete</button>
          </div>
        ))}</div>}
      </div>

      <div className="v-cappanel">
        <h3 className="v-capsec">Add a rule</h3>
        <div className="v-grid2">
          <label className="v-field">Words to look for<input value={words} maxLength={80} onChange={(e) => setWords(e.target.value)} placeholder="cashback" /></label>
          <label className="v-field">In
            <select value={source} onChange={(e) => setSource(e.target.value as "" | SourceKey)}>
              <option value="">Any source</option>
              {SOURCES.map((k) => <option key={k} value={k}>{SOURCE_INFO[k].label}</option>)}
            </select>
          </label>
        </div>
        <div className="v-grid2">
          <label className="v-field">Then
            <select value={action} onChange={(e) => setAction(e.target.value as RuleAction)}>
              {RULE_ACTIONS.map((a) => <option key={a} value={a}>{ACTION_LABEL[a]}</option>)}
            </select>
          </label>
          {action === "set_category" ? (
            <label className="v-field">Category
              <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                <option value="">Pick one</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
          ) : <span />}
        </div>
        <div className="v-row">
          <button type="button" className="v-btn v-sm v-pri" disabled={add.busy} onClick={() => add.act(async () => {
            const r = await addCaptureRule({ source: source || null, matchText: words, action, categoryId: categoryId || null });
            if (!r.error) { setWords(""); setCategoryId(""); }
            return r;
          }, "Rule added.")}>Add rule</button>
        </div>
      </div>
    </section>
  );
}
