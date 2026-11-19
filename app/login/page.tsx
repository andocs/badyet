import { Pip } from "@/components/pip";
import { supabaseEnv } from "@/lib/supabase/env";
import { sendLink } from "./actions";

const ERRORS: Record<string, string> = {
  send: "We could not send the link. Wait a minute and try again.",
  setup: "The database is not set up yet. Copy .env.example to .env.local and fill it in.",
  "not-allowed": "That account is not allowed here.",
  link: "That link did not work or has expired. Request a new one.",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const sent = params.sent === "1";
  const error = typeof params.error === "string" ? ERRORS[params.error] : undefined;
  const configured = supabaseEnv() !== null;

  return (
    <main className="login">
      <div className="card login-card">
        <Pip happy={sent} />
        <h1>Bad(yet)</h1>
        <p className="sub">Your money, split by payday. Enter your email and I will send you a login link.</p>
        {!configured && <p className="notice err" role="alert">{ERRORS.setup}</p>}
        {error && configured && <p className="notice err" role="alert">{error}</p>}
        {sent ? (
          <p className="notice ok" role="status">Check your inbox. If that address is allowed, a link is on its way.</p>
        ) : (
          <form action={sendLink} className="form">
            <label className="field">
              <span className="lab">Email</span>
              <input className="input" type="email" name="email" autoComplete="email" required placeholder="you@example.com" />
            </label>
            <button type="submit" className="btn" disabled={!configured}>Send login link</button>
          </form>
        )}
      </div>
    </main>
  );
}
