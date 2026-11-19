import Link from "next/link";
import { importSnapshot } from "./actions";

const ERRORS: Record<string, string> = {
  empty: "Choose a file or paste the contents first.",
  toobig: "That file is too large for an import (200 KB is the limit).",
  json: "That is not valid JSON. Check that the whole file was copied.",
  invalid: "The file has a problem.",
  failed: "The import did not finish and was undone. Nothing was added.",
};

export default async function ImportPage({ searchParams }: PageProps<"/import">) {
  const params = await searchParams;
  const error = typeof params.error === "string" ? ERRORS[params.error] : undefined;
  // Validation messages come from the file itself (for example "Line 3: ..."), so they are safe to show.
  const detail = typeof params.detail === "string" ? params.detail : undefined;
  const done = params.done === "1";

  return (
    <main className="main">
      <div className="head">
        <div>
          <h1>Import</h1>
          <p className="sub">Bring in a snapshot of your old sheet once, so you do not retype it.</p>
        </div>
      </div>
      {error && (
        <p className="notice err" role="alert" style={{ marginBottom: 18 }}>
          {error}
          {detail && <small style={{ display: "block", marginTop: 4, fontWeight: 500 }}>{detail}</small>}
        </p>
      )}
      {done && (
        <p className="notice ok" role="status" style={{ marginBottom: 18 }}>
          Imported: {String(params.lines ?? 0)} budget lines, {String(params.installments ?? 0)} installments and{" "}
          {String(params.subscriptions ?? 0)} subscriptions. The new plan is not active yet.{" "}
          <Link href="/plans">Open Plans to activate it</Link>.
        </p>
      )}
      <section className="card" aria-labelledby="imp-h" style={{ maxWidth: 640 }}>
        <h2 id="imp-h">Import a snapshot</h2>
        <form action={importSnapshot} className="form">
          <label className="field">
            <span className="lab">Snapshot file (.json)</span>
            <input className="input" type="file" name="file" accept=".json,application/json" />
          </label>
          <label className="field">
            <span className="lab">Or paste its contents</span>
            <textarea className="input" name="json" rows={6} spellCheck={false} />
          </label>
          <button type="submit" className="btn">Import</button>
        </form>
        <p className="sub">
          This creates a new, inactive plan with your pay, budget lines, wallets, installments and subscriptions. It never changes or deletes what you
          already have, and if anything fails it undoes itself. Installments and subscriptions with the same name as existing ones are skipped. The
          file stays on your computer; it is not saved in the project.
        </p>
      </section>
    </main>
  );
}
