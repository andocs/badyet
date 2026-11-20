"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAuthed } from "@/lib/auth/require";

export async function saveSettings(formData: FormData) {
  const supabase = await requireAuthed();
  const raw = String(formData.get("secondStart") ?? "").trim();
  const day = Number(raw);
  if (!/^\d{1,2}$/.test(raw) || !Number.isInteger(day) || day < 2 || day > 28) redirect("/settings?error=invalid");
  const { error } = await supabase
    .from("user_settings")
    .upsert({ second_cutoff_start_day: day, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) {
    console.error("[settings] database error:", error.message);
    redirect(`/settings?error=failed&detail=${encodeURIComponent(error.message)}`);
  }
  revalidatePath("/");
  redirect("/settings?saved=1");
}
