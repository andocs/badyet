"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  /** Red confirm button, for removing or deleting. */
  danger?: boolean;
}
interface ToastItem {
  id: number;
  text: string;
  kind: "ok" | "bad";
}
interface Feedback {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  toast: (text: string, kind?: "ok" | "bad") => void;
}

const FeedbackCtx = createContext<Feedback | null>(null);

function useFeedback(): Feedback {
  const v = useContext(FeedbackCtx);
  if (!v) throw new Error("Used outside FeedbackProvider");
  return v;
}
/** Ask before something that cannot be undone. Returns true when the person confirms. Replaces window.confirm. */
export const useConfirm = () => useFeedback().confirm;
/** A short message at the bottom of the screen that goes away by itself. */
export const useToast = () => useFeedback().toast;

/** One confirm dialog and one toast stack for the whole app, so every message looks and behaves the same. */
export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [ask, setAsk] = useState<{ options: ConfirmOptions; resolve: (ok: boolean) => void } | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const confirm = useCallback((options: ConfirmOptions) => new Promise<boolean>((resolve) => setAsk({ options, resolve })), []);
  const toast = useCallback((text: string, kind: "ok" | "bad" = "ok") => {
    const id = ++nextId.current;
    setToasts((t) => [...t.slice(-2), { id, text, kind }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === "bad" ? 6000 : 3500);
  }, []);

  useEffect(() => {
    if (ask && !dialog.current?.open) dialog.current?.showModal();
  }, [ask]);

  const answer = (ok: boolean) => {
    ask?.resolve(ok);
    setAsk(null);
    dialog.current?.close();
  };

  return (
    <FeedbackCtx.Provider value={{ confirm, toast }}>
      {children}
      <dialog ref={dialog} className="v-fdlg v-cfm" aria-labelledby="cfm-t" onCancel={(e) => { e.preventDefault(); answer(false); }} onClick={(e) => e.target === dialog.current && answer(false)}>
        {ask ? (
          <div className="v-qa">
            <div className="v-grab" aria-hidden="true" />
            <h2 id="cfm-t">{ask.options.title}</h2>
            {ask.options.message ? <p className="v-muted" style={{ margin: 0 }}>{ask.options.message}</p> : null}
            <div className="v-row v-wrap" style={{ justifyContent: "flex-end", gap: 10 }}>
              <button type="button" className="v-btn" onClick={() => answer(false)}>Cancel</button>
              <button type="button" className={`v-btn ${ask.options.danger ? "v-danger" : "v-pri"}`} onClick={() => answer(true)} autoFocus>{ask.options.confirmLabel ?? "Confirm"}</button>
            </div>
          </div>
        ) : null}
      </dialog>
      <div className="v-toasts" role="status" aria-live="polite">
        {toasts.map((t) => <div key={t.id} className={`v-toast ${t.kind === "bad" ? "v-bad" : ""}`}>{t.text}</div>)}
      </div>
    </FeedbackCtx.Provider>
  );
}
