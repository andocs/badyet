import { isBucket, isCutoff, validateLine, type Bucket, type Cutoff } from "@/lib/budget/validate";
import { parseInstalmentForm, type InstalmentInput } from "@/lib/installments/input";
import { parsePayForm } from "@/lib/pay/input";
import type { PayProfile } from "@/lib/pay/compute";
import { validatePlan } from "@/lib/plans/validate";
import type { Money } from "@/lib/domain/money";

// A snapshot of your sheet, produced once outside the app and uploaded on the Import page.
// Amounts are text like "2,400.00" (the same format the app's forms accept).
export interface ImportLine {
  cutoff: Cutoff;
  bucket: Bucket;
  name: string;
  amount: Money;
  wallet: string | null;
  source: "installments" | "subscriptions" | null;
}
export interface ImportInstalment {
  value: InstalmentInput; // walletId unused here; the wallet is matched by name
  wallet: string | null;
}
export interface ImportSubscription {
  name: string;
  amount: Money;
  cutoff: Cutoff;
  wallet: string | null;
}
export interface Snapshot {
  plan: { name: string; startDate: string; endDate: string | null };
  pay: PayProfile | null;
  wallets: string[];
  lines: ImportLine[];
  installments: ImportInstalment[];
  subscriptions: ImportSubscription[];
}
export type SnapshotParse = { ok: true; value: Snapshot } | { ok: false; error: string };

export const MAX_IMPORT_BYTES = 200_000;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

export function parseSnapshot(raw: unknown): SnapshotParse {
  if (!isObj(raw) || raw.version !== 1) return { ok: false, error: "This is not a Bad(yet) import file (version 1)." };

  const planRaw = isObj(raw.plan) ? raw.plan : {};
  const plan = validatePlan({ name: planRaw.name, startDate: planRaw.startDate, endDate: planRaw.endDate ?? "" });
  if (!plan.ok) return { ok: false, error: `Plan: ${plan.error}` };

  let pay: PayProfile | null = null;
  if (raw.pay !== undefined && raw.pay !== null) {
    const p = parsePayForm(isObj(raw.pay) ? raw.pay : {});
    if (!p.ok) return { ok: false, error: `Pay: ${p.error}` };
    pay = p.value;
  }

  const wallets = arr(raw.wallets).map(str).filter((w) => w.length > 0);
  if (wallets.some((w) => w.length > 30)) return { ok: false, error: "Wallet names must be 30 characters or less." };
  const known = new Set(wallets.map((w) => w.toLowerCase()));
  const walletName = (v: unknown): string | null | undefined => {
    const w = str(v);
    if (w === "") return null;
    return known.has(w.toLowerCase()) ? w : undefined;
  };

  const lines: ImportLine[] = [];
  for (const [i, l] of arr(raw.lines).entries()) {
    if (!isObj(l)) return { ok: false, error: `Line ${i + 1} is not an object.` };
    const parsed = validateLine({ name: l.name, amount: l.amount });
    if (!parsed.ok) return { ok: false, error: `Line ${i + 1}: ${parsed.error}` };
    if (!isCutoff(l.cutoff) || !isBucket(l.bucket)) return { ok: false, error: `Line ${i + 1}: needs a cutoff and a bucket.` };
    const wallet = walletName(l.wallet);
    if (wallet === undefined) return { ok: false, error: `Line ${i + 1}: wallet "${str(l.wallet)}" is not in the wallets list.` };
    const source = l.source === "installments" || l.source === "subscriptions" ? l.source : null;
    lines.push({ cutoff: l.cutoff, bucket: l.bucket, name: parsed.value.name, amount: parsed.value.amount, wallet, source });
  }
  const seen = new Set<string>();
  for (const l of lines) {
    if (l.source === null) continue;
    const key = `${l.cutoff}/${l.source}`;
    if (seen.has(key)) return { ok: false, error: `Only one "${l.source}" line is allowed per cutoff.` };
    seen.add(key);
  }

  const installments: ImportInstalment[] = [];
  for (const [i, r] of arr(raw.installments).entries()) {
    if (!isObj(r)) return { ok: false, error: `Installment ${i + 1} is not an object.` };
    const parsed = parseInstalmentForm({ ...r, walletId: "" });
    if (!parsed.ok) return { ok: false, error: `Installment ${i + 1}: ${parsed.error}` };
    const wallet = walletName(r.wallet);
    if (wallet === undefined) return { ok: false, error: `Installment ${i + 1}: wallet is not in the wallets list.` };
    installments.push({ value: parsed.value, wallet });
  }

  const subscriptions: ImportSubscription[] = [];
  for (const [i, s] of arr(raw.subscriptions).entries()) {
    if (!isObj(s)) return { ok: false, error: `Subscription ${i + 1} is not an object.` };
    const parsed = validateLine({ name: s.name, amount: s.amount });
    if (!parsed.ok || parsed.value.amount <= 0) return { ok: false, error: `Subscription ${i + 1}: needs a name and an amount above zero.` };
    if (!isCutoff(s.cutoff)) return { ok: false, error: `Subscription ${i + 1}: needs a cutoff.` };
    const wallet = walletName(s.wallet);
    if (wallet === undefined) return { ok: false, error: `Subscription ${i + 1}: wallet is not in the wallets list.` };
    subscriptions.push({ name: parsed.value.name, amount: parsed.value.amount, cutoff: s.cutoff, wallet });
  }

  return { ok: true, value: { plan: plan.value, pay, wallets, lines, installments, subscriptions } };
}
