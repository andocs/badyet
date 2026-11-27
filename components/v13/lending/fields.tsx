"use client";

import type { IsoDate } from "@/lib/domain/dates";
import { lendEffect } from "@/lib/lending/forms";
import { dueChips } from "@/lib/lending/model";
import { NO_SOURCE, type SourceGroup } from "@/lib/lending/sources";

export interface LendDraft {
  borrower: string;
  dueOn: string;
  /** A source key; see lib/lending/sources. */
  fromKey: string;
}

/** What the lending forms need to offer. */
export interface LendContext {
  sources: SourceGroup[];
  people: string[];
  today: IsoDate;
  paydays: { first: number; second: number };
}

export const newDraft = (ctx: LendContext): LendDraft => ({ borrower: "", dueOn: dueChips(ctx.today, ctx.paydays)[0]!.date, fromKey: ctx.sources[0]?.options[0]?.key ?? NO_SOURCE });

export const sourceNamed = (ctx: LendContext, key: string): { kind: string; name: string | null } => {
  const found = ctx.sources.flatMap((g) => g.options).find((o) => o.key === key);
  return { kind: key.split(":")[0]!, name: found?.name ?? null };
};

export function DateChips({ ctx, value, onPick, weeks = 2 }: { ctx: Pick<LendContext, "today" | "paydays">; value: string; onPick: (d: string) => void; weeks?: 1 | 2 }) {
  return (
    <div className="v-chips" role="group" aria-label="Quick dates">
      {dueChips(ctx.today, ctx.paydays, weeks).map((c) => (
        <button key={c.label} type="button" className="v-btn v-sm" aria-pressed={value === c.date} onClick={() => onPick(c.date)}>{c.label}</button>
      ))}
    </div>
  );
}

export function SourceSelect({ ctx, value, onChange, label = "Take it from" }: { ctx: LendContext; value: string; onChange: (key: string) => void; label?: string }) {
  return (
    <label className="v-field">
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value={NO_SOURCE}>No budget line</option>
        {ctx.sources.map((g) => (
          <optgroup key={g.title} label={g.title}>
            {g.options.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
          </optgroup>
        ))}
      </select>
    </label>
  );
}

/** Who, when you expect it back, and what it comes out of. */
export function LendFields({ ctx, draft, onChange, amount, askWho = true }: { ctx: LendContext; draft: LendDraft; onChange: (d: LendDraft) => void; amount: number | null; askWho?: boolean }) {
  const set = (part: Partial<LendDraft>) => onChange({ ...draft, ...part });
  return (
    <div className="v-stack" style={{ gap: 10 }}>
      <div className={askWho ? "v-grid2" : undefined}>
        {askWho ? (
          <label className="v-field">
            Who are you lending to?
            <input value={draft.borrower} maxLength={80} list="lend-people" placeholder="Name" onChange={(e) => set({ borrower: e.target.value })} />
          </label>
        ) : null}
        <label className="v-field">Expected back on<input type="date" value={draft.dueOn} onChange={(e) => set({ dueOn: e.target.value })} /></label>
      </div>
      <datalist id="lend-people">{ctx.people.map((p) => <option key={p} value={p} />)}</datalist>
      <DateChips ctx={ctx} value={draft.dueOn} onPick={(dueOn) => set({ dueOn })} />
      <SourceSelect ctx={ctx} value={draft.fromKey} onChange={(fromKey) => set({ fromKey })} />
      <div className="v-testbox">
        <div className="v-lab">What changes</div>
        <div className="v-sm">{lendEffect(sourceNamed(ctx, draft.fromKey), amount, draft.borrower)}</div>
      </div>
    </div>
  );
}
