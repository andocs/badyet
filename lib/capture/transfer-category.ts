import type { SupabaseClient } from "@supabase/supabase-js";

export const TRANSFER_GROUP = "Transfers";
export const TRANSFER_CATEGORY = "Transfer";
/** Paying a credit card from a bank account: money between your own accounts, so it is not spending (the purchases already were). */
export const CARD_PAYMENT_CATEGORY = "Credit card payment";

/** Money lent to someone and paid back. Filed as a transfer, so it is neither spending nor income. */
export const LENDING_CATEGORY = "Lending";

/** The categories the app makes and files things under itself, so no picker or budget list offers them. */
export const isBuiltInCategory = (name: string | null | undefined): boolean => name === TRANSFER_CATEGORY || name === CARD_PAYMENT_CATEGORY || name === LENDING_CATEGORY;

/** Categories that mean "a move between your own accounts": confirming an item with one of them makes it a transfer, not spending. */
export const isMoveCategory = (name: string | null | undefined): boolean => name === TRANSFER_CATEGORY || name === CARD_PAYMENT_CATEGORY;

/** The id of the "Transfers" group, creating it the first time it is needed, so these never mix with Essentials, Wants or Savings. */
async function ensureTransferGroup(supabase: SupabaseClient): Promise<string | null> {
  const group = await supabase.from("category_groups").select("id").eq("name", TRANSFER_GROUP).is("archived_at", null).limit(1).maybeSingle();
  if (group.data?.id) return group.data.id as string;
  const made = await supabase.from("category_groups").insert({ name: TRANSFER_GROUP, sort: 99, feeds_savings: false }).select("id").single();
  return (made.data?.id as string | undefined) ?? null;
}

/**
 * The id of the Transfer category, creating it (inside its own "Transfers" group) the first time it is needed. When it is created,
 * transfers that were paired before it existed are given it too. Spending and the budget only count expenses, so a transfer wearing
 * this category never counts as spending. Null if it could not be made.
 */
export async function ensureTransferCategory(supabase: SupabaseClient): Promise<string | null> {
  const found = await supabase.from("categories").select("id").eq("name", TRANSFER_CATEGORY).is("archived_at", null).limit(1).maybeSingle();
  if (found.data?.id) return found.data.id as string;
  const groupId = await ensureTransferGroup(supabase);
  if (!groupId) return null;

  const cat = await supabase.from("categories").insert({ group_id: groupId, name: TRANSFER_CATEGORY, sort: 99 }).select("id").single();
  if (!cat.data?.id) return null;
  const id = cat.data.id as string;
  await supabase.from("transactions").update({ category_id: id }).eq("kind", "transfer").is("category_id", null);
  return id;
}

/**
 * The built-in "Credit card payment" category, created in the Transfers group the first time it is needed. Unlike Transfer it shows
 * in category pickers; picking it on an item makes the item a move between your accounts, so paying the card is not counted as
 * spending a second time. Null if it could not be made.
 */
export async function ensureCardPaymentCategory(supabase: SupabaseClient): Promise<string | null> {
  const found = await supabase.from("categories").select("id").eq("name", CARD_PAYMENT_CATEGORY).is("archived_at", null).limit(1).maybeSingle();
  if (found.data?.id) return found.data.id as string;
  const groupId = await ensureTransferGroup(supabase);
  if (!groupId) return null;
  const cat = await supabase.from("categories").insert({ group_id: groupId, name: CARD_PAYMENT_CATEGORY, sort: 98 }).select("id").single();
  return (cat.data?.id as string | undefined) ?? null;
}

/** The id of the built-in Lending category, in the Transfers group. Null if it could not be made. */
export async function ensureLendingCategory(supabase: SupabaseClient): Promise<string | null> {
  const found = await supabase.from("categories").select("id").eq("name", LENDING_CATEGORY).is("archived_at", null).limit(1).maybeSingle();
  if (found.data?.id) return found.data.id as string;
  const groupId = await ensureTransferGroup(supabase);
  if (!groupId) return null;
  const cat = await supabase.from("categories").insert({ group_id: groupId, name: LENDING_CATEGORY, sort: 97 }).select("id").single();
  return (cat.data?.id as string | undefined) ?? null;
}
