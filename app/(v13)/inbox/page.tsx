import { HELD_COLUMNS, type HeldRow } from "@/lib/capture/held";
import { SOURCE_INFO, isSource } from "@/lib/capture/sources";
import { ensureTransferCategory } from "@/lib/capture/transfer-category";
import { isoDate } from "@/lib/domain/dates";
import { bestGuess, matchRule, type MerchantRule } from "@/lib/inbox/rules";
import { todayManila } from "@/lib/plans/validate";
import { createClient } from "@/lib/supabase/server";
import { InboxView, type InboxTxn } from "@/components/v13/inbox";
import type { HeldCapture } from "@/components/v13/held-capture-card";

export const metadata = { title: "Inbox · Bad(yet)" };

interface Row {
  id: string; account_id: string; occurred_at: string; amount: number; merchant: string | null; kind: "expense" | "income" | "transfer";
  category_id: string | null; transfer_peer_id: string | null; source: string; status: "pending" | "confirmed"; dedupe_hash: string | null; note: string | null;
}
const SOURCE: Record<string, string> = { notification: "Notification", manual: "Added by hand", transfer: "Transfer", import: "Import", bonus: "Bonus" };

export default async function Inbox() {
  const supabase = await createClient();
  if (!supabase) return <p className="v-main">Supabase is not configured.</p>;

  // The Transfer category exists from the first visit, so a move between your own accounts can be filed under it.
  await ensureTransferCategory(supabase);

  const cols = "id, account_id, occurred_at, amount, merchant, kind, category_id, transfer_peer_id, source, status, dedupe_hash, note";
  const [cats, acct, rulesRes, pendingRes, recentRes, historyRes, heldRes, liveAccounts] = await Promise.all([
    supabase.from("categories").select("id, name").is("archived_at", null).order("sort"),
    supabase.from("accounts").select("id, name"),
    supabase.from("merchant_rules").select("id, pattern, category_id, account_id, priority"),
    supabase.from("transactions").select(cols).eq("status", "pending").order("occurred_at", { ascending: false }),
    supabase.from("transactions").select(cols).neq("status", "ignored").order("occurred_at", { ascending: false }).limit(60),
    supabase.from("transactions").select("merchant, category_id").eq("status", "confirmed").not("category_id", "is", null).order("occurred_at", { ascending: false }).limit(500),
    supabase.from("held_captures").select(HELD_COLUMNS).order("post_time", { ascending: false }),
    supabase.from("accounts").select("id, name").is("archived_at", null).order("sort").order("created_at"),
  ]);
  // Captures the phone could not place in an account (the table comes from a newer migration; without it there are none).
  const held: HeldCapture[] = heldRes.error ? [] : ((heldRes.data ?? []) as HeldRow[]).filter((h) => isSource(h.source)).map((h) => ({
    hash: h.hash, sourceLabel: SOURCE_INFO[h.source as keyof typeof SOURCE_INFO].label, direction: h.direction, amount: h.amount, counterparty: h.counterparty, postTime: h.post_time,
  }));
  const categories = (cats.data ?? []) as { id: string; name: string }[];
  const catName = new Map(categories.map((c) => [c.id, c.name]));
  const accountName = new Map(((acct.data ?? []) as { id: string; name: string }[]).map((a) => [a.id, a.name]));
  const rules: MerchantRule[] = ((rulesRes.data ?? []) as { id: string; pattern: string; category_id: string; account_id: string | null; priority: number }[]).map((r) => ({
    id: r.id, pattern: r.pattern, categoryId: r.category_id, accountId: r.account_id, priority: r.priority,
  }));
  const history = ((historyRes.data ?? []) as { merchant: string | null; category_id: string | null }[]).map((h) => ({ merchant: h.merchant, categoryId: h.category_id }));

  const all = new Map<string, Row>();
  for (const r of [...((recentRes.data ?? []) as Row[]), ...((pendingRes.data ?? []) as Row[])]) all.set(r.id, r);

  const txns: InboxTxn[] = [...all.values()]
    .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))
    .map((r) => {
      // A pending row with no category gets a suggestion: your rule first, then your past purchases.
      let categoryId = r.category_id;
      let guess: InboxTxn["guess"] = null;
      if (r.status === "pending" && r.kind !== "transfer" && categoryId === null) {
        const rule = matchRule(r.merchant, r.account_id, rules);
        if (rule) { categoryId = rule.categoryId; guess = "rule"; }
        else {
          const g = bestGuess(r.merchant, history);
          if (g) { categoryId = g; guess = "history"; }
        }
      }
      const peer = r.transfer_peer_id ? all.get(r.transfer_peer_id) : undefined;
      return {
        id: r.id,
        who: r.merchant ?? (r.kind === "transfer" ? (r.amount < 0 ? "Transfer out" : "Transfer in") : "Expense"),
        amount: r.amount,
        account: accountName.get(r.account_id) ?? "Account",
        peerAccount: peer ? (accountName.get(peer.account_id) ?? null) : null,
        occurredAt: r.occurred_at,
        source: SOURCE[r.source] ?? r.source,
        kind: r.kind,
        status: r.status,
        categoryId,
        categoryName: categoryId ? (catName.get(categoryId) ?? null) : null,
        guess,
        dedupe: r.dedupe_hash ? `${r.dedupe_hash.slice(0, 4)}…${r.dedupe_hash.slice(-4)}` : null,
        note: r.note,
      };
    });

  return <InboxView txns={txns} categories={categories} held={held} accounts={(liveAccounts.data ?? []) as { id: string; name: string }[]} today={isoDate(todayManila())} />;
}
