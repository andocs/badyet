import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isAllowedEmail } from "@/lib/auth/allowed";
import { supabaseEnv } from "@/lib/supabase/env";

const PUBLIC_PATHS = ["/login", "/auth"];

// Runs before every page: refreshes the session and sends anyone who is not the
// allowed user to /login. Fails closed if Supabase is not configured.
export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path === p || path.startsWith(`${p}/`));
  const toLogin = () => NextResponse.redirect(new URL("/login", request.url));

  const env = supabaseEnv();
  if (!env) return isPublic ? NextResponse.next() : toLogin();

  let response = NextResponse.next({ request });
  const supabase = createServerClient(env.url, env.key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(list) {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // getClaims checks the token's signature here instead of asking the Auth server on every page switch.
  // Server Actions still call getUser (lib/auth/require.ts), and row-level security guards the data.
  const { data } = await supabase.auth.getClaims();
  let email = typeof data?.claims?.email === "string" ? data.claims.email : null;
  let signedIn = !!data?.claims;
  if (!signedIn) {
    // Before sending anyone to /login (which breaks a Server Action in flight), ask the Auth server once.
    const { data: fresh } = await supabase.auth.getUser();
    signedIn = !!fresh.user;
    email = fresh.user?.email ?? null;
  }
  const allowed = signedIn && isAllowedEmail(email, process.env.ALLOWED_EMAIL);
  // TEMPORARY diagnostics for the "unexpected response" Server Action error. Remove once it is understood.
  if (process.env.NODE_ENV !== "production" && request.method !== "GET") {
    console.log("[proxy-debug]", request.method, path, { claims: !!data?.claims, signedIn, allowed, hasEmail: !!email, action: request.headers.has("next-action") });
  }

  if (!allowed && !isPublic) return toLogin();
  if (allowed && path === "/login") return NextResponse.redirect(new URL("/", request.url));
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
