"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Sends you to Google. Who may then use the app is decided in /auth/callback (and the proxy) against ALLOWED_EMAIL,
// so any other Google account that signs in is turned away and never reaches your data.
export async function signInWithGoogle() {
  const supabase = await createClient();
  if (!supabase) redirect("/login?error=setup");

  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? (await headers()).get("origin") ?? "http://localhost:3000";
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${origin}/auth/callback`, queryParams: { prompt: "select_account" } },
  });
  if (error || !data.url) redirect("/login?error=google");
  redirect(data.url);
}
