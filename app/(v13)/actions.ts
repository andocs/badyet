"use server";

import { revalidatePath } from "next/cache";
import { parsePesos } from "@/lib/domain/money";
import { requireAuthed } from "@/lib/auth/require";
import { markBillSent, undoBillSent } from "@/lib/bills/send";
import { recordPay, saveNowCategories } from "@/lib/pay/payday";

export interface AddExpenseState {
  ok?: boolean;
  error?: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_CENTAVOS = 100_000_000_000;

/** Quick add: one confirmed expense, dated now. Checks the login itself; row-level security is the final guard. */
export async function addExpense(_prev: AddExpenseState, formData: FormData): Promise<AddExpenseState> {
  const supabase = await requireAuthed();

  const amount = parsePesos(String(formData.get("amount") ?? ""));
  if (amount === undefined || amount <= 0) return { error: "Enter an amount above zero, like 250 or 1,250.50." };
  if (amount > MAX_CENTAVOS) return { error: "That amount is too large." };

  const account = String(formData.get("account") ?? "");
  if (!UUID.test(account)) return { error: "Pick an account." };
  const categoryRaw = String(formData.get("category") ?? "");
  const category = categoryRaw === "" ? null : categoryRaw;
  if (category !== null && !UUID.test(category)) return { error: "Pick a category from the list." };
  const merchant = String(formData.get("merchant") ?? "").trim().slice(0, 80) || null;

  // The policies only check the account; confirm the category is the user's own too (RLS hides other people's rows).
  const owned = await supabase.from("accounts").select("id").eq("id", account).is("archived_at", null).maybeSingle();
  if (!owned.data) return { error: "That account was not found." };
  if (category !== null) {
    const cat = await supabase.from("categories").select("id").eq("id", category).maybeSingle();
    if (!cat.data) return { error: "That category was not found." };
  }

  const now = new Date().toISOString();
  const { error } = await supabase.from("transactions").insert({
    account_id: account,
    occurred_at: now,
    amount: -amount,
    merchant,
    kind: "expense",
    category_id: category,
    source: "manual",
    status: "confirmed",
    confirmed_at: now,
  });
  if (error) return { error: "Could not save that. Try again." };

  revalidatePath("/");
  return { ok: true };
}

const billsChanged = () => {
  revalidatePath("/");
  revalidatePath("/budget");
  revalidatePath("/accounts");
  revalidatePath("/inbox");
};

/** Marks a bill sent for the cutoff from the Now page. */
export async function sendBill(input: { lineId: string; from: string; amount: string }): Promise<AddExpenseState> {
  const supabase = await requireAuthed();
  const r = await markBillSent(supabase, input);
  if ("error" in r) return { error: r.error };
  billsChanged();
  return { ok: true };
}

/** Payday: the pay came in. Recorded as income on that account, which is remembered for next time. */
export async function payArrived(input: { accountId: string; amount: string }): Promise<AddExpenseState> {
  const supabase = await requireAuthed();
  const r = await recordPay(supabase, input);
  if ("error" in r) return { error: r.error };
  revalidatePath("/");
  revalidatePath("/accounts");
  revalidatePath("/inbox");
  return { ok: true };
}

/** Which categories Planned vs spent shows on Now (null = all). */
export async function setNowCategories(ids: string[] | null): Promise<AddExpenseState> {
  const supabase = await requireAuthed();
  const r = await saveNowCategories(supabase, ids);
  if ("error" in r) return { error: r.error };
  revalidatePath("/");
  return { ok: true };
}

/** Undo for a bill marked sent. */
export async function unsendBill(txnId: string): Promise<AddExpenseState> {
  const supabase = await requireAuthed();
  const r = await undoBillSent(supabase, txnId);
  if ("error" in r) return { error: r.error };
  billsChanged();
  return { ok: true };
}
