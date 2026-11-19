"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { isAllowedEmail } from "@/lib/auth/allowed";
import { createClient } from "@/lib/supabase/server";

export async function sendLink(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const supabase = await createClient();
  if (!supabase) redirect("/login?error=setup");

  // Same answer whether or not the address is allowed, so the form never reveals who may log in.
  if (!isAllowedEmail(email, process.env.ALLOWED_EMAIL)) redirect("/login?sent=1");

  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? (await headers()).get("origin") ?? "http://localhost:3000";
  const { error } = await supabase.auth.signInWithOtp({
    email,
    // The user is created once in the Supabase dashboard; this form never creates accounts.
    options: { emailRedirectTo: `${origin}/auth/callback`, shouldCreateUser: false },
  });
  redirect(error ? "/login?error=send" : "/login?sent=1");
}
