"use client";

import { createContext, useActionState, useCallback, useContext, useEffect, useRef, useState } from "react";
import { addExpense, type AddExpenseState } from "@/app/(v13)/actions";
import { V13Icon } from "./icons";
import { FormPick } from "./pick";

export interface QuickAddAccount {
  id: string;
  name: string;
}
export interface QuickAddCategory {
  id: string;
  name: string;
}

const Ctx = createContext<() => void>(() => {});

/** Holds the quick-add sheet for the whole shell. Press N anywhere (outside a text field) to open it. */
export function QuickAddProvider({ accounts, categories, children }: { accounts: QuickAddAccount[]; categories: QuickAddCategory[]; children: React.ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [round, setRound] = useState(0);
  const open = useCallback(() => {
    setRound((r) => r + 1); // a fresh form each time
    dialog.current?.showModal();
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key.toLowerCase() !== "n" || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      e.preventDefault();
      open();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <Ctx.Provider value={open}>
      {children}
      <dialog ref={dialog} className="v-dlg" aria-labelledby="qa-title" onClick={(e) => e.target === dialog.current && dialog.current?.close()}>
        <QuickAddForm key={round} accounts={accounts} categories={categories} onDone={() => dialog.current?.close()} onCancel={() => dialog.current?.close()} />
      </dialog>
    </Ctx.Provider>
  );
}

function QuickAddForm({ accounts, categories, onDone, onCancel }: { accounts: QuickAddAccount[]; categories: QuickAddCategory[]; onDone: () => void; onCancel: () => void }) {
  const [state, action, pending] = useActionState<AddExpenseState, FormData>(addExpense, {});
  useEffect(() => {
    if (state.ok) onDone();
  }, [state, onDone]);
  return (
    <form action={action} className="v-qa">
      <div className="v-grab" aria-hidden="true" />
      <div className="v-row v-sp">
        <h2 id="qa-title">Quick add</h2>
        <button type="button" className="v-iconbtn v-s" onClick={onCancel} aria-label="Close">
          <V13Icon name="x" />
        </button>
      </div>
      {accounts.length === 0 ? (
        <p className="v-muted">Add an account first, then you can record spending against it.</p>
      ) : (
        <div className="v-frm">
          <label className="v-field">
            Amount (₱)
            <input name="amount" inputMode="decimal" autoComplete="off" placeholder="0.00" required autoFocus />
          </label>
          <label className="v-field">
            Where
            <input name="merchant" maxLength={80} autoComplete="off" placeholder="Shop or note" />
          </label>
          <div className="v-two">
            <div className="v-field">
              Account
              <FormPick label="Account" name="account" defaultValue={accounts[0]?.id} options={accounts.map((x) => ({ value: x.id, label: x.name }))} />
            </div>
            <div className="v-field">
              Category
              <FormPick label="Category" name="category" options={[{ value: "", label: "No category" }, ...categories.map((x) => ({ value: x.id, label: x.name }))]} />
            </div>
          </div>
          {state.error ? (
            <p className="v-flag v-bad" role="alert">
              {state.error}
            </p>
          ) : null}
          <button className="v-btn v-pri" type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save expense"}
          </button>
        </div>
      )}
    </form>
  );
}

/** A button that opens the quick-add sheet. */
export function QuickAddButton({ className = "v-btn v-pri", label, children }: { className?: string; label?: string; children: React.ReactNode }) {
  const open = useContext(Ctx);
  return (
    <button type="button" className={className} onClick={open} aria-label={label} aria-haspopup="dialog">
      {children}
    </button>
  );
}
