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
          <span className="v-pip" aria-hidden="true" style={{ margin: "0 auto" }} />
          <h1 style={{ marginTop: 22 }}>Bad(yet)</h1>
          <p style={{ margin: "8px 0 24px" }} className="v-lbl">Your money, split by payday. Sign in with your Google account.</p>
          {!configured && <p className="v-flag v-bad" role="alert">{ERRORS.setup}</p>}
          {error && configured && <p className="v-flag v-bad" role="alert">{error}</p>}
          <form action={signInWithGoogle} style={{ marginTop: 14 }}>
            <button type="submit" className="v-btn v-pri" style={{ width: "100%" }} disabled={!configured}>
              <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
                <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.9 2.4 30.4 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
                <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.6 5.9c4.4-4.1 7-10.1 7-17.6z" />
                <path fill="#FBBC05" d="M10.5 28.7A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.8-4.7l-7.9-6.1A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.8l7.9-6.1z" />
                <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.9 2.3-8.3 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
              </svg>
              Continue with Google
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}
