import type { SupabaseClient } from "@supabase/supabase-js";

export const TRANSFER_GROUP = "Transfers";
export const TRANSFER_CATEGORY = "Transfer";

/**
 * The id of the Transfer category, creating it (inside its own "Transfers" group, so it never mixes with Essentials, Wants or Savings)
 * the first time it is needed. When it is created, transfers that were paired before it existed are given it too. Spending and the
 * budget only count expenses, so a transfer wearing this category never counts as spending. Null if it could not be made.
 */
export async function ensureTransferCategory(supabase: SupabaseClient): Promise<string | null> {
  const found = await supabase.from("categories").select("id").eq("name", TRANSFER_CATEGORY).is("archived_at", null).limit(1).maybeSingle();
  if (found.data?.id) return found.data.id as string;

  let groupId: string | null = null;
  const group = await supabase.from("category_groups").select("id").eq("name", TRANSFER_GROUP).is("archived_at", null).limit(1).maybeSingle();
  if (group.data?.id) groupId = group.data.id as string;
  else {
    const made = await supabase.from("category_groups").insert({ name: TRANSFER_GROUP, sort: 99, feeds_savings: false }).select("id").single();
    if (made.data?.id) groupId = made.data.id as string;
  }
  if (!groupId) return null;

  const cat = await supabase.from("categories").insert({ group_id: groupId, name: TRANSFER_CATEGORY, sort: 99 }).select("id").single();
  if (!cat.data?.id) return null;
  const id = cat.data.id as string;
  await supabase.from("transactions").update({ category_id: id }).eq("kind", "transfer").is("category_id", null);
  return id;
}
