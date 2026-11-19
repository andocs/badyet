"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAuthed } from "@/lib/auth/require";
import { MAX_IMPORT_BYTES, parseSnapshot } from "@/lib/import/parse";

function fail(code: string, detail?: string): never {
  redirect(`/import?error=${code}${detail ? `&detail=${encodeURIComponent(detail)}` : ""}`);
}

// Creates a NEW inactive plan from the snapshot, plus wallets, pay, budget lines, installments and
// subscriptions (skipping names that already exist). Nothing existing is changed or deleted.
export async function importSnapshot(formData: FormData) {
  const supabase = await requireAuthed();

  const file = formData.get("file");
  const pasted = String(formData.get("json") ?? "");
  let text = pasted;
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_IMPORT_BYTES) fail("toobig");
    text = await file.text();
  }
  if (text.length > MAX_IMPORT_BYTES) fail("toobig");
  if (text.trim() === "") fail("empty");

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    fail("json");
  }
  const parsed = parseSnapshot(json);
  if (!parsed.ok) fail("invalid", parsed.error);
  const s = parsed.value;

  // Wallets: add the ones that are missing, then map names to ids.
  const { data: have } = await supabase.from("wallets").select("id,name");
  const byName = new Map((have ?? []).map((w) => [String(w.name).toLowerCase(), w.id as string]));
  const missing = s.wallets.filter((w) => !byName.has(w.toLowerCase()));
  if (missing.length > 0) {
    const { data: added, error } = await supabase.from("wallets").insert(missing.map((name) => ({ name }))).select("id,name");
    if (error) fail("failed", error.message);
    for (const w of added ?? []) byName.set(String(w.name).toLowerCase(), w.id as string);
  }
  const walletId = (name: string | null) => (name === null ? null : (byName.get(name.toLowerCase()) ?? null));

  const { data: plan, error: planError } = await supabase
    .from("plans")
    .insert({ name: s.plan.name, start_date: s.plan.startDate, end_date: s.plan.endDate })
    .select("id")
    .single();
  if (planError || !plan) fail("failed", planError?.message);

  // From here on, any failure removes the new plan (its pay and lines go with it) so a half import is not left behind.
  const rollback = async (message: string): Promise<never> => {
    await supabase.from("plans").delete().eq("id", plan.id);
    fail("failed", message);
  };

  if (s.pay) {
    const v = s.pay;
    const { error } = await supabase.from("pay_profiles").insert({
      plan_id: plan.id,
      annual_base: v.annualBase,
      allowance_second: v.allowanceSecond,
      sss: v.sss,
      pagibig: v.pagibig,
      savings_plan_bp: v.savingsPlanBp,
      philhealth_override: v.philhealthOverride,
      tax_override_first: v.taxOverrideFirst,
      tax_override_second: v.taxOverrideSecond,
    });
    if (error) await rollback(error.message);
  }
  if (s.lines.length > 0) {
    const { error } = await supabase.from("budget_lines").insert(
      s.lines.map((l) => ({
        plan_id: plan.id,
        cutoff: l.cutoff,
        bucket: l.bucket,
        name: l.name,
        amount: l.amount,
        wallet_id: walletId(l.wallet),
        source: l.source,
      })),
    );
    if (error) await rollback(error.message);
  }

  // Installments and subscriptions are not tied to a plan: skip any that already exist by name.
  const { data: haveInst } = await supabase.from("installments").select("name");
  const instNames = new Set((haveInst ?? []).map((r) => String(r.name).toLowerCase()));
  const newInst = s.installments.filter((i) => !instNames.has(i.value.name.toLowerCase()));
  if (newInst.length > 0) {
    const { error } = await supabase.from("installments").insert(
      newInst.map((i) => ({
        name: i.value.name,
        price: i.value.price,
        down_payment: i.value.downPayment,
        term_count: i.value.termCount,
        rate_bp: i.value.rateBp,
        first_due_on: i.value.firstDueOn,
        cutoff: i.value.cutoff,
        wallet_id: walletId(i.wallet),
      })),
    );
    if (error) await rollback(error.message);
  }
  const { data: haveSub } = await supabase.from("subscriptions").select("name");
  const subNames = new Set((haveSub ?? []).map((r) => String(r.name).toLowerCase()));
  const newSub = s.subscriptions.filter((x) => !subNames.has(x.name.toLowerCase()));
  if (newSub.length > 0) {
    const { error } = await supabase
      .from("subscriptions")
      .insert(newSub.map((x) => ({ name: x.name, amount: x.amount, cutoff: x.cutoff, wallet_id: walletId(x.wallet) })));
    if (error) await rollback(error.message);
  }

  revalidatePath("/", "layout");
  redirect(`/import?done=1&lines=${s.lines.length}&installments=${newInst.length}&subscriptions=${newSub.length}`);
}
