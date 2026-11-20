"use client";

import { useRef, useState } from "react";
import { saveLineInline } from "@/app/(app)/budget/actions";
import { formatPesos, money } from "@/lib/domain/money";
import { ConfirmButton } from "./confirm-button";

interface Props {
  id: string;
  cutoff: string;
  plan: string | null; // set when a plan other than the active one is being edited
  name: string;
  amount: number; // centavos
  walletId: string | null;
  wallets: { id: string; name: string }[];
  deleteAction: (formData: FormData) => void | Promise<void>;
}

const text = (centavos: number) => formatPesos(money(centavos), { symbol: false });

// A budget line you read at a glance. Tap it to edit; changes save by themselves when you leave a field.
export function BudgetLine({ id, cutoff, plan, name, amount, walletId, wallets, deleteAction }: Props) {
  const [saved, setSaved] = useState({ name, amount, walletId });
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ name, amount: text(amount), walletId: walletId ?? "" });
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [message, setMessage] = useState("");
  const nameRef = useRef<HTMLInputElement>(null);
  const walletName = wallets.find((w) => w.id === saved.walletId)?.name;

  function open() {
    setDraft({ name: saved.name, amount: text(saved.amount), walletId: saved.walletId ?? "" });
    setStatus("idle");
    setEditing(true);
    setTimeout(() => nameRef.current?.focus(), 0);
  }

  async function save() {
    const changed = draft.name !== saved.name || draft.amount !== text(saved.amount) || draft.walletId !== (saved.walletId ?? "");
    if (!changed) return;
    setStatus("saving");
    const r = await saveLineInline(id, draft.name, draft.amount, draft.walletId);
    if (r.ok) {
      setSaved({ name: r.name, amount: r.amount, walletId: r.walletId });
      setDraft({ name: r.name, amount: text(r.amount), walletId: r.walletId ?? "" });
      setStatus("saved");
    } else {
      setStatus("error");
      setMessage(r.error);
    }
  }

  if (!editing) {
    return (
      <button type="button" className="line-view" onClick={open} aria-label={`Edit ${saved.name}`}>
        <span className="line-name">{saved.name}</span>
        {walletName && <span className="pill quiet">{walletName}</span>}
        <span className="num">{text(saved.amount)}</span>
      </button>
    );
  }

  return (
    <div className="line-edit" role="group" aria-label={`Editing ${saved.name}`} onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) void save(); }}
      onKeyDown={(e) => {
        if (e.key === "Enter" && (e.target as HTMLElement).tagName === "INPUT") {
          e.preventDefault();
          void save().then(() => setEditing(false));
        } else if (e.key === "Escape") {
          setStatus("idle");
          setEditing(false);
        }
      }}
    >
      <input ref={nameRef} className="input" value={draft.name} maxLength={60} aria-label={`Name of ${saved.name}`} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
      <input className="input num" value={draft.amount} inputMode="decimal" aria-label={`Amount for ${saved.name}`} onChange={(e) => setDraft({ ...draft, amount: e.target.value })} />
      <select className="input" value={draft.walletId} aria-label={`Wallet for ${saved.name}`} onChange={(e) => setDraft({ ...draft, walletId: e.target.value })}>
        <option value="">No wallet</option>
        {wallets.map((w) => (
          <option key={w.id} value={w.id}>{w.name}</option>
        ))}
      </select>
      <button type="button" className="btn sm ghost" onClick={() => void save().then(() => setEditing(false))}>Done</button>
      <form action={deleteAction}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="cutoff" value={cutoff} />
        {plan && <input type="hidden" name="plan" value={plan} />}
        <ConfirmButton message={`Delete ${saved.name}? This cannot be undone.`} className="btn sm danger" aria-label={`Delete ${saved.name}`}>Delete</ConfirmButton>
      </form>
      <span className={`line-status${status === "error" ? " err" : ""}`} role="status" aria-live="polite">
        {status === "saving" && "Saving…"}
        {status === "saved" && "Saved ✓"}
        {status === "error" && message}
      </span>
    </div>
  );
}
