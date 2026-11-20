import { Pip } from "@/components/pip";
import { supabaseEnv } from "@/lib/supabase/env";
import { signInWithGoogle } from "./actions";

const ERRORS: Record<string, string> = {
  google: "We could not start Google sign-in. Try again in a minute.",
  setup: "The database is not set up yet. Copy .env.example to .env.local and fill it in.",
  "not-allowed": "That Google account is not allowed here.",
  link: "Google sign-in did not finish. Try again.",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const error = typeof params.error === "string" ? ERRORS[params.error] : undefined;
  const configured = supabaseEnv() !== null;

  return (
    <main className="login">
      <div className="card login-card">
        <Pip />
        <h1>Bad(yet)</h1>
        <p className="sub">Your money, split by payday. Sign in with your Google account.</p>
        {!configured && <p className="notice err" role="alert">{ERRORS.setup}</p>}
        {error && configured && <p className="notice err" role="alert">{error}</p>}
        <form action={signInWithGoogle} className="form">
          <button type="submit" className="btn" disabled={!configured}>Continue with Google</button>
        </form>
      </div>
    </main>
  );
}
