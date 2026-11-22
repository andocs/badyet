"use server";

import { revalidatePath } from "next/cache";
import { requireAuthed } from "@/lib/auth/require";
import type { FormState } from "@/lib/form-state";
import { deleteInstallment, saveInstallment } from "@/lib/installments/save";

const refresh = () => {
  for (const path of ["/installments", "/budget", "/forecast", "/"]) revalidatePath(path);
};

/** Saves a card plan or loan and its budget line. The same code the phone runs. */
export async function savePlan(input: unknown): Promise<FormState> {
  const supabase = await requireAuthed();
  const r = await saveInstallment(supabase, input);
  if ("error" in r) return { error: r.error };
  refresh();
  return { ok: true };
}

export async function deletePlan(id: string): Promise<FormState> {
  const supabase = await requireAuthed();
  const r = await deleteInstallment(supabase, id);
  if ("error" in r) return { error: r.error };
  refresh();
  return { ok: true };
}
