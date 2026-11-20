"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAuthed } from "@/lib/auth/require";
import { isCutoff, type Cutoff } from "@/lib/budget/validate";
import { isUuid } from "@/lib/plans/validate";
import { applyMarks } from "@/lib/transfer/marks";
import { currentMonth, isMonth } from "@/lib/transfer/month";

const DEFAULT_WALLETS = ["Gcash", "Maya", "BPI", "Vybe"];

function where(formData: FormData): { month: string; cutoff: Cutoff; plan: string | null } {
  const month = formData.get("month");
  const cutoff = formData.get("cutoff");
  const plan = String(formData.get("plan") ?? "");
  return { month: isMonth(month) ? month : currentMonth(), cutoff: isCutoff(cutoff) ? cutoff : "first", plan: isUuid(plan) ? plan : null };
}

function back(w: { month: string; cutoff: Cutoff; plan: string | null }, code?: string, err?: { message: string } | null): never {
  if (err) console.error("[transfer] database error:", err.message);
  revalidatePath("/transfer");
  revalidatePath("/budget");
  const detail = err ? `&detail=${encodeURIComponent(err.message)}` : "";
  redirect(`/transfer?month=${w.month}&cutoff=${w.cutoff}${w.plan ? `&plan=${w.plan}` : ""}${code ? `&error=${code}` : ""}${detail}`);
}

export async function toggleSent(formData: FormData) {
  const supabase = await requireAuthed();
  const w = where(formData);
  const lineId = String(formData.get("lineId") ?? "");
  if (!isUuid(lineId)) back(w, "failed");
  const wasSent = formData.get("sent") === "1";
  const error = await applyMarks(supabase, [lineId], w.month, !wasSent);
  back(w, error ? "failed" : undefined, error);
}

export async function addWallet(formData: FormData) {
  const supabase = await requireAuthed();
  const w = where(formData);
  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 1 || name.length > 30) back(w, "invalid");
  const { error } = await supabase.from("wallets").insert({ name });
  back(w, error ? "failed" : undefined, error);
}

export async function addDefaultWallets(formData: FormData) {
  const supabase = await requireAuthed();
  const w = where(formData);
  // Only add the ones that are missing, so pressing it twice does nothing.
  const { data: existing } = await supabase.from("wallets").select("name");
  const have = new Set((existing ?? []).map((r) => String(r.name).toLowerCase()));
  const missing = DEFAULT_WALLETS.filter((n) => !have.has(n.toLowerCase())).map((name) => ({ name }));
  if (missing.length === 0) back(w);
  const { error } = await supabase.from("wallets").insert(missing);
  back(w, error ? "failed" : undefined, error);
}

export async function deleteWallet(formData: FormData) {
  const supabase = await requireAuthed();
  const w = where(formData);
  const id = String(formData.get("id") ?? "");
  if (!isUuid(id)) back(w, "failed");
  const { error } = await supabase.from("wallets").delete().eq("id", id);
  back(w, error ? "failed" : undefined, error);
}
