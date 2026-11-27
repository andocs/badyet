"use client";

import type { IsoDate } from "@/lib/domain/dates";
import { lendEffect } from "@/lib/lending/forms";
import { dueChips } from "@/lib/lending/model";
import { NO_SOURCE, type SourceGroup } from "@/lib/lending/sources";
import { Pick } from "../pick";
import { DatePicker } from "../pickers";

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
    <div className="v-field">
      {label}
      <Pick label={label} value={value} onChange={onChange} options={[{ value: NO_SOURCE, label: "No budget line" }, ...ctx.sources.flatMap((g) => g.options.map((o) => ({ value: o.key, label: o.label, group: g.title })))]} />
    </div>
  );
}

/** Who, when you expect it back, and what it comes out of. */
/** `minDue` is the earliest expected date offered: today, or the day an older loan was made. */
export function LendFields({ ctx, draft, onChange, amount, askWho = true, minDue }: { ctx: LendContext; draft: LendDraft; onChange: (d: LendDraft) => void; amount: number | null; askWho?: boolean; minDue?: string }) {
  const set = (part: Partial<LendDraft>) => onChange({ ...draft, ...part });
  return (
    <div className="v-stack" style={{ gap: 10 }}>
      <div className={askWho ? "v-grid2" : undefined}>
        {askWho ? (
          <div className="v-stack" style={{ gap: 8 }}>
            <label className="v-field">
              Who are you lending to?
              <input value={draft.borrower} maxLength={80} autoComplete="off" placeholder="Name" onChange={(e) => set({ borrower: e.target.value })} />
            </label>
            {ctx.people.length > 0 ? (
              <div className="v-chips" role="group" aria-label="People you have lent to">
                {ctx.people.slice(0, 8).map((p) => <button key={p} type="button" className="v-btn v-sm" aria-pressed={draft.borrower === p} onClick={() => set({ borrower: p })}>{p}</button>)}
              </div>
            ) : null}
          </div>
        ) : null}
        <div className="v-field">Expected back on<DatePicker label="Expected back on" value={draft.dueOn} min={minDue ?? ctx.today} onChange={(dueOn) => set({ dueOn })} /></div>
      </div>
      <DateChips ctx={ctx} value={draft.dueOn} onPick={(dueOn) => set({ dueOn })} />
      <SourceSelect ctx={ctx} value={draft.fromKey} onChange={(fromKey) => set({ fromKey })} />
      <div className="v-testbox">
        <div className="v-lab">What changes</div>
        <div className="v-sm">{lendEffect(sourceNamed(ctx, draft.fromKey), amount, draft.borrower)}</div>
      </div>
    </div>
  );
}
