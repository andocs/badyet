"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import type { FormState } from "@/lib/form-state";
import { V13Icon } from "./icons";

/** A button that opens a small form in a sheet. The fields are passed in; the action is a server action. */
export function FormDialog({
  trigger,
  triggerClassName = "v-btn",
  title,
  action,
  submitLabel,
  children,
}: {
  trigger: React.ReactNode;
  triggerClassName?: string;
  title: string;
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  submitLabel: string;
  children: React.ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [round, setRound] = useState(0);
  const titleId = `fd-${title.replace(/\W+/g, "-").toLowerCase()}`;
  return (
    <>
      <button
        type="button"
        className={triggerClassName}
        onClick={() => {
          setRound((r) => r + 1);
          dialog.current?.showModal();
        }}
      >
        {trigger}
      </button>
      <dialog ref={dialog} className="v-fdlg" aria-labelledby={titleId} onClick={(e) => e.target === dialog.current && dialog.current?.close()}>
        <DialogForm key={round} titleId={titleId} title={title} action={action} submitLabel={submitLabel} onClose={() => dialog.current?.close()}>
          {children}
        </DialogForm>
      </dialog>
    </>
  );
}

function DialogForm({ titleId, title, action, submitLabel, onClose, children }: { titleId: string; title: string; action: (prev: FormState, fd: FormData) => Promise<FormState>; submitLabel: string; onClose: () => void; children: React.ReactNode }) {
  const [state, run, pending] = useActionState<FormState, FormData>(action, {});
  useEffect(() => {
    if (state.ok) onClose();
  }, [state, onClose]);
  return (
    <form action={run} className="v-qa">
      <div className="v-grab" aria-hidden="true" />
      <div className="v-row v-sp">
        <h2 id={titleId}>{title}</h2>
        <button type="button" className="v-iconbtn v-s" onClick={onClose} aria-label="Close">
          <V13Icon name="x" />
        </button>
      </div>
      <div className="v-frm">
        {children}
        {state.error ? (
          <p className="v-flag v-bad" role="alert">
            {state.error}
          </p>
        ) : null}
        <button className="v-btn v-pri" type="submit" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </button>
      </div>
    </form>
  );
}

/** The receive-QR, big, for showing to the person paying you. The image URL is a short-lived signed link. */
export function QrViewer({ url, caption }: { url: string; caption: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button type="button" className="v-btn v-sm v-pri" onClick={() => dialog.current?.showModal()}>
        Show big
      </button>
      <dialog ref={dialog} className="v-qrdlg" aria-label="Receive QR" onClick={() => dialog.current?.close()}>
        <div className="v-stack" style={{ alignItems: "center", textAlign: "center" }}>
          <div className="v-qrimg">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt={`Receive QR for ${caption}`} />
          </div>
          <b>{caption} · receive QR</b>
          <button type="button" className="v-btn" onClick={() => dialog.current?.close()}>
            Close
          </button>
        </div>
      </dialog>
    </>
  );
}

/** Colour choice for a new account: radio-like swatches. */
export function ColorPick({ colors, name = "color" }: { colors: readonly string[]; name?: string }) {
  const [value, setValue] = useState(colors[0]!);
  return (
    <div>
      <input type="hidden" name={name} value={value} />
      <div className="v-lbl" style={{ marginBottom: 6 }}>Card colour</div>
      <div className="v-chips" role="group" aria-label="Card colour">
        {colors.map((c) => (
          <button key={c} type="button" className="v-swatch" style={{ background: c }} aria-pressed={value === c} aria-label={c} onClick={() => setValue(c)} />
        ))}
      </div>
    </div>
  );
}

/** Shows the credit-card fields only when the kind is "credit". */
export function KindFields({ kinds }: { kinds: readonly string[] }) {
  const [kind, setKind] = useState(kinds[0]!);
  return (
    <>
      <label className="v-field">
        Kind
        <select name="kind" value={kind} onChange={(e) => setKind(e.target.value)}>
          {kinds.map((k) => (
            <option key={k} value={k}>
              {k === "ewallet" ? "E-wallet" : k.charAt(0).toUpperCase() + k.slice(1)}
            </option>
          ))}
        </select>
      </label>
      <label className="v-field">
        {kind === "credit" ? "Amount you owe now (₱)" : "Balance now (₱)"}
        <input name="opening" inputMode="decimal" autoComplete="off" placeholder="0.00" />
      </label>
      {kind === "credit" ? (
        <>
          <label className="v-field">
            Credit limit (₱)
            <input name="creditLimit" inputMode="decimal" autoComplete="off" />
          </label>
          <div className="v-two">
            <label className="v-field">
              Statement day
              <input name="statementDay" inputMode="numeric" maxLength={2} />
            </label>
            <label className="v-field">
              Due day
              <input name="dueDay" inputMode="numeric" maxLength={2} />
            </label>
          </div>
        </>
      ) : null}
    </>
  );
}
