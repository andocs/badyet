import type { SupabaseClient } from "@supabase/supabase-js";
import { loadBonuses } from "@/lib/bonuses/load";
import { loadFunds } from "@/lib/funds/load";
import { loadLinkable } from "./load";
import { outstandingOf } from "./model";
import { sourceGroups } from "./sources";

/** Everything the Lending page and the Inbox need to offer: sources, your accounts, names, open loans and recorded money. */
export async function loadLendingContext(supabase: SupabaseClient) {
  const [funds, bonuses, accountRes, incoming, outgoing] = await Promise.all([
    loadFunds(supabase),
    loadBonuses(supabase),
    supabase.from("accounts").select("id, name").is("archived_at", null).order("sort"),
    loadLinkable(supabase, "in"),
    loadLinkable(supabase, "out"),
  ]);
  const accounts = (accountRes.data ?? []) as { id: string; name: string }[];
  const { today, paydays } = funds.budget;
  return {
    ready: funds.lending.ready,
    loans: funds.lending.loans,
    lend: { sources: sourceGroups(funds, bonuses), people: [...new Set(funds.lending.loans.map((l) => l.borrower))], today, paydays },
    payback: { choices: incoming, accounts, today, paydays },
    outgoing,
    openLoans: funds.lending.loans.filter((l) => outstandingOf(l) > 0),
  };
}
