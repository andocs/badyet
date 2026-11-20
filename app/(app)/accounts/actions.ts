"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAuthed } from "@/lib/auth/require";
import { parseAccountForm } from "@/lib/accounts/input";
import { isUuid, todayManila } from "@/lib/plans/validate";

function back(code?: string, err?: { message: string } | null): never {
  if (err) console.error("[accounts] database error:", err.message);
  for (const p of ["/accounts", "/transfer", "/budget", "/"]) revalidatePath(p);
  const detail = err ? `&detail=${encodeURIComponent(err.message)}` : "";
  redirect(`/accounts${code ? `?error=${code}${detail}` : "?saved=1"}`);
}

export async function addAccount(formData: FormData) {
  const supabase = await requireAuthed();
  const parsed = parseAccountForm(Object.fromEntries(formData));
  if (!parsed.ok) back("invalid");
  const v = parsed.value;
  const { error } = await supabase.from("wallets").insert({
    kind: v.kind,
    name: v.name,
    institution: v.institution,
    last4: v.last4,
    balance: v.balance,
    balance_as_of: todayManila(),
    credit_limit: v.creditLimit,
    statement_day: v.statementDay,
    due_day: v.dueDay,
  });
  back(error ? "failed" : undefined, error);
}

// Keeps the balance current. Name, kind and last 4 stay as they are; delete and re-add to change those.
export async function updateBalance(formData: FormData) {
  const supabase = await requireAuthed();
  const id = String(formData.get("id") ?? "");
  if (!isUuid(id)) back("failed");
  const { data: row } = await supabase.from("wallets").select("kind,name,institution,last4").eq("id", id).maybeSingle();
  if (!row) back("failed");
  const parsed = parseAccountForm({ ...Object.fromEntries(formData), kind: row.kind, name: row.name, institution: row.institution ?? "", last4: row.last4 ?? "" });
  if (!parsed.ok) back("invalid");
  const v = parsed.value;
  const { error } = await supabase
    .from("wallets")
    .update({ balance: v.balance, balance_as_of: todayManila(), credit_limit: v.creditLimit, statement_day: v.statementDay, due_day: v.dueDay })
    .eq("id", id);
  back(error ? "failed" : undefined, error);
}

export async function deleteAccount(formData: FormData) {
  const supabase = await requireAuthed();
  const id = String(formData.get("id") ?? "");
  if (!isUuid(id)) back("failed");
  const { error } = await supabase.from("wallets").delete().eq("id", id);
  back(error ? "failed" : undefined, error);
}
