import "../v13.css";
import { V13Shell } from "@/components/v13/shell";
import { createClient } from "@/lib/supabase/server";

// The rehaul shell. The pages that have not been rebuilt yet still live in the (app) group with the old shell.
export default async function V13Layout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  let pending = 0;
  let accounts: { id: string; name: string }[] = [];
  let categories: { id: string; name: string }[] = [];
  if (supabase) {
    const [p, a, c] = await Promise.all([
      supabase.from("transactions").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("accounts").select("id, name").is("archived_at", null).order("sort"),
      supabase.from("categories").select("id, name").is("archived_at", null).order("sort"),
    ]);
    pending = p.count ?? 0;
    accounts = (a.data ?? []) as typeof accounts;
    categories = (c.data ?? []) as typeof categories;
  }
  return (
    <V13Shell pending={pending} accounts={accounts} categories={categories}>
      {children}
    </V13Shell>
  );
}
