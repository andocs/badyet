import { HELD_COLUMNS, type HeldRow } from "@/lib/capture/held";
import { transferHoldUntil, type HoldAccount } from "@/lib/capture/hold";
import { SOURCE_INFO, isSource } from "@/lib/capture/sources";
import { ensureCardPaymentCategory, ensureTransferCategory } from "@/lib/capture/transfer-category";
import { isoDate } from "@/lib/domain/dates";
import { bestGuess, matchRule, type MerchantRule } from "@/lib/inbox/rules";
import { todayManila } from "@/lib/plans/validate";
import { createClient } from "@/lib/supabase/server";
import { InboxView, type InboxTxn } from "@/components/v13/inbox";
import type { HeldCapture } from "@/components/v13/held-capture-card";
import { loadLendingContext } from "@/lib/lending/context";
import { loanTags } from "@/lib/lending/forms";

export const metadata = { title: "Inbox · Bad(yet)" };

interface Row {
  id: string; account_id: string; occurred_at: string; amount: number; merchant: string | null; kind: "expense" | "income" | "transfer";
  category_id: string | null; transfer_peer_id: string | null; source: string; status: "pending" | "confirmed"; dedupe_hash: string | null; note: string | null;
}
/** When each transfer-looking pending row may be confirmed as spending or income (ISO), as of this request. */
function holdTimes(rows: Iterable<Row>, accounts: readonly HoldAccount[]): Map<string, string> {
  const now = Date.now();
  const out = new Map<string, string>();
  for (const r of rows) {
    const until = transferHoldUntil({ status: r.status, kind: r.kind, source: r.source, occurredAt: r.occurred_at, counterparty: r.merchant, accountId: r.account_id }, accounts, now);
    if (until !== null) out.set(r.id, new Date(until).toISOString());
  }
  return out;
}

const SOURCE: Record<string, string> = { notification: "Notification", manual: "Added by hand", transfer: "Transfer", import: "Import", bonus: "Bonus" };

export default async function Inbox() {
  const supabase = await createClient();
  if (!supabase) return <p className="v-main">Supabase is not configured.</p>;

  // The Transfer category exists from the first visit, so a move between your own accounts can be filed under it.
  await ensureTransferCategory(supabase);
  await ensureCardPaymentCategory(supabase);

  // Lending is extra: if any of it cannot be read, the rest of the Inbox still loads.
  const lending = await loadLendingContext(supabase).catch(() => null);
  const tags = loanTags(lending?.loans ?? []);
  // Whose account a transfer to someone else went to. A newer column, asked for on its own so an older database still loads.
  const ownerRes = await supabase.from("transactions").select("id, other_owner").not("other_owner", "is", null);
  const owners = new Map(ownerRes.error ? [] : ((ownerRes.data ?? []) as { id: string; other_owner: string }[]).map((o) => [o.id, o.other_owner]));

  const cols = "id, account_id, occurred_at, amount, merchant, kind, category_id, transfer_peer_id, source, status, dedupe_hash, note";
  const [cats, acct, rulesRes, pendingRes, recentRes, historyRes, heldRes, liveAccounts, billsRes] = await Promise.all([
    supabase.from("categories").select("id, name").is("archived_at", null).neq("name", "Transfer").neq("name", "Lending").order("sort"),
    supabase.from("accounts").select("id, name, institution, archived_at"),
    supabase.from("merchant_rules").select("id, pattern, category_id, account_id, priority"),
    supabase.from("transactions").select(cols).eq("status", "pending").order("occurred_at", { ascending: false }),
    supabase.from("transactions").select(cols).neq("status", "ignored").order("occurred_at", { ascending: false }).limit(60),
    supabase.from("transactions").select("merchant, category_id").eq("status", "confirmed").not("category_id", "is", null).order("occurred_at", { ascending: false }).limit(500),
    supabase.from("held_captures").select(HELD_COLUMNS).order("post_time", { ascending: false }),
    supabase.from("accounts").select("id, name").is("archived_at", null).order("sort").order("created_at"),
    // Budget lines that go to an account are bills: a payment can be linked to one so it shows as sent.
    supabase.from("budget_lines_v2").select("id, name").not("account_id", "is", null).neq("rule", "rest").order("name"),
  ]);
  const holdAccounts = ((acct.data ?? []) as (HoldAccount & { archived_at: string | null })[]).filter((a) => a.archived_at === null);
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

  const holds = holdTimes(all.values(), holdAccounts);
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
        accountId: r.account_id,
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
        holdUntil: holds.get(r.id) ?? null,
        loanTag: tags.get(r.id) ?? null,
        otherOwner: owners.get(r.id) ?? null,
      };
    });

  return <InboxView txns={txns} categories={categories} held={held} accounts={(liveAccounts.data ?? []) as { id: string; name: string }[]} today={isoDate(todayManila())} bills={(billsRes.data ?? []) as { id: string; name: string }[]} lending={lending?.ready ? { lend: lending.lend, open: lending.openLoans } : null} />;
}
