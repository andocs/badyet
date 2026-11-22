"use server";

import { revalidatePath } from "next/cache";
import { requireAuthed } from "@/lib/auth/require";
import type { FormState } from "@/lib/form-state";

/** Clears the phone's diagnostic log from the server (the phone keeps its own copy until it next uploads). */
export async function clearDiagnostics(): Promise<FormState> {
  const supabase = await requireAuthed();
  const { error } = await supabase.from("app_diagnostics").delete().gte("id", 0);
  if (error) return { error: "Could not clear the log. Try again." };
  revalidatePath("/settings/diagnostics");
  return { ok: true };
}
