import { NextResponse, type NextRequest } from "next/server";
import { isAllowedEmail } from "@/lib/auth/allowed";
import { createClient } from "@/lib/supabase/server";

// Google sends you back here with a one-time code.
export async function GET(request: NextRequest) {
  const { origin, searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const supabase = await createClient();
  if (!supabase || !code || searchParams.get("error")) return NextResponse.redirect(`${origin}/login?error=link`);

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(`${origin}/login?error=link`);

  const { data } = await supabase.auth.getUser();
  // Only the allowed address, and only when Google has verified it.
  if (!data.user?.email_confirmed_at || !isAllowedEmail(data.user.email, process.env.ALLOWED_EMAIL)) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/login?error=not-allowed`);
  }
  return NextResponse.redirect(`${origin}/`);
}
