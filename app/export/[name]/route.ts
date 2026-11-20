import { NextResponse } from "next/server";
import { isAllowedEmail } from "@/lib/auth/allowed";
import { isExportName, toCsv } from "@/lib/export/csv";
import { createClient } from "@/lib/supabase/server";

// Downloads one of your tables as CSV. Row-level security limits it to your own rows.
export async function GET(_req: Request, ctx: RouteContext<"/export/[name]">) {
  const { name } = await ctx.params;
  if (!isExportName(name)) return new NextResponse("Not found", { status: 404 });
  const supabase = await createClient();
  if (!supabase) return new NextResponse("Unavailable", { status: 503 });
  const { data: auth } = await supabase.auth.getUser();
  if (!isAllowedEmail(auth.user?.email, process.env.ALLOWED_EMAIL)) return new NextResponse("Unauthorized", { status: 401 });

  const { data, error } = await supabase.from(name).select("*");
  if (error) return new NextResponse("Export failed", { status: 500 });
  return new NextResponse(toCsv((data ?? []) as Record<string, unknown>[]), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="badyet-${name}.csv"`,
      "cache-control": "no-store",
    },
  });
}
