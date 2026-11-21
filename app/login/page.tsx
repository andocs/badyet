import "../v13.css";
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
    <div className="v13">
      <main className="v-login">
        <section className="v-hero v-logincard">
          <span className="v-pip" aria-hidden="true" />
          <h1 style={{ marginTop: 18 }}>Bad(yet)</h1>
          <p style={{ margin: "6px 0 20px" }} className="v-lbl">Your money, split by payday. Sign in with your Google account.</p>
          {!configured && <p className="v-flag v-bad" role="alert">{ERRORS.setup}</p>}
          {error && configured && <p className="v-flag v-bad" role="alert">{error}</p>}
          <form action={signInWithGoogle} style={{ marginTop: 14 }}>
            <button type="submit" className="v-btn v-pri" style={{ width: "100%" }} disabled={!configured}>Continue with Google</button>
          </form>
        </section>
      </main>
    </div>
  );
}
