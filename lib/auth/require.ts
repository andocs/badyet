import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAllowedEmail } from "./allowed";

// Used by every Server Action: re-checks the login itself (the proxy is not the only guard).
// Row-level security in the database is the final guard.
export async function requireAuthed() {
  const supabase = await createClient();
  if (!supabase) redirect("/login?error=setup");
  const { data } = await supabase.auth.getUser();
  if (!data.user || !isAllowedEmail(data.user.email, process.env.ALLOWED_EMAIL)) redirect("/login");
  return supabase;
}
