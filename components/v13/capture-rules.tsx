"use client";

import { useState } from "react";
import { saveCaptureSource } from "@/app/(v13)/settings/actions";
import { SOURCE_INFO, SOURCES, type SourceConfig } from "@/lib/capture/sources";
import type { CapturePattern } from "@/lib/capture/patterns";
import { formatPesos, money } from "@/lib/domain/money";
import { PatternsSection } from "./capture-patterns";
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

/** Per-source settings (on or off, apps, senders, usual account and category, minimum amount) and your own notification wordings. Lives on the Rules page. */
export function SourcesArea({ sources, patterns, accounts, categories }: { sources: SourceConfig[]; patterns: CapturePattern[]; accounts: Option[]; categories: Option[] }) {
  return (
    <section className="v-card v-stack" aria-labelledby="srcs">
      <h2 id="srcs">Sources</h2>
      <p className="v-xs v-muted" style={{ margin: 0 }}>Turn a whole source off, or set a minimum amount to skip small items. The same settings show on the phone.</p>
      <div className="v-capsrc">{SOURCES.map((k) => <SourceRow key={k} cfg={sources.find((c) => c.source === k)!} accounts={accounts} categories={categories} />)}</div>
      <PatternsSection patterns={patterns} />
    </section>
  );
}
