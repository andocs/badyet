"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAuthed } from "@/lib/auth/require";
import { parsePaydays } from "@/lib/dashboard/paydays";

export async function saveSettings(formData: FormData) {
  const supabase = await requireAuthed();
  const parsed = parsePaydays(formData.get("firstStart"), formData.get("secondStart"));
  if (!parsed) redirect("/settings?error=invalid");
  const { error } = await supabase
    .from("user_settings")
    .upsert(
      { first_cutoff_start_day: parsed.firstStartDay, second_cutoff_start_day: parsed.secondStartDay, updated_at: new Date().toISOString() },
      { onConflict: "user_id" },
    );
  if (error) {
    console.error("[settings] database error:", error.message);
    redirect(`/settings?error=failed&detail=${encodeURIComponent(error.message)}`);
  }
  for (const p of ["/", "/budget", "/transfer", "/installments"]) revalidatePath(p);
  redirect("/settings?saved=1");
}
